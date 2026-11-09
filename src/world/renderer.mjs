import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MONSTERS} from '../game.mjs';
import {monsterAtBookUV} from './book-picking.mjs';

const MODEL_REV='sculpt-2';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const assets=new Map();const slots=new Set();let engine=null;
const clamp=THREE.MathUtils.clamp;
function asset(id){if(!assets.has(id))assets.set(id,loader.loadAsync(`/models/${id}.glb?v=${MODEL_REV}`).catch(e=>{assets.delete(id);throw e;}));return assets.get(id);}
function smoothStep(t){t=clamp(t,0,1);return t*t*(3-2*t);}

class Renderer{
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.className='shared-world-canvas';this.canvas.setAttribute('aria-hidden','true');
  Object.assign(this.canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'105'});document.body.appendChild(this.canvas);
  try{this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:true});}catch(e){this.canvas.remove();throw e;}
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  const generator=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.environment=generator.fromScene(room,.035).texture;room.dispose();generator.dispose();
  this.clock=new THREE.Clock();this.width=0;this.height=0;this.lastRender=0;this.frame=0;this.running=false;this.lost=false;
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;for(const s of slots)s.options.onStatus('error','The graphics context was interrupted. Waiting for the device to restore it.');});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.renderer.shadowMap.needsUpdate=true;for(const s of slots)s.options.onStatus('ready');});
  this.tick=this.tick.bind(this);this.tick();
 }
 tick(time=0){
  requestAnimationFrame(this.tick);if(document.hidden||this.lost)return;
  const minimum=slots.size>5?1000/30:1000/50;if(time-this.lastRender<minimum)return;this.lastRender=time;
  const width=window.innerWidth,height=window.innerHeight;
  if(this.width!==width||this.height!==height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}
  const dt=Math.min(this.clock.getDelta(),.06);const reduced=document.documentElement.dataset.motion==='reduced';
  this.renderer.setScissorTest(false);this.renderer.clear(true,true,true);this.renderer.setScissorTest(true);
  const modal=document.querySelector('.modal-backdrop');const mobileNav=document.querySelector('.mobile-nav')?.getBoundingClientRect();const contentBottom=mobileNav?.height?mobileNav.top:height;
  const visible=[];
  for(const slot of slots){
   if(slot.disposed||!slot.ready||!slot.el.isConnected)continue;
   if(modal&&!slot.el.closest('.modal'))continue;
   if(slot.options.variant==='battle'&&slot.el.closest('.battle-stage')?.querySelector('.battle-result'))continue;
   const r=slot.el.getBoundingClientRect();if(r.width<4||r.height<4||r.bottom<=0||r.top>=height||r.right<=0||r.left>=width)continue;
   const clip={left:Math.max(0,r.left),right:Math.min(width,r.right),top:Math.max(0,r.top),bottom:Math.min(modal?height:contentBottom,r.bottom)};
   for(const p of slot.clippers){const b=p.el.getBoundingClientRect();if(p.x){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}if(p.y){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}}
   const parent=slot.el.closest('.modal');if(parent){const p=parent.getBoundingClientRect();clip.top=Math.max(clip.top,p.top);clip.bottom=Math.min(clip.bottom,p.bottom);clip.left=Math.max(clip.left,p.left);clip.right=Math.min(clip.right,p.right);}
   if(clip.bottom<=clip.top||clip.right<=clip.left)continue;
   visible.push(slot);slot.update(reduced?0:dt,time*.001,reduced);slot.fit(r.width/r.height);
   this.renderer.setViewport(r.left,height-r.bottom,r.width,r.height);this.renderer.setScissor(clip.left,height-clip.bottom,clip.right-clip.left,clip.bottom-clip.top);
   this.renderer.clearDepth();this.renderer.shadowMap.needsUpdate=slot.needsShadow||this.frame%20===0;this.renderer.render(slot.scene,slot.camera);slot.needsShadow=false;
  }
  this.renderer.setScissorTest(false);this.frame++;
 }
}

