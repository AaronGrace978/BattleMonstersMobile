import {readFile,writeFile,mkdir,copyFile,readdir,cp,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const platform=process.argv[2];
const {version}=JSON.parse(await readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))throw Error('Invalid release version');
if(!['android','ios','release'].includes(platform))throw Error('Use android, ios, or release');
const directory=`distribution/${platform}`;await mkdir(directory,{recursive:true});
const prefix=`BattleMonstersMobile-v${version}`;
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const files=[];
async function add(source,suffix){const name=prefix+'-'+suffix;await copyFile(source,`${directory}/${name}`);files.push(name);return name;}
async function zip(source,suffix){const name=prefix+'-'+suffix;execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',source,`${directory}/${name}`]);files.push(name);}

if(platform==='android'){
 await add('android/app/build/outputs/apk/debug/app-debug.apk','Android-test.apk');
 const signed=process.env.BMM_ANDROID_SIGNED==='true';
 if(signed)await add('android/app/build/outputs/apk/release/app-release.apk','Android-signed.apk');
 await add('android/app/build/outputs/bundle/release/app-release.aab',signed?'Android-signed.aab':'Android-unsigned.aab');
 await writeFile(`${directory}/android-build.json`,JSON.stringify({version,commit:sha,platform,distributionSigned:signed,testAPK:'Signed with the development key; for testing only',files},null,2));
}else if(platform==='ios'){
 const app='work/BattleMonstersMobile.xcarchive/Products/Applications/App.app';
 await stat(app);await zip('work/ios-simulator/Build/Products/Release-iphonesimulator/App.app','iOS-simulator.zip');
 await zip('work/BattleMonstersMobile.xcarchive','iOS-unsigned.xcarchive.zip');
 const payload='work/ios-payload/Payload';await mkdir(payload,{recursive:true});await cp(app,`${payload}/App.app`,{recursive:true});await zip(payload,'iOS-unsigned.ipa');
 await writeFile(`${directory}/ios-build.json`,JSON.stringify({version,commit:sha,platform,distributionSigned:false,deviceBuild:'Unsigned; Apple signing is required for iPhone installation or TestFlight',simulatorBuild:'Runs in Xcode Simulator; not installable on an iPhone',files},null,2));
}else{
 const source=prefix+'-source.zip';execFileSync('git',['archive','--format=zip',`--prefix=Battle-Monsters-Mobile-v${version}/`,`--output=${resolve(directory,source)}`,'HEAD']);
 const entries=(await readdir(directory)).filter(n=>!['SHA256SUMS.txt','release-manifest.json'].includes(n)).sort();
 const artifacts=[];
 for(const name of entries){const bytes=await readFile(`${directory}/${name}`);artifacts.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 const android=JSON.parse(await readFile(`${directory}/android-build.json`,'utf8'));const ios=JSON.parse(await readFile(`${directory}/ios-build.json`,'utf8'));
 if(android.commit!==sha||ios.commit!==sha)throw Error('Platform artifacts do not match the release commit');
 await writeFile(`${directory}/release-manifest.json`,JSON.stringify({version,tag:`v${version}`,commit:sha,releaseType:'development',android,ios,artifacts},null,2));
 const manifest=await readFile(`${directory}/release-manifest.json`);artifacts.push({name:'release-manifest.json',sha256:createHash('sha256').update(manifest).digest('hex')});
 await writeFile(`${directory}/SHA256SUMS.txt`,artifacts.map(a=>`${a.sha256}  ${a.name}`).join('\n')+'\n');
}
console.log(`Packaged ${platform} artifacts for v${version} (${sha.slice(0,7)}).`);
