import {execFileSync} from 'node:child_process';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
await mkdir('work',{recursive:true});
execFileSync('convert',['-size','1024x1024','xc:#0b1618','-fill','none','-stroke','#c7f27e','-strokewidth','56','-draw','path "M 200,216 L 392,312 L 512,232 L 632,312 L 824,216 L 744,528 L 512,824 L 280,528 Z"','-strokewidth','48','-draw','path "M 352,440 L 448,496 M 672,440 L 576,496 M 512,616 L 512,704"','work/icon-1024.png']);
const raster=resolve('work/icon-1024.png');
execFileSync('convert',[raster,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']);
const densities={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
for(const [density,size]of Object.entries(densities)){
 const directory=`android/app/src/main/res/mipmap-${density}`;
 for(const file of ['ic_launcher.png','ic_launcher_round.png'])execFileSync('convert',[raster,'-resize',`${size}x${size}`,`${directory}/${file}`]);
 const canvas=Math.round(size*2.25),mark=Math.round(canvas*.62);
 execFileSync('convert',['-size',`${canvas}x${canvas}`,'xc:#0b1618','(',raster,'-resize',`${mark}x${mark}`,')','-gravity','center','-composite',`${directory}/ic_launcher_foreground.png`]);
}
await writeFile('android/app/src/main/res/values/ic_launcher_background.xml','<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#0B1618</color></resources>');
const vector='<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="128" android:viewportHeight="128"><path android:pathData="M25,27 L49,39 L64,29 L79,39 L103,27 L93,66 L64,103 L35,66 Z" android:strokeColor="#C7F27E" android:strokeWidth="7" android:fillColor="#0B1618"/><path android:pathData="M44,55 L56,62 M84,55 L72,62 M64,77 L64,88" android:strokeColor="#C7F27E" android:strokeWidth="6"/></vector>';
await writeFile('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml',vector);
for(const name of await readdir('android/app/src/main/res')){if(!name.startsWith('drawable'))continue;const path=`android/app/src/main/res/${name}/splash.png`;if(!existsSync(path))continue;const [w,h]=execFileSync('identify',['-format','%w %h',path],{encoding:'utf8'}).trim().split(' ');const mark=Math.round(Math.min(+w,+h)*.2);execFileSync('convert',['-size',`${w}x${h}`,'xc:#080e10','(',raster,'-resize',`${mark}x${mark}`,')','-gravity','center','-composite',path]);}
for(const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])execFileSync('convert',['-size','2732x2732','xc:#080e10','(',raster,'-resize','340x340',')','-gravity','center','-composite',`ios/App/App/Assets.xcassets/Splash.imageset/${name}`]);
console.log('Branded iOS and Android app icons and launch artwork.');
