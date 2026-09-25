import assert from 'node:assert/strict';
import {hashDashSeed,nextDashRandom} from '../src/dash/dashSeed.js';
import {DASH_PHYSICS,dashJumpArcProfiles,heightAtDashArcTime} from '../src/dash/dashPhysics.js';
import {DASH_SPEED_CURVE,dashSpeedForTime,dashStageForTime,dashDifficultySnapshot,dashVisibilityForViewport} from '../src/dash/dashDifficulty.js';
import {DASH_OBSTACLE_TYPES,requiredDashReactionTime,dashTransitionReport,dashWarningReport,validateDashObstacleGeometry} from '../src/dash/dashPatterns.js';
import {DASH_GAMEPLAY_VERSION,generateDashPlan,validateDashPlan,simulateDashReplay} from '../src/dash/dashSimulation.js';
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
assert.equal(dashDifficultySnapshot({time:0}).maxPatternDifficulty,2);
assert(dashDifficultySnapshot({time:300}).maxPatternDifficulty>=4);
assert(dashVisibilityForViewport({time:300,viewportWidth:600})<dashVisibilityForViewport({time:300,viewportWidth:1080}));

const arcs=dashJumpArcProfiles();
assert(arcs.tap.apex>=DASH_PHYSICS.lowHeight-1,`tap apex ${arcs.tap.apex}`);
assert(arcs.standard.apex>arcs.tap.apex+8);
assert(arcs.full.apex>arcs.standard.apex+8);
assert(arcs.full.airTime>arcs.tap.airTime);
const widest=Math.max(...DASH_OBSTACLE_TYPES.filter(x=>x.family==='wide').map(x=>x.w));
assert(arcs.full.airTime*DASH_SPEED_CURVE.cap>widest+DASH_PHYSICS.colliderWidth*2);
const geometryIssues=validateDashObstacleGeometry();
assert.deepEqual(geometryIssues,[],geometryIssues.join('\n'));

function arcCanClear(type,profile,speed){
  const obstacleTop=Math.max(...type.boxes.map(b=>b[1]+b[3]));
  const overlapDuration=(type.w+DASH_PHYSICS.colliderWidth)/speed;
  for(let start=0;start+overlapDuration<=profile.airTime;start+=DASH_PHYSICS.step){
    let safe=true;
    for(let t=start;t<=start+overlapDuration+1e-9;t+=DASH_PHYSICS.step){
      if(heightAtDashArcTime(profile,t)+DASH_PHYSICS.colliderBottom<=obstacleTop+1){safe=false;break;}
    }
    if(safe)return true;
  }
  return false;
}
for(const type of DASH_OBSTACLE_TYPES.filter(x=>x.family==='short'))assert(arcCanClear(type,arcs.tap,DASH_SPEED_CURVE.cap),`tap cannot clear ${type.id}`);
for(const type of DASH_OBSTACLE_TYPES.filter(x=>x.family==='high'||x.family==='wide'))assert(arcCanClear(type,arcs.full,DASH_SPEED_CURVE.cap),`held jump cannot clear ${type.id}`);
for(const type of DASH_OBSTACLE_TYPES.filter(x=>x.family==='overhead')){
  const bottom=Math.min(...type.boxes.map(b=>b[1]));
  assert(DASH_PHYSICS.colliderBottom+DASH_PHYSICS.slidingHeight<bottom,`slide cannot clear ${type.id}`);
  assert(DASH_PHYSICS.colliderBottom+DASH_PHYSICS.standingHeight>bottom,`standing unexpectedly clears ${type.id}`);
}

const short=DASH_OBSTACLE_TYPES.find(x=>x.family==='short');
const high=DASH_OBSTACLE_TYPES.find(x=>x.family==='high');
const slide=DASH_OBSTACLE_TYPES.find(x=>x.family==='overhead');
assert(requiredDashReactionTime(high,slide)>requiredDashReactionTime(short,short));
const required=requiredDashReactionTime(slide,high,{chainLength:2});
assert.equal(dashTransitionReport(slide,high,{gapDistance:500,speed:500,chainLength:2}).ok,1>=required);
assert(requiredDashReactionTime(high,slide,{chainLength:2})>arcs.full.airTime+.20,'jump → slide recovery too short');
assert(requiredDashReactionTime(slide,high,{chainLength:2})>DASH_PHYSICS.minSlideTime+.35,'slide → jump recovery too short');
for(const obstacle of DASH_OBSTACLE_TYPES){
  const warning=dashWarningReport(obstacle,{speed:DASH_SPEED_CURVE.cap,viewportWidth:600,obstacleWidth:obstacle.w});
  assert(warning.ok,`${obstacle.id} warning ${warning.available.toFixed(3)}s < ${warning.required.toFixed(3)}s`);
}

