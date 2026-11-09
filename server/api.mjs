import {MONSTERS} from '../src/game.mjs';

const PROVIDERS={
 openai:{key:'OPENAI_API_KEY',model:'OPENAI_MODEL',defaultModel:'gpt-4.1-mini',url:'https://api.openai.com/v1/chat/completions'},
 anthropic:{key:'ANTHROPIC_API_KEY',model:'ANTHROPIC_MODEL',defaultModel:'claude-sonnet-4-20250514',url:'https://api.anthropic.com/v1/messages'},
 ollama:{key:'OLLAMA_API_KEY',model:'OLLAMA_MODEL',defaultModel:'gpt-oss:120b',url:'https://ollama.com/api/chat'}
};
const counters=new Map();
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
export async function handleAPI(request,env={},fetcher=fetch){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const nativeOrigins=(env.NATIVE_ALLOWED_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(origin&&origin!==url.origin&&!nativeOrigins.includes(origin))return json({error:'This origin is not allowed.'},403);
 const cors=origin&&nativeOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}:{};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(url.pathname==='/api/status'&&request.method==='GET')return json({providers:Object.fromEntries(Object.entries(PROVIDERS).map(([id,p])=>[id,Boolean(env[p.key])]))},200,cors);
 if(url.pathname!=='/api/chat')return json({error:'Route not found.'},404,cors);
 if(request.method!=='POST')return json({error:'Use POST.'},405,{...cors,Allow:'POST'});
 // Hosted access is enforced by Sites. Explicit native origins additionally require a verified bearer token.
 if(origin&&nativeOrigins.includes(origin)&&(!env.NATIVE_API_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.NATIVE_API_TOKEN}`))return json({error:'Native AI access requires an authenticated API deployment. See the mobile release guide.'},401,cors);
 const length=Number(request.headers.get('Content-Length')||0);if(length>16000)return json({error:'Message history is too large.'},413,cors);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Send JSON.'},415,cors);
 let body;try{const raw=await request.text();if(raw.length>16000)return json({error:'Message history is too large.'},413,cors);body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400,cors);}
 const provider=PROVIDERS[body.provider];if(!provider)return json({error:'Choose OpenAI, Ollama Cloud, or Anthropic.'},400,cors);
 const monster=MONSTERS.find(m=>m.id===body.monsterId);if(!monster)return json({error:'Unknown monster.'},400,cors);
 if(!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>10||body.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000)||body.messages.at(-1).role!=='user')return json({error:'Send 1–10 valid messages ending with a user message.'},400,cors);
 if(!env[provider.key])return json({error:`${body.provider==='ollama'?'Ollama Cloud':body.provider==='openai'?'OpenAI':'Anthropic'} is not configured on this server. Choose Built-in personality to chat immediately.`},503,cors);
 const identity=request.headers.get('oai-authenticated-user-id')||request.headers.get('CF-Connecting-IP')||'local';
 const minute=Math.floor(Date.now()/60000);const count=counters.get(identity);if(count?.minute===minute&&count.n>=12)return json({error:'Your companion needs a moment. Try again in a minute.'},429,{...cors,'Retry-After':'60'});
 counters.set(identity,{minute,n:count?.minute===minute?count.n+1:1});if(counters.size>1000)for(const [k,v]of counters)if(v.minute<minute)counters.delete(k);
 const system=`You are ${monster.name}, ${monster.title}, an original ${monster.element} monster companion in Battle Monsters Mobile. Your personality is ${monster.personality}. Lore: ${monster.lore} Signature skill: ${monster.ability}. Stay in character, friendly, concise, and suitable for a general audience. Address the player as Summoner. You cannot change game state or grant rewards. Do not imply you have done so. Never request personal information. If asked about strategy: Strike builds 1 energy, Guard builds 2 energy and heals 8 HP with 55% damage reduction, and signature moves cost 2 energy. Win rewards: 150 essence and 100 XP. Keep answers under 100 words.`;
 const model=env[provider.model]||provider.defaultModel;
 const messages=[...body.messages];while(messages[0]?.role==='assistant')messages.shift();
 let payload,headers={'Content-Type':'application/json'};
 if(body.provider==='anthropic'){headers['x-api-key']=env[provider.key];headers['anthropic-version']='2023-06-01';payload={model,max_tokens:220,system,messages};}
 else{headers.Authorization=`Bearer ${env[provider.key]}`;payload={model,messages:[{role:'system',content:system},...messages],...(body.provider==='ollama'?{stream:false,options:{num_predict:220}}:{max_tokens:220})};}
 try{const response=await fetcher(provider.url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});if(!response.ok)return json({error:response.status===429?'The AI provider is busy. Try again shortly.':'The AI provider could not respond. Check its server credential and model configuration.'},502,cors);const data=await response.json();const reply=body.provider==='anthropic'?data.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n'):body.provider==='ollama'?data.message?.content:data.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())return json({error:'The AI provider returned an empty response.'},502,cors);return json({reply:reply.slice(0,4000),provider:body.provider},200,cors);}catch{return json({error:'The companion service timed out or could not connect. Try again, or choose Built-in personality.'},504,cors);}
}
