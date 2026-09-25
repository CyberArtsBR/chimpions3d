import assert from 'node:assert/strict';
import {hashDashSeed,nextDashRandom} from '../src/dash/dashSeed.js';
import {DASH_PHYSICS,dashJumpArcProfiles} from '../src/dash/dashPhysics.js';
import {DASH_SPEED_CURVE,dashSpeedForTime,dashStageForTime,dashDifficultySnapshot} from '../src/dash/dashDifficulty.js';
import {DASH_OBSTACLE_TYPES,requiredDashReactionTime,dashTransitionReport,validateDashObstacleGeometry} from '../src/dash/dashPatterns.js';
import {generateDashPlan,validateDashPlan} from '../src/dash/dashSimulation.js';
import {dashMultiplier,dashFlowDecay,rewardDashObstaclePass,rewardDashBanana} from '../src/dash/dashScoring.js';
import {createDashTutorialState,currentDashTutorialStep,advanceDashTutorial,dashTutorialPattern} from '../src/dash/dashTutorial.js';

const round=n=>Math.round(n*1000)/1000;

assert.equal(hashDashSeed('abc'),hashDashSeed('abc'));
const ra={seedState:hashDashSeed('seed')},rb={seedState:hashDashSeed('seed')};
for(let i=0;i<1000;i++)assert.equal(nextDashRandom(ra),nextDashRandom(rb));

let previous=dashSpeedForTime(0);
for(let t=1;t<=1800;t++){
  const speed=dashSpeedForTime(t);
  assert(speed>=previous-1e-9,`speed regressed at ${t}s`);
  assert(speed<=DASH_SPEED_CURVE.cap+1e-6,`speed exceeded cap at ${t}s`);
  previous=speed;
}
for(let t=30;t<=300;t+=30){
  const before=dashSpeedForTime(t-1/120),after=dashSpeedForTime(t+1/120);
  assert((after-before)/before<.001,`stage boundary speed spike at ${t}s`);
}
assert.equal(dashStageForTime(0),1);
assert.equal(dashStageForTime(30),2);
assert(dashDifficultySnapshot({time:300}).maxPatternDifficulty>=4);

const arcs=dashJumpArcProfiles();
assert(arcs.tap.apex>=DASH_PHYSICS.lowHeight-1,`tap apex ${arcs.tap.apex}`);
assert(arcs.standard.apex>arcs.tap.apex+8);
assert(arcs.full.apex>arcs.standard.apex+8);
assert(arcs.full.airTime>arcs.tap.airTime);
const geometryIssues=validateDashObstacleGeometry();
assert.deepEqual(geometryIssues,[],geometryIssues.join('\n'));

const short=DASH_OBSTACLE_TYPES.find(x=>x.family==='short');
const high=DASH_OBSTACLE_TYPES.find(x=>x.family==='high');
const slide=DASH_OBSTACLE_TYPES.find(x=>x.family==='overhead');
assert(requiredDashReactionTime(high,slide)>requiredDashReactionTime(short,short));
const required=requiredDashReactionTime(slide,high,{chainLength:2});
assert.equal(dashTransitionReport(slide,high,{gapDistance:500,speed:500,chainLength:2}).ok,1>=required);

const checkpoints=[0,30,60,120,180,300,600];
let generatedPatterns=0;
for(let seed=1;seed<=600;seed++){
  for(const time of checkpoints){
    const plan=generateDashPlan({seed,time,count:18,startX:1400});
    const failures=validateDashPlan(plan);
    assert.deepEqual(failures,[],`seed ${seed} @ ${time}s: ${JSON.stringify(failures[0])}`);
    const replay=generateDashPlan({seed,time,count:18,startX:1400});
    assert.deepEqual(plan,replay,`non-deterministic plan for seed ${seed} @ ${time}s`);
    generatedPatterns+=plan.patterns.length;
  }
}
assert(generatedPatterns>70000);

const run={flow:0,maxFlow:0,combo:0,longestCombo:0,bonus:0,bananaCount:0,goldenBananas:0,perfectJumps:0,perfectSlides:0,nearMisses:0};
const reward=rewardDashObstaclePass(run,short,{clearance:12});
assert.equal(reward.precision.perfect,true);
assert.equal(run.perfectJumps,1);
assert(run.flow>0&&run.bonus>0);
const beforeBanana=run.bonus;
rewardDashBanana(run,false);
rewardDashBanana(run,true);
assert.equal(run.bananaCount,2);
assert.equal(run.goldenBananas,1);
assert(run.bonus>beforeBanana);
const multBefore=dashMultiplier(run.flow);
dashFlowDecay(run,10);
assert(run.flow>=0&&dashMultiplier(run.flow)<=multBefore);

const tutorial=createDashTutorialState(true);
assert.equal(currentDashTutorialStep(tutorial).id,'tap-jump');
assert.equal(dashTutorialPattern(tutorial).items[0][0],'short');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(tutorial).id,'hold-jump');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(tutorial).id,'slide');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(tutorial).id,'bananas-flow');
advanceDashTutorial(tutorial,{type:'banana'});
assert.equal(currentDashTutorialStep(tutorial).id,'simple-combo');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(tutorial.complete,false);
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(tutorial.complete,true);

console.log(JSON.stringify({
  ok:true,
  generatedPatterns,
  speed:{base:round(dashSpeedForTime(0)),at60:round(dashSpeedForTime(60)),at300:round(dashSpeedForTime(300)),cap:DASH_SPEED_CURVE.cap},
  jump:{tap:round(arcs.tap.apex),standard:round(arcs.standard.apex),full:round(arcs.full.apex)},
  scoring:{flow:round(run.flow),bonus:run.bonus,multiplier:dashMultiplier(run.flow)}
},null,2));
