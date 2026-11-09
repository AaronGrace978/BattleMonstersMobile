import {MONSTERS} from '../game.mjs';
/** Convert a raycast hit on the printed page into its actual name row. */
export function monsterAtBookUV(side,uv){
 if(!uv||uv.x<.12||uv.x>.88)return null;
 const y=(1-uv.y)*1024;const row=Math.round((y-243)/133);
 if(row<0||row>4||Math.abs(y-(243+row*133))>55)return null;
 return MONSTERS[(side<0?0:5)+row];
}
