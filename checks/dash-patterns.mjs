import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateDashPlan,validateDashPlan} from '../src/dash/dashSimulation.js';
import {dashSpeedForTime,dashStageForTime} from '../src/dash/dashDifficulty.js';

const START_TIMES=[0,30,60,120,180,300,600];
const SEEDS_PER_TIME=384;
const report={scope:'dash-pattern-fuzz',startTimes:START_TIMES,seedsPerTime:SEEDS_PER_TIME,totalSeeds:0,patterns:0,obstacles:0,failures:[],byTime:{}};

for(const time of START_TIMES){
  const bucket={seeds:0,patterns:0,obstacles:0,stage:dashStageForTime(time),speed:dashSpeedForTime(time)};
  for(let i=0;i<SEEDS_PER_TIME;i++){
    const seed=`dash-fuzz-${time}-${i}`;
    const plan=generateDashPlan({seed,time,count:18,startX:1400});
    const failures=validateDashPlan(plan);
    report.totalSeeds++;bucket.seeds++;bucket.patterns+=plan.patterns.length;report.patterns+=plan.patterns.length;
    for(const group of plan.patterns){
      bucket.obstacles+=group.obstacles.length;report.obstacles+=group.obstacles.length;
      for(let j=1;j<group.obstacles.length;j++){
        const prev=group.obstacles[j-1],next=group.obstacles[j];
        assert(next.x>=prev.x+prev.w,`seed ${seed} pattern ${group.id}: overlap ${prev.id}->${next.id}`);
      }
    }
    if(failures.length)report.failures.push({seed,time,stage:bucket.stage,speed:bucket.speed,failure:failures[0]});
    const replay=generateDashPlan({seed,time,count:18,startX:1400});
    assert.deepEqual(plan,replay,`non-deterministic plan for seed ${seed} @ ${time}s`);
  }
  report.byTime[time]=bucket;
}

assert(report.totalSeeds>=2000,'fuzz suite must cover thousands of deterministic seeds');
fs.writeFileSync('checks/dash-patterns-report.json',JSON.stringify(report,null,2));
if(report.failures.length){
  const f=report.failures[0];
  throw new assert.AssertionError({message:`Dash pattern invariant failed seed=${f.seed} time=${f.time}s stage=${f.stage} speed=${f.speed.toFixed(2)} failure=${JSON.stringify(f.failure)}`});
}
console.log(`PASS dash pattern fuzz: ${report.totalSeeds} seeds, ${report.patterns} patterns, ${report.obstacles} obstacles`);
