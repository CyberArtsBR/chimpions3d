import {RULESET} from './physics.js';
const base=(import.meta.env.VITE_LEADERBOARD_URL||'').replace(/\/$/,'');
async function request(path,data){
 if(!base)throw new Error('Online leaderboard is not connected yet.');
 const response=await fetch(base+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Leaderboard unavailable');return result;
}
export const leaderboard={
 begin:()=>request('/api/runs',{ruleset:RULESET}),
 finish:(id,trace)=>request('/api/runs/'+id+'/finish',{trace}),
 name:(id,name)=>request('/api/runs/'+id+'/name',{name}),
 top:()=>request('/api/leaderboard'),
 records:offset=>request('/api/records?offset='+offset)
};
