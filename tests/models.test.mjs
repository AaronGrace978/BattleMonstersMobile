import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {AnimationMixer,Box3,Vector3} from 'three';
import {MONSTERS} from '../src/game.mjs';
import validator from 'gltf-validator';
import {monsterAtBookUV} from '../src/world/book-picking.mjs';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const manifest=JSON.parse(await readFile('public/models/manifest.json','utf8'));
test('Every monster has an original, compressed GLB with real volume, smooth normals, and animated geometry',async()=>{
 assert.equal(manifest.models.length,10);let total=0;
 for(const m of MONSTERS){
  const meta=manifest.models.find(x=>x.id===m.id);assert.ok(meta,m.id+' is listed');const b=await readFile('public'+meta.file);total+=b.length;
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.length,meta.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),meta.sha256);assert.ok(b.length<500_000,'Mobile asset budget');
  const validation=await validator.validateBytes(new Uint8Array(b),{uri:m.id+'.glb'});assert.equal(validation.issues.numErrors,0);assert.equal(validation.issues.numWarnings,0);
  const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');let tris=0,meshes=0;
  gltf.scene.traverse(obj=>{if(!obj.isMesh)return;meshes++;assert.ok(obj.geometry.attributes.normal,'Lit surface normals');assert.ok(obj.material.isMeshStandardMaterial||obj.material.isMeshPhysicalMaterial,'Physically shaded surface');tris+=(obj.geometry.index?.count||obj.geometry.attributes.position.count)/3;});
  const bounds=new Box3().setFromObject(gltf.scene).getSize(new Vector3());assert.ok(bounds.x>.5&&bounds.y>.8&&bounds.z>.5,`${m.id} has a full-size volumetric resting pose`);assert.ok(tris>10_000,`${m.id} has detailed geometry`);assert.equal(Math.round(tris),meta.triangles);assert.ok(meshes>=3);
  for(const name of ['Idle','Attack','Summon'])assert.ok(gltf.animations.some(a=>a.name===name),`${m.id} has ${name}`);
  const mixer=new AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(a=>a.name==='Idle')).play();mixer.update(.6);gltf.scene.updateMatrixWorld(true);const animated=new Box3().setFromObject(gltf.scene).getSize(new Vector3());assert.ok(animated.length()/bounds.length()>.8&&animated.length()/bounds.length()<1.2,'Idle animation maintains coherent scale');mixer.stopAllAction();
 }
 assert.ok(total<2_500_000,'Entire creature roster stays within the 2.5 MB mesh budget');
});
test('Raycasting each printed 3D book row selects the correct monster and ignores page margins',()=>{for(const side of [-1,1])for(let row=0;row<5;row++){const monster=monsterAtBookUV(side,{x:.5,y:1-(243+133*row)/1024});assert.equal(monster.id,MONSTERS[(side<0?0:5)+row].id);}assert.equal(monsterAtBookUV(-1,{x:.01,y:.5}),null);assert.equal(monsterAtBookUV(1,{x:.5,y:.99}),null);assert.equal(monsterAtBookUV(1,{x:.5,y:.01}),null);});
