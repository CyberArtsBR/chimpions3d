export const DASH_FLOW=Object.freeze({
  max:100,
  decayPerSecond:2.05,
  passGain:4,
  bananaGain:3,
  goldenGain:30,
  perfectGain:8,
  nearMissGain:6,
  riskGain:10
});

export const DASH_REWARDS=Object.freeze({
  pass:5,
  banana:25,
  goldenBanana:500,
  perfect:75,
  nearMiss:50,
  riskLine:125
});

export function dashMultiplier(flow){
  return flow>=100?5:flow>=80?3:flow>=60?2:flow>=40?1.5:flow>=20?1.25:1;
}

export function dashFlowGain(run,amount){
  const before=run.flow;
  const multiplierBefore=dashMultiplier(before);
  run.flow=Math.min(DASH_FLOW.max,run.flow+amount);
  run.maxFlow=Math.max(run.maxFlow,run.flow);
  return{before,after:run.flow,multiplierBefore,multiplierAfter:dashMultiplier(run.flow)};
}

export function dashFlowDecay(run,dt){
  const before=run.flow;
  const multiplierBefore=dashMultiplier(before);
  run.flow=Math.max(0,run.flow-dt*DASH_FLOW.decayPerSecond);
  return{before,after:run.flow,multiplierBefore,multiplierAfter:dashMultiplier(run.flow)};
}

export function dashAward(run,base){
  const amount=Math.round(base*dashMultiplier(run.flow));
  run.bonus+=amount;
  return amount;
}

export function dashPrecisionFromClearance(action,clearance){
  if(!Number.isFinite(clearance)||clearance<0)return{nearMiss:false,perfect:false};
  const nearLimit=action==='slide'?5:7;
  const perfectLimit=action==='slide'?18:20;
  return{
    nearMiss:clearance<=nearLimit,
    perfect:clearance>nearLimit&&clearance<=perfectLimit
  };
}

export function dashObstacleClearance(player,boxes){
  let best=Infinity;
  for(const b of boxes){
    const overlapX=player.x<b.x+b.w&&player.x+player.w>b.x;
    if(!overlapX)continue;
    const gapAbove=player.y-(b.y+b.h);
    const gapBelow=b.y-(player.y+player.h);
    if(gapAbove>=0)best=Math.min(best,gapAbove);
    else if(gapBelow>=0)best=Math.min(best,gapBelow);
    else return-1;
  }
  return best;
}

export function rewardDashObstaclePass(run,obstacle,{clearance=Infinity,riskLine=false,performedAction=null}={}){
  const precisionAction=performedAction||obstacle.action;
  run.combo++;
  run.longestCombo=Math.max(run.longestCombo,run.combo);
  dashFlowGain(run,DASH_FLOW.passGain);
  const rewards=[{kind:'pass',points:dashAward(run,DASH_REWARDS.pass)}];
  const precision=dashPrecisionFromClearance(precisionAction,clearance);
  if(precision.nearMiss){
    run.nearMisses=(run.nearMisses||0)+1;
    dashFlowGain(run,DASH_FLOW.nearMissGain);
    rewards.push({kind:'near-miss',points:dashAward(run,DASH_REWARDS.nearMiss)});
  }else if(precision.perfect){
    if(precisionAction==='slide')run.perfectSlides=(run.perfectSlides||0)+1;
    else run.perfectJumps=(run.perfectJumps||0)+1;
    dashFlowGain(run,DASH_FLOW.perfectGain);
    rewards.push({kind:precisionAction==='slide'?'perfect-slide':'perfect-jump',points:dashAward(run,DASH_REWARDS.perfect)});
  }
  if(riskLine){
    dashFlowGain(run,DASH_FLOW.riskGain);
    rewards.push({kind:'risk-line',points:dashAward(run,DASH_REWARDS.riskLine)});
  }
  return{precision,rewards};
}

export function rewardDashBanana(run,golden=false){
  run.bananaCount++;
  if(golden)run.goldenBananas++;
  dashFlowGain(run,golden?DASH_FLOW.goldenGain:DASH_FLOW.bananaGain);
  return dashAward(run,golden?DASH_REWARDS.goldenBanana:DASH_REWARDS.banana);
}
