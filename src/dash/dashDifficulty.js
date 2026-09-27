import {dashPressureCapacity} from './dashDirector.js';

export const DASH_SPEED_CURVE=Object.freeze({
  base:397.5,
  cap:610,
  timeConstant:155,
  stageSeconds:30
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function dashStageForTime(time){
  return Math.floor((Math.max(0,time)+1e-7)/DASH_SPEED_CURVE.stageSeconds)+1;
}

export function dashSpeedForTime(time,{unlimited=false}={}){
  const t=Math.max(0,time);
  const c=DASH_SPEED_CURVE;
  if(unlimited){
    const normal=c.base+(c.cap-c.base)*(1-Math.exp(-t/c.timeConstant));
    return normal+Math.max(0,t-480)*.18;
  }
  return c.base+(c.cap-c.base)*(1-Math.exp(-t/c.timeConstant));
}

export function dashNormalizedSpeed(time){
  const c=DASH_SPEED_CURVE;
  return clamp((dashSpeedForTime(time)-c.base)/(c.cap-c.base),0,1);
}

export function dashDifficultyForTime(time){
  const t=Math.max(0,time);
  return Math.min(5,1+4*(1-Math.exp(-t/145)));
}

export function dashVisibilityForViewport({time=0,speed=dashSpeedForTime(time),viewportWidth=1080,playerX=150}={}){
  const usable=Math.max(0,viewportWidth-playerX);
  const targetDistance=Math.max(1,speed)*.90;
  return clamp(usable/targetDistance,0,1);
}

export function dashDifficultySnapshot({
  time=0,
  previousDifficulty=1,
  previousAction=null,
  recentPressure=0,
  recentRecovery=1,
  recentActionVariety=.5,
  visibility=1
}={}){
  const target=dashDifficultyForTime(time);
  const stage=dashStageForTime(time);
  const normalizedSpeed=dashNormalizedSpeed(time);
  const safeVisibility=clamp(visibility,0,1);
  const pressure=clamp(recentPressure,0,1.35);
  const pressureCapacity=dashPressureCapacity({stage,normalizedSpeed,visibility:safeVisibility});
  const pressureHeadroom=pressureCapacity-pressure;

  // Continuous pressure shaping replaces the old hard "difficult -> easy" clamp.
  // Pressure can temporarily soften selection, but never forces an abrupt tier reset.
  const pressurePenalty=clamp(pressure*.36+Math.max(0,pressure-pressureCapacity)*.52,0,.72);
  const visibilityPenalty=(1-safeVisibility)*.46;
  const recoveryBonus=clamp((recentRecovery-.78)*.28,-.18,.16);
  const varietyBonus=clamp((recentActionVariety-.5)*.26,-.14,.14);
  const momentum=Math.max(0,previousDifficulty-target)*.04;

  let effective=target-pressurePenalty-visibilityPenalty+recoveryBonus+varietyBonus-momentum;
  effective=clamp(effective,1,5);

  return{
    time,
    stage,
    speed:dashSpeedForTime(time),
    normalizedSpeed,
    previousAction,
    visibility:safeVisibility,
    targetDifficulty:target,
    effectiveDifficulty:effective,
    pressure,
    pressureCapacity,
    pressureHeadroom,
    recentRecovery,
    recentActionVariety,
    maxPatternDifficulty:Math.max(2,Math.min(5,Math.floor(effective+.45)))
  };
}

export function dashPlanningSpeed({runTime,worldDistance,currentScroll=0,playerX=150}){
  const remaining=Math.max(0,worldDistance-currentScroll-playerX);
  let arrival=runTime+remaining/Math.max(1,dashSpeedForTime(runTime));
  for(let i=0;i<2;i++){
    const avg=(dashSpeedForTime(runTime)+dashSpeedForTime(arrival))/2;
    arrival=runTime+remaining/Math.max(1,avg);
  }
  return dashSpeedForTime(arrival);
}