class Viewport{
 constructor(el,options){
  this.el=el;this.options=options;this.disposed=false;this.ready=false;this.entities=[];this.mixers=[];this.materials=[];this.needsShadow=true;this.elapsed=0;this.action='';this.actionStarted=-10;this.yaw=options.variant==='hero'?-.55:.55;this.pitch=.16;this.zoomFactor=1;this.camera=new THREE.PerspectiveCamera(36,1,.03,100);
  this.clippers=[];for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);const x=/hidden|clip|scroll|auto/.test(s.overflowX),y=/hidden|clip|scroll|auto/.test(s.overflowY);if(x||y)this.clippers.push({el:p,x,y});}
  this.defaultYaw=this.yaw;this.scene=new THREE.Scene();this.scene.environment=engine.environment;this.scene.environmentIntensity=.78;
  const hemi=new THREE.HemisphereLight('#fff1da','#3c2d26',1.55);this.scene.add(hemi);
  const key=new THREE.DirectionalLight('#ffe2b1',3.4);key.position.set(3,5,4);this.scene.add(key);
  const fill=new THREE.DirectionalLight('#d9e0ec',1.8);fill.position.set(-4,2,1);this.scene.add(fill);
  const rim=new THREE.DirectionalLight('#e9b77b',3.2);rim.position.set(1,4,-4);this.scene.add(rim);
  this.detailed=['hero','detail','summon','battle','summoning'].includes(options.variant);
  if(this.detailed){key.castShadow=true;key.shadow.mapSize.set(768,768);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.camera.near=.1;key.shadow.camera.far=15;key.shadow.bias=-.0006;key.shadow.normalBias=.025;this.addPlinth();}
  this.impact=new THREE.PointLight('#ffc08a',0,6,2);this.impact.position.set(0,1,1);this.scene.add(this.impact);
  this.projectile=new THREE.Mesh(new THREE.SphereGeometry(.09,16,12),new THREE.MeshBasicMaterial({color:'#e5ab6d',transparent:true,opacity:.9}));this.projectile.visible=false;this.materials.push(this.projectile.material);this.scene.add(this.projectile);
  this.events=[];if(options.interactive)this.bindControls();
  if(options.variant==='grimoire'){this.addGrimoire();this.measure();this.yaw=0;this.pitch=.91;this.defaultYaw=0;this.bindBookPicking();this.ready=true;options.onStatus('ready');return;}
  const ids=[options.id,...(options.opponentId?[options.opponentId]:[])];
  Promise.all(ids.map((id,index)=>this.load(id,index,ids.length))).then(()=>{if(this.disposed)return;this.measure();this.ready=true;options.onStatus('ready');}).catch(()=>{if(!this.disposed)options.onStatus('error',`The ${options.id} model could not load. Refresh to try again.`);});
 }
 addGrimoire(){
  const book=new THREE.Group();const leather=new THREE.MeshStandardMaterial({color:'#493025',roughness:.91,metalness:.02});const brass=new THREE.MeshStandardMaterial({color:'#aa824a',roughness:.4,metalness:.72});const paper=new THREE.MeshStandardMaterial({color:'#c6af85',roughness:.95});this.materials.push(leather,brass,paper);
  const coverShape=new THREE.Shape();const w=3.72,d=2.5,r=.07;coverShape.moveTo(-w/2+r,-d/2);coverShape.lineTo(w/2-r,-d/2);coverShape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);coverShape.lineTo(w/2,d/2-r);coverShape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);coverShape.lineTo(-w/2+r,d/2);coverShape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);coverShape.lineTo(-w/2,-d/2+r);coverShape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  const cover=new THREE.Mesh(new THREE.ExtrudeGeometry(coverShape,{depth:.055,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.025}),leather);cover.rotation.x=-Math.PI/2;cover.position.y=.04;book.add(cover);
  // A real curved spine and layered page edges; all book surfaces are 3D geometry.
  const spine=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.45,24),leather);spine.rotation.x=Math.PI/2;spine.position.y=.13;book.add(spine);
  this.hotspots=[];this.bookPages=[];
  for(const side of [-1,1]){
   const sideMonsters=MONSTERS.slice(side<0?0:5,side<0?5:10);
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#d8c49e';ctx.fillRect(0,0,768,1024);let rand=45;const rnd=()=>{rand=(rand*16807)%2147483647;return rand/2147483647;};for(let i=0;i<22000;i++){ctx.fillStyle=`rgba(80,50,20,${rnd()*.04})`;ctx.fillRect(rnd()*768,rnd()*1024,1+rnd()*3,1+rnd()*2);}
   const shade=ctx.createLinearGradient(0,0,768,0);shade.addColorStop(0,'#67401b44');shade.addColorStop(.12,'#fff5d900');shade.addColorStop(.85,'#fff5d900');shade.addColorStop(1,'#67401b44');ctx.fillStyle=shade;ctx.fillRect(0,0,768,1024);
   ctx.strokeStyle='#8f6e3e';ctx.lineWidth=3;ctx.strokeRect(47,48,674,925);ctx.lineWidth=1;ctx.strokeRect(57,58,654,905);ctx.textAlign='center';ctx.fillStyle='#61432c';ctx.font='27px Georgia';ctx.fillText(side<0?'CREATURES OF THE OLD WORLD':'SOULS BEYOND THE VEIL',384,115);ctx.font='18px Georgia';ctx.fillText('—  THE LIVING GRIMOIRE  —',384,160);
   for(let i=0;i<5;i++){const m=sideMonsters[i];const y=258+i*133;ctx.fillStyle='#38291e';ctx.font='italic 56px Georgia';ctx.fillText(m.name,384,y);ctx.font='20px Georgia';ctx.fillStyle='#8b653a';ctx.fillText(`${m.element.toUpperCase()}  ·  ${m.title}`,384,y+38);ctx.strokeStyle='#a88a5a66';ctx.beginPath();ctx.moveTo(140,y+65);ctx.lineTo(628,y+65);ctx.stroke();
    const u=.51,v=(y-15)/1024;const pos=new THREE.Vector3(side*(.08+u*1.64),.18+Math.sin(u*Math.PI)*.07,(v-.5)*2.22);this.hotspots.push({id:m.id,name:m.name,monster:m,position:pos});}
   ctx.font='18px Georgia';ctx.fillStyle='#88683f';ctx.fillText(side<0?'I  ·  VOLUME OF SUMMONING':'II  ·  SPEAK, AND THEY SHALL ANSWER',384,929);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
   const ink=new THREE.MeshStandardMaterial({map:texture,roughness:.94,side:THREE.DoubleSide});this.materials.push(ink);
   for(let layer=0;layer<5;layer++){
    const geo=new THREE.PlaneGeometry(1.64,2.22,32,24);const positions=geo.attributes.position;
    for(let i=0;i<positions.count;i++){const u=positions.getX(i)/1.64+.5,v=.5-positions.getY(i)/2.22;positions.setXYZ(i,side*(.08+u*1.64),.13+layer*.01+Math.sin(u*Math.PI)*.07,(v-.5)*2.22);}
    if(side<0){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
    geo.computeVertexNormals();const page=new THREE.Mesh(geo,layer===4?ink:paper);book.add(page);if(layer===4){page.userData.side=side;this.bookPages.push(page);}
   }
   for(const z of [-1.11,1.11]){const corner=new THREE.Mesh(new THREE.TorusGeometry(.1,.013,5,20,Math.PI/2),brass);corner.rotation.x=-Math.PI/2;corner.position.set(side*1.68,.105,z);book.add(corner);}
  }
  this.scene.add(book);this.entities=[{id:'grimoire',model:book,presentation:book,baseX:0,baseRotation:0}];
 }
 addPlinth(){
  const radius=this.options.opponentId?3.25:1.65;
  const stone=new THREE.MeshStandardMaterial({color:'#453d35',roughness:.88,metalness:.12});this.materials.push(stone);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*1.035,.11,96),stone);base.position.y=-.09;base.receiveShadow=true;this.scene.add(base);
  const bronze=new THREE.MeshStandardMaterial({color:'#a18150',metalness:.74,roughness:.43});this.materials.push(bronze);
  for(const r of [radius*.92,radius*.98]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.012,6,96),bronze);ring.rotation.x=-Math.PI/2;ring.position.y=-.027;this.scene.add(ring);}
  // Engraved brass tick marks and a weathered compass rose on the stone pedestal.
  const tickGeo=new THREE.BoxGeometry(.012,.004,.07);const ticks=new THREE.InstancedMesh(tickGeo,bronze,48);const tick=new THREE.Object3D();
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;tick.position.set(Math.cos(a)*radius*.86,-.027,Math.sin(a)*radius*.86);tick.rotation.y=-a+Math.PI/2;tick.updateMatrix();ticks.setMatrixAt(i,tick.matrix);}this.scene.add(ticks);
 }
 async load(id,index,count){
  const gltf=await asset(id);if(this.disposed)return;
  const model=cloneSkeleton(gltf.scene);model.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;obj.frustumCulled=false;const cloneMaterial=m=>{const c=m.clone();this.materials.push(c);return c;};obj.material=Array.isArray(obj.material)?obj.material.map(cloneMaterial):cloneMaterial(obj.material);}});
  model.updateMatrixWorld(true);const initial=new THREE.Box3().setFromObject(model);const size=initial.getSize(new THREE.Vector3());const center=initial.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.length())||size.length()<.01)throw Error('Invalid model bounds');
  model.position.add(new THREE.Vector3(-center.x,-initial.min.y,-center.z));
  const normalized=new THREE.Group();normalized.add(model);const scale=2.65/Math.max(size.y,size.x*.72,size.z*.8);normalized.scale.setScalar(scale);
  const presentation=new THREE.Group();presentation.add(normalized);
  const baseX=count===2?(index===0?-1.65:1.65):0;presentation.position.x=baseX;if(count===2){presentation.rotation.y=index===0?Math.PI/2:-Math.PI/2;normalized.scale.multiplyScalar(.72);}
  this.scene.add(presentation);
  const mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>a.name==='Idle')||gltf.animations.find(a=>/idle/i.test(a.name));if(idle){const a=mixer.clipAction(idle);a.play();a.time=index*.7;this.mixers.push(mixer);}
  const entity={id,model,normalized,presentation,baseX,baseRotation:presentation.rotation.y,mixer};this.entities[index]=entity;
 }
 measure(){
  const box=new THREE.Box3();for(const e of this.entities)box.expandByObject(e.presentation);const size=box.getSize(new THREE.Vector3());this.target=box.getCenter(new THREE.Vector3());this.target.y=Math.max(.8,this.target.y*.93);this.span={width:size.x,height:size.y,depth:size.z};
  if(this.options.opponentId){this.yaw=.08;this.defaultYaw=.08;this.pitch=.19;}
  if(this.options.variant==='grimoire')this.target.y=.13;
 }
 fit(aspect){
  if(!this.span)return;this.camera.aspect=aspect;
  const tangent=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
  const horizontal=this.span.width*Math.abs(Math.cos(this.yaw))+this.span.depth*Math.abs(Math.sin(this.yaw));
  const vertical=this.options.variant==='grimoire'?this.span.depth*Math.sin(this.pitch):this.span.height;
  const distance=Math.max(vertical/(2*tangent),horizontal/(2*tangent*aspect))*1.2*this.zoomFactor;
  this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*distance,this.target.y+Math.sin(this.pitch)*distance,this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*distance);this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
  if(this.hotspots){const points=this.hotspots.map(p=>{const n=p.position.clone().project(this.camera);return {...p,x:(n.x*.5+.5)*100,y:(-.5*n.y+.5)*100};});const signature=points.map(p=>`${Math.round(p.x*10)},${Math.round(p.y*10)}`).join('|');if(signature!==this.hotspotSignature){this.hotspotSignature=signature;this.options.onHotspots?.(points);}}
 }
 setAction(action){if(action&&action!==this.action){this.action=action;this.actionStarted=performance.now()/1000;this.needsShadow=true;}else if(!action)this.action='';}
 update(dt,time,reduced){
  for(const mixer of this.mixers)mixer.update(dt);
  const since=time-this.actionStarted;const phase=clamp(since/.9,0,1);
  const striking=this.action==='attack'||this.action==='skill';
  for(let i=0;i<this.entities.length;i++){
   const e=this.entities[i];if(!e)continue;
   e.presentation.position.x=e.baseX;e.presentation.position.y=0;e.presentation.position.z=0;e.presentation.rotation.z=0;e.presentation.scale.setScalar(1);
   if(this.options.variant==='summon'||this.options.variant==='summoning'){
    this.elapsed+=dt;const appear=smoothStep(Math.min(1,this.elapsed/1.4));e.presentation.scale.setScalar(Math.max(.001,appear));e.presentation.position.y=(1-appear)*.35;
   }
   if(striking&&since<.9&&!reduced){
    if(this.entities.length===2){const ownPhase=i===0?phase*2:phase*2-1;const pulse=ownPhase>=0&&ownPhase<=1?Math.sin(ownPhase*Math.PI):0;e.presentation.position.x=e.baseX+(i===0?1:-1)*pulse*.55;e.presentation.rotation.z=(i===0?-1:1)*pulse*.08;}
    else{e.presentation.position.z=Math.sin(phase*Math.PI)*.3;e.presentation.rotation.z=Math.sin(phase*Math.PI*2)*.05;}
   }
   if(this.action==='guard'&&since<.9)e.presentation.scale.setScalar(1-Math.sin(phase*Math.PI)*.025);
  }
  this.impact.intensity=striking&&since<.9?Math.max(0,Math.sin(phase*Math.PI*4))*7:0;
  this.projectile.visible=this.action==='skill'&&since<.8&&since>.1&&this.entities.length===2;
  if(this.projectile.visible){this.projectile.position.set(-1.3+smoothStep((since-.1)/.35)*2.6,1.35,.0);this.projectile.scale.setScalar(1+Math.sin(time*23)*.2);}
 }
 bindControls(){
  const pointers=new Map();let previousDistance=0;
  const listen=(type,fn,opts)=>{this.el.addEventListener(type,fn,opts);this.events.push(()=>this.el.removeEventListener(type,fn,opts));};
  listen('pointerdown',e=>{if(e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.el.setPointerCapture?.(e.pointerId);});
  listen('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(previousDistance)this.zoom(previousDistance/d);previousDistance=d;}else{this.yaw-=(e.clientX-old.x)*.009;if(e.pointerType!=='touch')this.pitch=clamp(this.pitch+(e.clientY-old.y)*.005,-.05,.6);}});
  const release=e=>{pointers.delete(e.pointerId);previousDistance=0;};listen('pointerup',release);listen('pointercancel',release);
  listen('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.zoom(Math.exp(e.deltaY*.002));}},{passive:false});
 }
 bindBookPicking(){
  const ray=new THREE.Raycaster();let start=null;
  const down=e=>{start={x:e.clientX,y:e.clientY};};
  const up=e=>{if(e.target.closest('button')||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)return;start=null;const r=this.el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),this.camera);this.scene.updateMatrixWorld(true);const hit=ray.intersectObjects(this.bookPages,false)[0];if(hit){const monster=monsterAtBookUV(hit.object.userData.side,hit.uv);if(monster)this.options.onSelect?.(monster);}};
  this.el.addEventListener('pointerdown',down);this.el.addEventListener('pointerup',up);this.events.push(()=>{this.el.removeEventListener('pointerdown',down);this.el.removeEventListener('pointerup',up);});
 }
 zoom(multiplier){this.zoomFactor=clamp(this.zoomFactor*multiplier,.63,1.8);}
 reset(){this.yaw=this.defaultYaw;this.pitch=.16;this.zoomFactor=1;}
 dispose(){this.disposed=true;slots.delete(this);for(const off of this.events)off();for(const mixer of this.mixers)mixer.stopAllAction();for(const material of this.materials){if(this.options.variant==='grimoire')material.map?.dispose();material.dispose();}this.scene.traverse(o=>{if(o.geometry&&(this.options.variant==='grimoire'||!this.entities.some(e=>isDescendant(o,e.model))))o.geometry.dispose();});this.scene.clear();}
}
function isDescendant(obj,ancestor){for(let p=obj;p;p=p.parent)if(p===ancestor)return true;return false;}

export function registerViewport(el,options){
 try{if(!engine)engine=new Renderer();const slot=new Viewport(el,options);slots.add(slot);return {dispose:()=>slot.dispose(),setAction:a=>slot.setAction(a),zoom:f=>slot.zoom(f),reset:()=>slot.reset()};}
 catch{options.onStatus('error','WebGL 2 could not start. Enable hardware acceleration and refresh, or use a supported phone.');return {dispose(){},setAction(){},zoom(){},reset(){}};}
}

export function rendererDiagnostics(){return {viewports:slots.size,cachedModels:assets.size,contexts:engine?1:0,drawCalls:engine?.renderer.info.render.calls||0,geometryCount:engine?.renderer.info.memory.geometries||0};}
