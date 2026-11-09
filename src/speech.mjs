import {Capacitor} from '@capacitor/core';
export const aliases={pyrax:['pyrax','pie racks','pyrex','pyr ax'],glaciel:['glaciel','glacial'],voltra:['voltra','volta'],sylvara:['sylvara','silvara','sylvia'],abyssal:['abyssal','abyss'],obsidian:['obsidian'],zephyr:['zephyr','zeffer'],noctis:['noctis','noctus'],solaris:['solaris','solar'],mycelis:['mycelis','mycelium','my sellis']};
export function monsterFromSpeech(transcripts,monsters){const heard=transcripts.join(' ').toLowerCase();return monsters.find(m=>aliases[m.id].some(a=>heard.includes(a)));}
export async function nativeSpeech({onListening,onTranscript,onError}){
 const {SpeechRecognition}=await import('@capacitor-community/speech-recognition');
 if(!(await SpeechRecognition.available()).available){onError('Speech recognition is unavailable on this device. Tap a name to summon.');return null;}
 let permission=await SpeechRecognition.checkPermissions();if(permission.speechRecognition!=='granted')permission=await SpeechRecognition.requestPermissions();
 if(permission.speechRecognition!=='granted'){onError('Microphone or speech permission was declined. Tap a name to summon.');return null;}
 const listener=await SpeechRecognition.addListener('listeningState',data=>onListening(data.status==='started'));
 const stop=async()=>{await SpeechRecognition.stop().catch(()=>{});await listener.remove();onListening(false);};
 onListening(true);
 SpeechRecognition.start({language:'en-US',maxResults:3,popup:Capacitor.getPlatform()==='android',partialResults:false,prompt:'Say “Summon Pyrax”'}).then(result=>{if(result.matches?.length)onTranscript(result.matches);}).catch(()=>onError('Voice recognition stopped. Try again or tap a monster name.')).finally(()=>{onListening(false);listener.remove();});
 return {stop,abort:stop};
}
export const isNative=()=>Capacitor.isNativePlatform();
