import {RULESET} from './physics.js';
const base=(import.meta.env.VITE_LEADERBOARD_URL||'').replace(/\/$/,'');
const useCompactTrace=import.meta.env.VITE_LEADERBOARD_TRACE_V2==='1';

async function request(path,data,{signal,timeoutMs=15000}={}){
 if(!base)throw new Error('Online leaderboard is not connected yet.');
 const timeout=AbortSignal.timeout(timeoutMs),requestSignal=signal&&AbortSignal.any?AbortSignal.any([signal,timeout]):signal||timeout;
 const response=await fetch(base+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,signal:requestSignal});
 const text=await response.text();let result={};if(text)try{result=JSON.parse(text);}catch{if(!response.ok)throw new Error('Leaderboard unavailable');throw new Error('Invalid leaderboard response');}
 if(!response.ok)throw new Error(result.error||'Leaderboard unavailable');return result;
}
export const leaderboard={
 begin:options=>request('/api/runs',{ruleset:RULESET},options),
 finish:(id,trace)=>{
  const payload=Array.isArray(trace)?trace:(useCompactTrace&&trace?.compact?trace.compact:trace?.legacy);
  return request('/api/runs/'+id+'/finish',{trace:payload});
 },
 name:(id,name)=>request('/api/runs/'+id+'/name',{name}),
 top:()=>request('/api/leaderboard'),
 records:offset=>request('/api/records?offset='+offset)
};
