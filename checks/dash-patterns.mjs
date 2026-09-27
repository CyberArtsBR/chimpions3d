import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateDashPlan,validateDashPlan,DASH_GAMEPLAY_VERSION} from '../src/dash/dashSimulation.js';
import {dashSpeedForTime,dashStageForTime,dashVisibilityForViewport} from '../src/dash/dashDifficulty.js';
import {DASH_PHYSICS} from '../src/dash/dashPhysics.js';

const START_TIMES=[0,30,60,120,180,300,600];
const VIEWPORTS=[
  ['1920x1080',1920,1080],['1600x900',1600,900],['1440x900',1440,900],['1366x768',1366,768],
  ['2560x1080',2560,1080],['390x844',390,844],['430x932',430,932],['844x390',844,390]
];
const SEEDS_PER_CASE=64;
const logicalWidth=(w,h)=>Math.max(600,Math.min(1080,w/h*500));
const report={scope:'dash-pattern-fuzz',gameplayVersion:DASH_GAMEPLAY_VERSION,startTimes:START_TIMES,viewports:VIEWPORTS.map(([name,width,height])=>({name,width,height,logicalWidth:logicalWidth(width,height)})),seedsPerCase:SEEDS_PER_CASE,totalSeeds:0,patterns:0,obstacles:0,failures:[],cases:{}};

for(const [viewport,width,height] of VIEWPORTS){
  const vw=logicalWidth(width,height);
  for(const time of START_TIMES){
    const visibility=dashVisibilityForViewport({time,speed:dashSpeedForTime(time),viewportWidth:vw,playerX:DASH_PHYSICS.playerX});
    const key=`${viewport}@${time}`,bucket={viewport,width,height,logicalWidth:vw,time,seeds:0,patterns:0,obstacles:0,stage:dashStageForTime(time),speed:dashSpeedForTime(time),visibility};
    for(let i=0;i<SEEDS_PER_CASE;i++){
      const seed=`dash-fuzz-${viewport}-${time}-${i}`;
      const plan=generateDashPlan({seed,time,count:18,startX:vw+360,visibility});
      const failures=validateDashPlan(plan,{viewportWidth:vw,playerX:DASH_PHYSICS.playerX});
      report.totalSeeds++;bucket.seeds++;bucket.patterns+=plan.patterns.length;report.patterns+=plan.patterns.length;
      for(const group of plan.patterns){
        bucket.obstacles+=group.obstacles.length;report.obstacles+=group.obstacles.length;
        for(let j=1;j<group.obstacles.length;j++){
          const prev=group.obstacles[j-1],next=group.obstacles[j];
          assert(next.x>=prev.x+prev.w,`seed ${seed} viewport ${viewport} pattern ${group.pattern.id}: overlap ${prev.id}->${next.id}`);
        }
      }
      if(failures.length)report.failures.push({...failures[0],seedText:seed,viewport:{name:viewport,width,height,logicalWidth:vw}});
      const replay=generateDashPlan({seed,time,count:18,startX:vw+360,visibility});
      assert.deepEqual(plan,replay,`non-deterministic plan seed=${seed} viewport=${viewport} time=${time}s`);
    }
    report.cases[key]=bucket;
  }
}

assert(report.totalSeeds>=3000,'fuzz suite must cover thousands of deterministic viewport/stage seeds');
fs.writeFileSync('checks/dash-patterns-report.json',JSON.stringify(report,null,2));
if(report.failures.length){
  const f=report.failures[0];
  throw new assert.AssertionError({message:[
    'Dash pattern invariant failed',
    `seed=${f.seedText} normalizedSeed=${f.seed} gameplayVersion=${f.gameplayVersion}`,
    `gameTime=${f.gameTime}s stage=${f.stage} speed=${Number(f.speed).toFixed(2)} viewport=${JSON.stringify(f.viewport)}`,
    `previousPattern=${f.previousPattern} nextPattern=${f.nextPattern} previousAction=${f.previousAction} nextAction=${f.nextAction}`,
    `obstacleIds=${JSON.stringify(f.obstacleIds)} availableReactionTime=${f.availableReactionTime} requiredReactionTime=${f.requiredReactionTime} calculatedGap=${f.calculatedGap} kind=${f.kind}`
  ].join(' | ')});
}
console.log(`PASS dash pattern fuzz: ${report.totalSeeds} viewport/stage seeds, ${report.patterns} patterns, ${report.obstacles} obstacles`);
