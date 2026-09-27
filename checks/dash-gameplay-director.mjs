import assert from 'node:assert/strict';
import {DASH_PHYSICS,dashJumpArcProfiles,heightAtDashArcTime} from '../src/dash/dashPhysics.js';
import {DASH_SPEED_CURVE,dashSpeedForTime,dashVisibilityForViewport} from '../src/dash/dashDifficulty.js';
import {
  DASH_OBSTACLE_TYPES,
  DASH_PATTERN_DEFINITIONS,
  dashWarningReport,
  requiredDashReactionTime
} from '../src/dash/dashPatterns.js';
import {
  DASH_STAGE_IDENTITIES,
  createDashDirectorState,
  dashActionVariety,
  dashPatternPressure,
  advanceDashDirectorState
} from '../src/dash/dashDirector.js';
import {generateDashPlan,validateDashPlan} from '../src/dash/dashSimulation.js';
import {rewardDashObstaclePass,tryDashFlowSave} from '../src/dash/dashScoring.js';

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

const checkpoints=[0,60,180,360,720];
let generated=0,setPieces=0,riskPatterns=0;
for(let seed=1;seed<=96;seed++){
  for(const time of checkpoints){
    const plan=generateDashPlan({seed:`director-${seed}-${time}`,time,count:32,startX:1400,viewportWidth:600});
    const replay=generateDashPlan({seed:`director-${seed}-${time}`,time,count:32,startX:1400,viewportWidth:600});
    assert.deepEqual(plan,replay,`same seed must reproduce the same stream @ ${time}s`);
    assert.equal(plan.patterns.length,32,'director generation must remain bounded and complete');
    assert.deepEqual(validateDashPlan(plan),[],`unsafe generated plan seed=${seed} time=${time}`);
    generated+=plan.patterns.length;
    setPieces+=plan.patterns.filter(entry=>entry.pattern.setPiece).length;
    riskPatterns+=plan.patterns.filter(entry=>entry.pattern.riskReward||entry.pattern.riskRoute).length;
  }
}

assert(generated>15000,'director fuzz coverage unexpectedly small');
assert(setPieces>0,'set-piece framework should appear in long/late deterministic plans');
assert(riskPatterns>0,'risk/reward vocabulary should appear in deterministic plans');

const latePlan=generateDashPlan({seed:'late-variety',time:300,count:96,startX:1400,viewportWidth:600});
const firstActions=latePlan.patterns.map(entry=>entry.obstacles[0]?.action).filter(Boolean);
assert(new Set(firstActions).size>=3,'late runs should mix jump, high jump and slide demands');
let maxStreak=0,current=0,last=null;
for(const action of firstActions){
  current=action===last?current+1:1;
  last=action;
  maxStreak=Math.max(maxStreak,current);
}
assert(maxStreak<=6,`pathological first-action repetition detected: ${maxStreak}`);
assert(dashActionVariety(firstActions.slice(-8))>.35,'late-run action variety collapsed');

for(const pattern of DASH_PATTERN_DEFINITIONS){
  if(pattern.riskReward||pattern.riskRoute){
    assert.equal(pattern.safeRoute,true,`${pattern.id} must preserve an optional safe survival route`);
  }
  assert(!pattern.requiresCollectible,'collectibles must never be required for survival');
}

const arcs=dashJumpArcProfiles();
for(const type of DASH_OBSTACLE_TYPES.filter(type=>type.family==='short')){
  assert(arcCanClear(type,arcs.tap,DASH_SPEED_CURVE.cap),`tap jump cannot clear ${type.id}`);
}
for(const type of DASH_OBSTACLE_TYPES.filter(type=>type.family==='high'||type.family==='wide')){
  assert(arcCanClear(type,arcs.full,DASH_SPEED_CURVE.cap),`full held jump cannot clear ${type.id}`);
}
for(const type of DASH_OBSTACLE_TYPES.filter(type=>type.family==='overhead')){
  const bottom=Math.min(...type.boxes.map(box=>box[1]));
  assert(DASH_PHYSICS.colliderBottom+DASH_PHYSICS.slidingHeight<bottom,`slide cannot clear ${type.id}`);
}

const high=DASH_OBSTACLE_TYPES.find(type=>type.family==='high');
const short=DASH_OBSTACLE_TYPES.find(type=>type.family==='short');
const slide=DASH_OBSTACLE_TYPES.find(type=>type.family==='overhead');
assert(requiredDashReactionTime(high,slide,{chainLength:2})>requiredDashReactionTime(short,short,{chainLength:2}));
assert(requiredDashReactionTime(slide,high,{chainLength:2})>DASH_PHYSICS.minSlideTime+.35);
assert(requiredDashReactionTime(high,slide,{chainLength:2})>arcs.full.airTime+.20);

