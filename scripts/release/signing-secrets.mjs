import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const ALIASES={
 android_keystore:['BMM_ANDROID_KEYSTORE_BASE64','ANDROID_KEYSTORE_BASE64','ANDROID_SIGNING_KEY','KEYSTORE_BASE64','SIGNING_KEY','ANDROID_KEYSTORE'],
 android_store_password:['BMM_ANDROID_KEYSTORE_PASSWORD','ANDROID_KEYSTORE_PASSWORD','KEYSTORE_PASSWORD','KEY_STORE_PASSWORD','STORE_PASSWORD'],
 android_alias:['BMM_ANDROID_KEY_ALIAS','ANDROID_KEY_ALIAS','KEY_ALIAS','SIGNING_KEY_ALIAS','ALIAS'],
 android_key_password:['BMM_ANDROID_KEY_PASSWORD','ANDROID_KEY_PASSWORD','KEY_PASSWORD','SIGNING_KEY_PASSWORD'],
 ios_certificate:['BMM_IOS_CERTIFICATE_BASE64','BUILD_CERTIFICATE_BASE64','IOS_CERTIFICATE_P12_BASE64','IOS_CERTIFICATE_BASE64','APPLE_CERTIFICATE_BASE64','IOS_P12_BASE64','APPLE_P12_BASE64','CERTIFICATE_BASE64','IOS_CERTIFICATE_P12','IOS_CERTIFICATE'],
 ios_password:['BMM_IOS_CERT_PASSWORD','P12_PASSWORD','IOS_P12_PASSWORD','IOS_CERT_PASSWORD','IOS_CERTIFICATE_PASSWORD','APPLE_CERTIFICATE_PASSWORD','APPLE_P12_PASSWORD','CERTIFICATE_PASSWORD'],
 ios_profile:['BMM_IOS_PROFILE_BASE64','BUILD_PROVISION_PROFILE_BASE64','IOS_PROVISIONING_PROFILE_BASE64','PROVISIONING_PROFILE_BASE64','IOS_PROVISION_PROFILE_BASE64','IOS_PROFILE_BASE64','APPLE_PROVISIONING_PROFILE_BASE64','IOS_PROVISIONING_PROFILE','PROVISIONING_PROFILE']
};
export function signingMetadata(secrets){
 const names=Object.keys(secrets);const metadata={};
 for(const [logical,aliases] of Object.entries(ALIASES))metadata[logical]=aliases.map(alias=>names.find(n=>n.toUpperCase()===alias&&secrets[n])).find(Boolean)||'';
 metadata.android_ready=Boolean(metadata.android_keystore&&metadata.android_store_password&&metadata.android_alias&&metadata.android_key_password);
 metadata.ios_ready=Boolean(metadata.ios_certificate&&metadata.ios_profile);
 metadata.signing_names=names.filter(n=>n!=='GITHUB_TOKEN'&&/ANDROID|IOS|APPLE|CERT|PROFILE|P12|KEYSTORE|SIGNING|PASSWORD|ALIAS|TEAM/i.test(n)).sort();
 return metadata;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const names=Object.keys(ALIASES).map(key=>process.env[`BMM_${key.toUpperCase()}_SECRET`]).filter(Boolean);
 const metadata=signingMetadata(Object.fromEntries(names.map(name=>[name,true])));
 console.log('Visible signing secret names: '+(metadata.signing_names.join(', ')||'(none)'));
 for(const [key,value]of Object.entries(metadata))if(key!=='signing_names'){
  console.log(`${key}: ${typeof value==='boolean'?value:value||'(unmatched)'}`);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);
 }
 if(process.env.BMM_ALLOW_UNSIGNED!=='true'&&(!metadata.android_ready||!metadata.ios_ready)){
  console.error('Signed release requires Android keystore/password/alias/key-password and Apple P12/provisioning-profile secrets. Only secret names were printed; no secret values were exposed.');process.exitCode=1;
 }
}