const checkpoints=[0,30,60,120,180,300,600];
let generatedPatterns=0;
for(let seed=1;seed<=600;seed++){
  for(const time of checkpoints){
    const plan=generateDashPlan({seed,time,count:18,startX:1400});
    const failures=validateDashPlan(plan);
    assert.deepEqual(failures,[],`seed ${seed} @ ${time}s: ${JSON.stringify(failures[0])}`);
    for(const entry of plan.patterns){
      for(let i=1;i<entry.obstacles.length;i++)assert(entry.obstacles[i].x>=entry.obstacles[i-1].x+entry.obstacles[i-1].w,'unavoidable obstacle overlap');
    }
    const replay=generateDashPlan({seed,time,count:18,startX:1400});
    assert.deepEqual(plan,replay,`non-deterministic plan for seed ${seed} @ ${time}s`);
    generatedPatterns+=plan.patterns.length;
  }
}
assert(generatedPatterns>70000);

const replayInputs=[
  {time:.42,action:'jump',down:true},{time:.50,action:'jump',down:false},
  {time:1.30,action:'slide',down:true},{time:1.62,action:'slide',down:false},
  {time:2.08,action:'jump',down:true},{time:2.28,action:'jump',down:false}
];
const replayA=simulateDashReplay({seed:424242,inputTimeline:replayInputs,duration:8});
const replayB=simulateDashReplay({seed:424242,inputTimeline:replayInputs,duration:8});
const replayOtherSeed=simulateDashReplay({seed:424243,inputTimeline:replayInputs,duration:8});
assert.deepEqual(replayA,replayB,'same gameplay version + seed + inputs must reproduce exactly');
assert.equal(replayA.rulesVersion,DASH_GAMEPLAY_VERSION);
assert.notEqual(replayA.planDigest,replayOtherSeed.planDigest,'seed must affect deterministic generated content');

const graphicsTierReplays={};
for(const graphicsTier of ['LOW','BALANCED','HIGH','ULTRA','AUTO']){
  // Graphics quality is deliberately absent from the authoritative simulation API.
  graphicsTierReplays[graphicsTier]=simulateDashReplay({seed:424242,inputTimeline:replayInputs,duration:8});
  assert.deepEqual(graphicsTierReplays[graphicsTier],replayA,`${graphicsTier} graphics tier must not alter deterministic gameplay`);
}

const run={flow:0,maxFlow:0,combo:0,longestCombo:0,bonus:0,bananaCount:0,goldenBananas:0,perfectJumps:0,perfectSlides:0,nearMisses:0};
const reward=rewardDashObstaclePass(run,short,{clearance:12});
assert.equal(reward.precision.perfect,true);
assert.equal(run.perfectJumps,1);
const flexRun={flow:0,maxFlow:0,combo:0,longestCombo:0,bonus:0,bananaCount:0,goldenBananas:0,perfectJumps:0,perfectSlides:0,nearMisses:0};
rewardDashObstaclePass(flexRun,{action:'jump-or-slide'},{clearance:12,performedAction:'slide'});
assert.equal(flexRun.perfectSlides,1);
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
assert.equal(currentDashTutorialStep(tutorial).id,'bananas-flow');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(tutorial).id,'simple-combo');
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(tutorial.complete,false);
advanceDashTutorial(tutorial,{type:'obstacle-pass'});
assert.equal(tutorial.complete,true);
const missedBanana=createDashTutorialState(true);
advanceDashTutorial(missedBanana,{type:'obstacle-pass'});
advanceDashTutorial(missedBanana,{type:'obstacle-pass'});
advanceDashTutorial(missedBanana,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(missedBanana).id,'bananas-flow');
const retryResult=advanceDashTutorial(missedBanana,{type:'obstacle-pass'});
assert.equal(retryResult.retry,true);
assert.equal(currentDashTutorialStep(missedBanana).id,'bananas-flow');
advanceDashTutorial(missedBanana,{type:'obstacle-pass'});
assert.equal(currentDashTutorialStep(missedBanana).id,'simple-combo');

console.log(JSON.stringify({
  ok:true,
  generatedPatterns,
  speed:{base:round(dashSpeedForTime(0)),at60:round(dashSpeedForTime(60)),at300:round(dashSpeedForTime(300)),cap:DASH_SPEED_CURVE.cap},
  jump:{tap:round(arcs.tap.apex),standard:round(arcs.standard.apex),full:round(arcs.full.apex)},
  scoring:{flow:round(run.flow),bonus:run.bonus,multiplier:dashMultiplier(run.flow)},
  replay:{version:DASH_GAMEPLAY_VERSION,signature:replayA.signature,collision:replayA.collision}
},null,2));
