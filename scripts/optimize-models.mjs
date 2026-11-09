import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,resample,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MONSTERS} from '../src/game.mjs';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await mkdir('public/models',{recursive:true});const models=[];
for(const monster of MONSTERS){
 const document=await io.read(`work/models/${monster.id}.glb`);
 // Blender exports the first frame of the summon action as the default pose.
 // Store a full-size resting pose; animation clips retain their original keys.
 for(const node of document.getRoot().listNodes())if(node.getName().endsWith('_Character'))node.setScale([1,1,1]).setTranslation([0,0,0]);
 await document.transform(dedup(),weld(),resample(),prune(),meshopt({encoder:MeshoptEncoder,level:'high'}));
 const file=`public/models/${monster.id}.glb`;await io.write(file,document);const bytes=await readFile(file);
 const root=document.getRoot();let triangles=0;for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives())triangles+=(primitive.getIndices()?.getCount()||primitive.getAttribute('POSITION').getCount())/3;
 models.push({id:monster.id,name:monster.name,file:`/models/${monster.id}.glb`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),triangles:Math.round(triangles),meshes:root.listMeshes().length,animations:root.listAnimations().map(a=>a.getName())});
 console.log(`${monster.name}: ${Math.round(triangles).toLocaleString()} triangles, ${(bytes.length/1024).toFixed(0)} KB, ${root.listAnimations().length} animations`);
}
await writeFile('public/models/manifest.json',JSON.stringify({version:'0.2.0',format:'glTF 2.0 / EXT_meshopt_compression',models},null,2));
