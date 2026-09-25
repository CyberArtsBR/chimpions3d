import {normalizeDashSeed,nextDashRandom} from './dashSeed.js';
import {dashSpeedForTime,dashStageForTime} from './dashDifficulty.js';
import {planDashPattern,dashTransitionReport} from './dashPatterns.js';

export function generateDashPlan({seed=1,time=0,count=20,startX=1200,currentScroll=0}={}){
  const normalized=normalizeDashSeed(seed);
  const holder={seedState:normalized};
  const patterns=[];
  let spawnX=startX,previousDifficulty=1;
  for(let i=0;i<count;i++){
    const planned=planDashPattern(holder,{time,spawnX,currentScroll,previousDifficulty});
    const jitter=.18+nextDashRandom(holder)*.24;
    spawnX=planned.nextSpawn+planned.snapshot.speed*jitter;
    previousDifficulty=planned.pattern.difficulty;
    patterns.push(planned);
    const travel=Math.max(0,spawnX-currentScroll-150);
    time+=travel/Math.max(1,dashSpeedForTime(time))*0.08;
  }
  return{seed:normalized,seedState:holder.seedState,patterns};
}

export function validateDashPlan(plan){
  const failures=[];
  for(const entry of plan.patterns){
    for(let i=1;i<entry.obstacles.length;i++){
      const previous=entry.obstacles[i-1],next=entry.obstacles[i];
      const gap=next.x-(previous.x+previous.w);
      const report=dashTransitionReport(previous,next,{gapDistance:gap,speed:next.transitionSpeed||entry.snapshot.speed,chainLength:entry.obstacles.length,requested:entry.pattern.items[i][1]});
      if(!report.ok)failures.push({patternId:entry.pattern.id,stage:entry.snapshot.stage,speed:entry.snapshot.speed,previous:previous.id,next:next.id,gap,...report});
    }
  }
  return failures;
}

export function dashTimeline(seconds=300,step=30){
  const out=[];
  for(let time=0;time<=seconds;time+=step)out.push({time,stage:dashStageForTime(time),speed:dashSpeedForTime(time)});
  return out;
}
