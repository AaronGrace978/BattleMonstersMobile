import React,{useEffect,useRef,useState} from 'react';
import {RotateCcw,ZoomIn,ZoomOut,Loader2,AlertTriangle} from 'lucide-react';

let rendererModule;
const getRenderer=()=>rendererModule||(rendererModule=import('./world/renderer.mjs'));

/** A DOM viewport into one shared, scissored WebGL2 renderer. No creature billboards. */
export default function ModelViewport({monster,opponent=null,variant='portrait',interactive=false,className='',style={},action='',onReady,onSelect}){
 const element=useRef();const handle=useRef();const [state,setState]=useState('loading');const [error,setError]=useState('');const [hotspots,setHotspots]=useState([]);
 const selectRef=useRef(onSelect);selectRef.current=onSelect;
 useEffect(()=>{
  let alive=true;setState('loading');setError('');
  if(typeof window.WebGL2RenderingContext==='undefined'){setState('unsupported');setError('WebGL 2 is required to display this creature.');return;}
  getRenderer().then(module=>{if(!alive)return;handle.current=module.registerViewport(element.current,{id:monster.id,opponentId:opponent?.id,variant,interactive,onSelect:m=>selectRef.current?.(m),onHotspots:p=>{if(alive)setHotspots(p);},onStatus:(next,message)=>{if(alive){setState(next);setError(message||'');if(next==='ready')onReady?.();}}});}).catch(()=>{if(alive){setState('error');setError('The 3D renderer could not load. Refresh to try again.');}});
  return()=>{alive=false;handle.current?.dispose();handle.current=null;};
 },[monster.id,opponent?.id,variant,interactive]);
 useEffect(()=>{handle.current?.setAction(action);},[action,state]);
 return <div ref={element} role={interactive||variant==='grimoire'?'group':'img'} aria-label={`${monster.name}${opponent?` versus ${opponent.name}`:''}, animated 3D model${interactive?'. Drag to rotate; pinch or use buttons to zoom.':''}`} data-model-id={monster.id} data-renderer="webgl2" data-model-state={state} className={`model-viewport ${interactive?'model-interactive':''} model-${variant} ${className}`} style={{'--creature-color':monster.color,...style}}>
  {state==='loading'&&<div className="model-status"><Loader2 className="spin" size={18}/><span>Awakening {monster.name}…</span></div>}
  {(state==='error'||state==='unsupported')&&<div className="model-status model-error"><AlertTriangle size={18}/><span>{error}</span></div>}
  {variant==='grimoire'&&hotspots.map(p=><button type="button" key={p.id} className="grimoire-hotspot" aria-label={`Summon ${p.name}`} title={`Summon ${p.name}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={e=>{e.stopPropagation();onSelect?.(p.monster);}}/>)}
  {interactive&&state==='ready'&&<><div className="model-gesture">DRAG TO TURN · PINCH TO ZOOM</div><div className="model-controls"><button type="button" aria-label={`Zoom in on ${monster.name}`} onClick={e=>{e.stopPropagation();handle.current?.zoom(.84);}}><ZoomIn size={16}/></button><button type="button" aria-label={`Zoom out from ${monster.name}`} onClick={e=>{e.stopPropagation();handle.current?.zoom(1.18);}}><ZoomOut size={16}/></button><button type="button" aria-label={`Reset ${monster.name} view`} onClick={e=>{e.stopPropagation();handle.current?.reset();}}><RotateCcw size={14}/></button></div></>}
 </div>;
}
