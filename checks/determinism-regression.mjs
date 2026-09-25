import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {Game,STEP} from '../src/physics.js';
import {scoreFor} from '../src/score.js';

function inputAt(seed,tick){
  const phase=(tick+seed*17)%240;
  if(phase<70)return -1;
  if(phase<110)return 0;
  if(phase<190)return 1;
  return 0;
}
function snap(g){
  return {
    time:Number(g.time.toFixed(9)),x:Number(g.x.toFixed(9)),y:Number(g.y.toFixed(9)),
    vx:Number(g.vx.toFixed(9)),vy:Number(g.vy.toFixed(9)),height:Number(g.height.toFixed(9)),
    bounces:g.bounces,bananas:g.bananas,score:scoreFor(g.height,g.bananas),dead:g.dead,jetRemaining:Number(g.jetRemaining.toFixed(9)),
    event:g.event?{type:g.event.type,endsAt:Number(g.event.endsAt?.toFixed?.(9)??g.event.endsAt)}:null,
    platforms:g.platforms.map(p=>[p.id,p.type,Number(p.x.toFixed(8)),Number(p.y.toFixed(8)),!!p.broken,!!p.coin]),
    hazards:g.hazards.map(h=>[h.id,h.type,Number(h.x.toFixed(8)),Number(h.y.toFixed(8))])
  };
}

const seeds=Array.from({length:64},(_,i)=>(i*2654435761)>>>0),digests=[];
let transitions=0;
for(const seed of seeds){
  const a=new Game(seed),b=new Game(seed);
  for(let tick=0;tick<3600;tick++){
    const control=inputAt(seed,tick);
    const ea=a.step(control,STEP),eb=b.step(control,STEP);
    assert.deepEqual(ea,eb,`seed ${seed} tick ${tick}: event stream diverged`);
    if(tick%120===0||a.dead||b.dead)assert.deepEqual(snap(a),snap(b),`seed ${seed} tick ${tick}: state diverged`);
    transitions+=ea.length;
    if(a.dead||b.dead){assert.equal(a.dead,b.dead);break;}
  }
  const final=snap(a);
  digests.push(crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex'));
}
assert.equal(digests.length,seeds.length);
const report={status:'PASS',suite:'determinism-regression',seedCount:seeds.length,maxStepsPerSeed:3600,step:STEP,eventTransitions:transitions,digests};
fs.writeFileSync('checks/determinism-report.json',JSON.stringify(report,null,2));
console.log('PASS deterministic gameplay across '+seeds.length+' seeded simulations');
