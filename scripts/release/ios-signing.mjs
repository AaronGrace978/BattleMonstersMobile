import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';

const directory=join(process.env.RUNNER_TEMP||'/tmp','battle-monsters-signing');
if(process.argv[2]==='cleanup'){
 try{const data=JSON.parse(await readFile(join(directory,'state.json'),'utf8'));spawnSync('security',['delete-keychain',data.keychain],{stdio:'ignore'});await rm(data.profile,{force:true});}catch{}
 await rm(directory,{recursive:true,force:true});process.exit(0);
}
const cert=process.env.BMM_IOS_CERTIFICATE_BASE64,profile=process.env.BMM_IOS_PROFILE_BASE64,password=process.env.BMM_IOS_CERT_PASSWORD||'';
if(!cert||!profile)throw Error('Apple certificate and provisioning profile are required for a signed iOS build');
await mkdir(directory,{recursive:true,mode:0o700});
const p12=join(directory,'distribution.p12'),provision=join(directory,'profile.mobileprovision'),keychain=join(directory,'release.keychain-db');
function decode(value){return Buffer.from(value.replace(/\s/g,''),'base64');}
await writeFile(p12,decode(cert),{mode:0o600});await writeFile(provision,decode(profile),{mode:0o600});
const keychainPassword=randomBytes(32).toString('hex');
function command(program,args,options={}){
 const r=spawnSync(program,args,{encoding:'utf8',...options});if(r.status!==0){let message=r.stderr||'Command failed';for(const secret of [password,keychainPassword,cert,profile])if(secret)message=message.replaceAll(secret,'[redacted]');throw Error(`${program} failed: ${message.slice(0,2000)}`);}return r.stdout;
}
const decoded=command('security',['cms','-D','-i',provision]);
const inspect=`import sys,plistlib,json,hashlib,datetime\np=plistlib.loads(sys.stdin.buffer.read())\ne=p.get('Entitlements',{})\nprint(json.dumps({'uuid':p['UUID'],'name':p['Name'],'team':p.get('TeamIdentifier',[e.get('com.apple.developer.team-identifier','')])[0],'application':e.get('application-identifier',''),'expiry':p['ExpirationDate'].isoformat(),'devices':bool(p.get('ProvisionedDevices')),'development':bool(e.get('get-task-allow')),'enterprise':bool(p.get('ProvisionsAllDevices')),'certificates':[hashlib.sha1(c).hexdigest().upper() for c in p.get('DeveloperCertificates',[])]}))`;
const info=JSON.parse(command('python3',['-c',inspect],{input:decoded}));
if(new Date(info.expiry+'Z')<new Date())throw Error('The Apple provisioning profile has expired');
const configuredBundle=JSON.parse(await readFile('capacitor.config.json','utf8')).appId;
const profileBundle=info.application.startsWith(info.team+'.')?info.application.slice(info.team.length+1):'';
if(!profileBundle||!info.team)throw Error('The profile does not contain a valid Apple team and app identifier');
let bundle=profileBundle;if(bundle.includes('*')){if(!configuredBundle.startsWith(bundle.slice(0,-1)))throw Error('The wildcard profile does not cover the configured app identifier');bundle=configuredBundle;}
command('security',['create-keychain','-p',keychainPassword,keychain]);
command('security',['set-keychain-settings','-lut','21600',keychain]);
command('security',['unlock-keychain','-p',keychainPassword,keychain]);
command('security',['import',p12,'-P',password,'-t','cert','-f','pkcs12','-k',keychain,'-T','/usr/bin/codesign','-T','/usr/bin/security']);
command('security',['set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',keychainPassword,keychain]);
command('security',['list-keychains','-d','user','-s',keychain,'/Library/Keychains/System.keychain']);
const identities=command('security',['find-identity','-v','-p','codesigning',keychain]);
const identity=[...identities.matchAll(/\b([A-Fa-f0-9]{40})\b/g)].map(m=>m[1].toUpperCase()).find(hash=>info.certificates.includes(hash));
if(!identity)throw Error('The imported Apple certificate does not match the provisioning profile or lacks a usable private key');
const profileDirectory=join(process.env.HOME,'Library','MobileDevice','Provisioning Profiles');await mkdir(profileDirectory,{recursive:true});const installed=join(profileDirectory,info.uuid+'.mobileprovision');await writeFile(installed,decode(profile),{mode:0o600});
await writeFile(join(directory,'state.json'),JSON.stringify({keychain,profile:installed}),{mode:0o600});
const ruby=`require 'xcodeproj';p=Xcodeproj::Project.open('ios/App/App.xcodeproj');p.targets.select{|t|t.name=='App'}.each{|t|t.build_configurations.each{|c|c.build_settings['CODE_SIGN_STYLE']='Manual';c.build_settings['DEVELOPMENT_TEAM']=ENV['BMM_SIGN_TEAM'];c.build_settings['PROVISIONING_PROFILE_SPECIFIER']=ENV['BMM_SIGN_PROFILE'];c.build_settings['CODE_SIGN_IDENTITY']=ENV['BMM_SIGN_IDENTITY'];c.build_settings['PRODUCT_BUNDLE_IDENTIFIER']=ENV['BMM_SIGN_BUNDLE']}};p.save`;
command('ruby',['-rxcodeproj','-e',ruby],{env:{...process.env,BMM_SIGN_TEAM:info.team,BMM_SIGN_PROFILE:info.uuid,BMM_SIGN_IDENTITY:identity,BMM_SIGN_BUNDLE:bundle}});
const method=info.enterprise?'enterprise':info.devices?(info.development?'debugging':'release-testing'):'app-store-connect';
const exportOptions={method,teamID:info.team,signingStyle:'manual',signingCertificate:identity,provisioningProfiles:{[bundle]:info.uuid},stripSwiftSymbols:true,manageAppVersionAndBuildNumber:false};
const plist=command('python3',['-c','import sys,json,plistlib;sys.stdout.buffer.write(plistlib.dumps(json.load(sys.stdin)))'],{input:JSON.stringify(exportOptions)});
await writeFile(join(directory,'ExportOptions.plist'),plist,{mode:0o600});
if(process.env.GITHUB_ENV){appendFileSync(process.env.GITHUB_ENV,`BMM_IOS_SIGNED=true\nBMM_IOS_EXPORT_OPTIONS=${join(directory,'ExportOptions.plist')}\nBMM_IOS_BUNDLE_ID=${bundle}\nBMM_IOS_EXPORT_METHOD=${method}\n`);}
await rm(p12,{force:true});
console.log(`Apple signing configured for ${bundle} (${method}); certificate and profile validated.`);
