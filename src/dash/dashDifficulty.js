export const DASH_SPEED_CURVE=Object.freeze({
  base:397.5,
  cap:610,
  timeConstant:155,
  stageSeconds:30
});

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
  return Math.max(0,Math.min(1,(dashSpeedForTime(time)-c.base)/(c.cap-c.base)));
}

export function dashDifficultyForTime(time){
  const t=Math.max(0,time);
  return Math.min(5,1+4*(1-Math.exp(-t/145)));
}

export function dashVisibilityForViewport({time=0,speed=dashSpeedForTime(time),viewportWidth=1080,playerX=150}={}){
  const usable=Math.max(0,viewportWidth-playerX);
  const targetDistance=Math.max(1,speed)*.90;
  return Math.max(0,Math.min(1,usable/targetDistance));
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
  const pressurePenalty=Math.max(0,Math.min(1,recentPressure))*.55;
  const visibilityPenalty=(1-Math.max(0,Math.min(1,visibility)))*.45;
  const recoveryBonus=Math.max(-.35,Math.min(.35,(recentRecovery-.85)*.4));
  const varietyBonus=Math.max(-.2,Math.min(.2,(recentActionVariety-.5)*.35));
  let effective=target-pressurePenalty-visibilityPenalty+recoveryBonus+varietyBonus;
  if(previousDifficulty>=4.5&&recentRecovery<.8)effective=Math.min(effective,2.6);
  effective=Math.max(1,Math.min(5,effective));
  return{
    time,
    stage:dashStageForTime(time),
    speed:dashSpeedForTime(time),
    normalizedSpeed:dashNormalizedSpeed(time),
    previousAction,
    visibility:Math.max(0,Math.min(1,visibility)),
    targetDifficulty:target,
    effectiveDifficulty:effective,
    maxPatternDifficulty:Math.max(2,Math.min(5,Math.floor(effective+.35)))
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
