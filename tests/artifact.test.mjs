import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
test('Native projects include required permissions and branded assets',async()=>{const manifest=await readFile('android/app/src/main/AndroidManifest.xml','utf8');for(const permission of ['CAMERA','RECORD_AUDIO','INTERNET'])assert.ok(manifest.includes('android.permission.'+permission));const plist=await readFile('ios/App/App/Info.plist','utf8');for(const permission of ['NSCameraUsageDescription','NSMicrophoneUsageDescription','NSSpeechRecognitionUsageDescription'])assert.ok(plist.includes(permission));assert.ok(existsSync('ios/App/App/PrivacyInfo.xcprivacy'));assert.ok(existsSync('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));});
test('Creature art and launch icons are real, nonempty assets',async()=>{for(const file of ['public/art/pyrax-hero.webp','public/art/bestiary.webp','android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png']){const bytes=await readFile(file);assert.ok(bytes.length>1000);}});
