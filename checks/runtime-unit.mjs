import assert from 'node:assert/strict';
import {InputManager} from '../src/InputManager.js';
import {RunSession,RUN_STATE} from '../src/RunSession.js';
import {InputTrace,TRACE_MAX_STEPS} from '../src/runtime/InputTrace.js';
import {installDiagnostics} from '../src/Diagnostics.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
{
 const session=new RunSession({beginOnline:async()=>({id:'online',seed:123}),randomSeed:()=>999,retryCooldownMs:0});await session.prepare();assert.equal(session.state,RUN_STATE.ONLINE_READY);const run=session.commit();assert.equal(run.seed,123);assert.equal(run.online,true);
}
for(const kind of ['500','404','refused','abort','timeout']){
 const session=new RunSession({beginOnline:async()=>{throw new Error(kind);},randomSeed:()=>777,retryCooldownMs:0});await session.prepare();const run=session.commit();assert.equal(run.seed,777);assert.equal(run.online,false);
}
{
 const slow=deferred();const session=new RunSession({beginOnline:()=>slow.promise,randomSeed:()=>456,retryCooldownMs:0});session.prepare();const run=session.commit();assert.equal(run.seed,456);assert.equal(run.online,false);slow.resolve({id:'late',seed:999});await slow.promise;await Promise.resolve();assert.equal(session.current.seed,456);assert.equal(session.onlineSubmitCapable,false,'late ticket must not upgrade an offline run');
}
{
 const session=new RunSession({beginOnline:async()=>({id:'x',seed:9}),randomSeed:()=>1});const replay=session.commit({replaySeed:42});assert.equal(replay.practice,true);assert.equal(replay.online,false);assert.equal(replay.seed,42);
}
{
 let pads=[];const events=[];const manager=new InputManager({target:{addEventListener(){},removeEventListener(){}},doc:{body:{dataset:{mode:'playing'}}},nav:{getGamepads:()=>pads},autoStart:false});manager.subscribe(e=>events.push(e));
 manager.handleKeyDown({code:'ArrowRight',repeat:false,target:null,preventDefault(){}});manager.mouseTarget=-10;assert.equal(manager.getMoveX({x:0,vx:0}),1,'digital keyboard must outrank mouse');manager.handleKeyUp({code:'ArrowRight'});assert.equal(manager.getMoveX({x:0,vx:0}),-1,'mouse resumes after keyboard release');
 const buttons=()=>Array.from({length:16},()=>({pressed:false}));let b=buttons();pads=[{connected:true,index:0,id:'Xbox',axes:[.8,0],buttons:b}];manager.pollGamepads();assert(manager.getMoveX({x:0,vx:0})>0);b=buttons();b[0].pressed=true;pads=[{connected:true,index:0,id:'Xbox',axes:[0,1],buttons:b}];manager.pollGamepads();manager.pollGamepads();assert.equal(events.filter(e=>e.confirmPressed).length,1,'confirm must be edge-triggered');assert(events.some(e=>e.menuY===1),'controller menu navigation must emit one direction edge');b=buttons();b[9].pressed=true;pads=[{connected:true,index:0,id:'Xbox',axes:[0,0],buttons:b}];manager.pollGamepads();manager.pollGamepads();assert.equal(events.filter(e=>e.pausePressed).length,1,'pause must be edge-triggered');pads=[];manager.pollGamepads();assert.equal(manager.getMoveX({x:0,vx:0}),0);assert.equal(manager.snapshot().connected,false);manager.destroy();
}
{
 const trace=new InputTrace();for(let i=0;i<TRACE_MAX_STEPS;i++)trace.append((i%251-125)/125);const compact=trace.toCompact();assert.equal(trace.steps,TRACE_MAX_STEPS);assert(compact.data.length<450000,'worst-case compact trace must remain comfortably below current body cap');assert.equal(trace.toLegacy()[0][0],-1000);trace.append(0);assert.equal(trace.overflowed,true,'trace growth must be bounded');
}
{
 const target={};installDiagnostics(target,()=>({ready:true,mode:'menu',platformTypes:['solid']}));assert(Object.isFrozen(target.chimpJumpDiagnostics));const snap=target.chimpJumpDiagnostics.snapshot();assert(Object.isFrozen(snap));assert(Object.isFrozen(snap.platformTypes));assert.equal(snap.ready,true);assert.throws(()=>{target.chimpJumpDiagnostics={};},TypeError);
}
console.log('PASS runtime unit: online/offline session races, input precedence/edges/disconnect, trace bounds, readonly diagnostics');