for(const obstacle of DASH_OBSTACLE_TYPES){
  const warning=dashWarningReport(obstacle,{
    speed:DASH_SPEED_CURVE.cap,
    viewportWidth:600,
    playerX:DASH_PHYSICS.playerX,
    obstacleWidth:obstacle.w
  });
  assert(warning.ok,`narrow logical viewport warning failed for ${obstacle.id}`);
}
assert(dashVisibilityForViewport({time:720,speed:dashSpeedForTime(720),viewportWidth:600,playerX:DASH_PHYSICS.playerX})>0);

const hard={
  id:'pressure-probe',
  difficulty:5,
  items:[['high',0],['overhead',.95],['wide',1.05]],
  recovery:.84,
  focus:'pressure'
};
const breather={
  id:'recovery-probe',
  difficulty:1,
  items:[['short',0]],
  recovery:1.25,
  recoveryClass:'breather',
  focus:'intro'
};
const pressureState=createDashDirectorState();
for(let i=0;i<4;i++)advanceDashDirectorState(pressureState,hard,[],{normalizedSpeed:1,visibility:1,stage:7});
const peak=pressureState.pressure;
assert(peak>.45,'hard sequence should build meaningful pressure');
for(let i=0;i<3;i++)advanceDashDirectorState(pressureState,breather,[],{normalizedSpeed:1,visibility:1,stage:7});
assert(pressureState.pressure<peak,'recovery sections must smoothly replenish pressure budget');
assert(pressureState.pressure>=0&&pressureState.pressure<=1.35);
assert(dashPatternPressure(hard,{normalizedSpeed:1,visibility:.8})>dashPatternPressure(breather,{normalizedSpeed:1,visibility:1}));

assert.equal(DASH_STAGE_IDENTITIES.length,7,'seven stage identities are required');
assert.equal(new Set(DASH_STAGE_IDENTITIES.map(stage=>stage.id)).size,7);

const setPiecePlan=generateDashPlan({seed:'set-piece-contract',time:240,count:8,startX:1400,viewportWidth:600});
const setPiece=setPiecePlan.patterns.find(entry=>entry.pattern.setPiece);
assert(setPiece,'late run should schedule a deterministic set piece');
assert(setPiece.pattern.setPiece.durationSeconds>=10&&setPiece.pattern.setPiece.durationSeconds<=20);
const setPieceFirst=setPiece.obstacles[0],setPieceLast=setPiece.obstacles.at(-1);
const setPiecePlayable=(setPieceLast.x+setPieceLast.w-setPieceFirst.x)/setPiece.snapshot.speed;
assert(setPiecePlayable>=10&&setPiecePlayable<=20.5,`set-piece playable span ${setPiecePlayable.toFixed(2)}s outside target`);

const scoreRun={
  flow:0,maxFlow:0,combo:0,longestCombo:0,bonus:0,
  bananaCount:0,goldenBananas:0,perfectJumps:0,perfectSlides:0,nearMisses:0,
  perfectChain:0,maxPerfectChain:0,flowSavesUsed:0
};
const perfectObstacle={action:'jump'};
rewardDashObstaclePass(scoreRun,perfectObstacle,{clearance:12,performedAction:'jump'});
const second=rewardDashObstaclePass(scoreRun,perfectObstacle,{clearance:12,performedAction:'jump'});
const third=rewardDashObstaclePass(scoreRun,perfectObstacle,{clearance:12,performedAction:'jump'});
assert.equal(scoreRun.perfectChain,3);
assert.equal(scoreRun.maxPerfectChain,3);
assert(second.rewards.some(reward=>reward.kind==='perfect-chain'));
assert(third.rewards.some(reward=>reward.kind==='perfect-chain'));
assert(scoreRun.bonus<2000,'perfect-chain bonus must stay lightweight');

const flowSaveRun={...scoreRun,flow:100,combo:12,perfectChain:3,flowSavesUsed:0};
const save=tryDashFlowSave(flowSaveRun);
assert.equal(save.saved,false,'Flow Save experiment must remain disabled by default');
assert.equal(flowSaveRun.flow,100,'disabled Flow Save must not mutate authoritative state');

console.log(JSON.stringify({
  ok:true,
  generated,
  setPieces,
  riskPatterns,
  maxFirstActionStreak:maxStreak,
  pressurePeak:Number(peak.toFixed(3)),
  pressureAfterRecovery:Number(pressureState.pressure.toFixed(3)),
  stageIdentities:DASH_STAGE_IDENTITIES.map(stage=>stage.id)
},null,2));
