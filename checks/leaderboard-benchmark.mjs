import {performance} from 'node:perf_hooks';
import {Game,STEP} from '../src/physics.js';
import {MAX_STEPS} from '../server/lib/protocol.mjs';
import {replayRun} from '../server/lib/replay.mjs';

const seed=2;
function buildTrace(neutralSteps){
 const game=new Game(seed);let neutral=0;
 while(!game.dead&&neutral<neutralSteps){game.step(0,STEP);neutral++;}
 let exit=0;
 while(!game.dead&&neutral+exit<MAX_STEPS){game.step(1,STEP);exit++;}
 if(!game.dead)throw new Error('benchmark trace did not finish within '+MAX_STEPS+' steps');
 return [[0,neutral],[1000,exit]];
}
const cases=[['~1 minute',3600,20],['~5 minutes',18000,10],['~10 minutes',36000,6],['maximum allowed',107000,3]];
for(const [label,neutralSteps,repeats] of cases){
 const trace=buildTrace(neutralSteps);replayRun(seed,trace);
 const start=performance.now();
 for(let i=0;i<repeats;i++)replayRun(seed,trace);
 const elapsed=performance.now()-start;
 const steps=trace.reduce((sum,segment)=>sum+segment[1],0);
 console.log(JSON.stringify({label,steps,simulatedSeconds:steps*STEP,repeats,meanReplayMs:elapsed/repeats,simulationSpeedup:(steps*STEP*1000)/(elapsed/repeats)}));
}
