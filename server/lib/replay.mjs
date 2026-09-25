import {createHash} from 'node:crypto';
import {Game,STEP,RULESET} from '../../src/physics.js';
import {scoreFor} from '../../src/score.js';
import {fail,MAX_STEPS,MAX_TRACE_SEGMENTS,MAX_SEGMENT_STEPS,TRACE_VERSION,TIMING_GRACE_MS} from './protocol.mjs';

export const CURRENT_RULESET_VERSION=RULESET;
export function validateTrace(trace,traceVersion=TRACE_VERSION){
 if(traceVersion!==TRACE_VERSION)fail(400,'UNSUPPORTED_TRACE_VERSION','Unsupported input trace version');
 if(!Array.isArray(trace))fail(400,'INVALID_TRACE','Input trace must be an array');
 if(trace.length>MAX_TRACE_SEGMENTS)fail(400,'TRACE_TOO_MANY_SEGMENTS','Input trace has too many segments');
 let steps=0;
 for(const segment of trace){
  if(!Array.isArray(segment)||segment.length!==2)fail(400,'INVALID_TRACE','Each input segment must be [axis,count]');
  const [axis,count]=segment;
  if(!Number.isInteger(axis)||axis<-1000||axis>1000)fail(400,'INVALID_TRACE','Trace axis must be an integer from -1000 to 1000');
  if(!Number.isInteger(count)||count<1||count>MAX_SEGMENT_STEPS)fail(400,'INVALID_TRACE','Trace count is outside the supported range');
  steps+=count;if(steps>MAX_STEPS)fail(400,'TRACE_TOO_MANY_STEPS','Input trace exceeds the maximum simulation steps');
 }
 return {steps};
}
export function traceDigest(trace,traceVersion=TRACE_VERSION){
 return createHash('sha256').update(JSON.stringify({traceVersion,trace})).digest('hex');
}
export function replayRun(seed,trace,traceVersion=TRACE_VERSION){
 const {steps}=validateTrace(trace,traceVersion);const game=new Game(seed);
 for(const [axis,count] of trace){
  for(let i=0;i<count;i++){
   if(game.dead)fail(400,'INPUT_AFTER_GAME_OVER','Input trace continues after game over');
   game.step(axis/1000,STEP);
  }
 }
 if(!game.dead)fail(400,'RUN_NOT_FINISHED','Run has not ended');
 return {meters:Math.floor(game.height),bananas:game.bananas,score:scoreFor(game.height,game.bananas),steps,seconds:steps*STEP};
}
export function validateRunTiming(startedAt,submittedAt,simulatedSeconds,{graceMs=TIMING_GRACE_MS}={}){
 const elapsedMs=submittedAt-startedAt;if(!Number.isFinite(elapsedMs)||elapsedMs<0)fail(400,'TIMING_REJECTED','Run timing is invalid');
 const minimumElapsedMs=Math.max(0,simulatedSeconds*1000-graceMs);
 if(elapsedMs<minimumElapsedMs)fail(400,'TIMING_REJECTED','Run was submitted too quickly for its simulated duration');
 return {elapsedMs,minimumElapsedMs};
}
