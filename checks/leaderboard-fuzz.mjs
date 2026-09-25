import assert from 'node:assert/strict';
import {HttpError,MAX_STEPS,validatePlayerName} from '../server/lib/protocol.mjs';
import {validateTrace} from '../server/lib/replay.mjs';

let state=0xC0FFEE;
const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
const atoms=[null,true,false,0,-1,1,1.5,NaN,Infinity,-Infinity,'0','NaN','x',{},[],[0],()=>{}];
let cases=0,rejected=0,accepted=0;
for(let i=0;i<5000;i++){
 let value;
 switch(Math.floor(random()*6)){
  case 0:value=atoms[Math.floor(random()*atoms.length)];break;
  case 1:value=[[Math.floor(random()*4005)-2002,Math.floor(random()*(MAX_STEPS*2))-MAX_STEPS]];break;
  case 2:value=Array.from({length:Math.floor(random()*8)},()=>atoms[Math.floor(random()*atoms.length)]);break;
  case 3:value=[[0,1],[0,MAX_STEPS]];break;
  case 4:value={trace:[[0,1]],unexpected:atoms[Math.floor(random()*atoms.length)]};break;
  default:value=[[0,Math.max(1,Math.floor(random()*120))]];
 }
 cases++;
 try{validateTrace(value);accepted++;}catch(error){assert.ok(error instanceof HttpError,'unexpected crash: '+(error?.stack||error));rejected++;}
}
for(const name of ['<script>','\u0000','abcdefghijk','🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂']){
 cases++;
 try{validatePlayerName(name);accepted++;}catch(error){assert.ok(error instanceof HttpError);rejected++;}
}
console.log(JSON.stringify({cases,rejected,accepted,status:'ok'}));
