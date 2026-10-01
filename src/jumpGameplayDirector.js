const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const lerp=(a,b,t)=>a+(b-a)*t;

export const ENCOUNTER_PHASES=Object.freeze({
 READ:'READ',
 BUILD:'BUILD',
 CHALLENGE:'CHALLENGE',
 RELEASE:'RELEASE',
 REWARD:'REWARD'
});

export const HAZARD_TYPES=Object.freeze([
 'thorn-pod',
 'swinging-pod',
 'vine-sweep',
 'falling-fruit'
]);

export const JUMP_DIFFICULTY=Object.freeze({
 altitudeFull:1500,
 timeFull:720,
 paceStepMeters:200,
 paceStart:.96,
 paceStep:.06,
 paceSoftStepAfter:1000,
 paceLateStep:.035,
 routeWidth:Object.freeze({start:1.78,end:1.08}),
 rise:Object.freeze({start:4.12,end:4.78,jitter:.34}),
 routeShift:Object.freeze({start:4.70,end:6.05}),
 routeMinShift:Object.freeze({start:3.50,end:4.95}),
 routeEdgeGap:Object.freeze({start:.86,end:1.40}),
 optionalWidth:Object.freeze({start:1.65,end:1.00}),
 optionalRewardDistance:Object.freeze({start:1.8,end:3.7}),
 movingFrequency:Object.freeze({start:.14,end:.38}),
 hazardDensity:Object.freeze({start:.08,end:.34}),
 recoveryFrequency:Object.freeze({start:.06,end:.015}),
 maxEncounterComplexity:6,
 safeLandingMargin:.36,
 hazardSafeMargin:.65,
 dynamicHazardTelegraphMin:.85
});

export const SPECIAL_INTENSITY=Object.freeze({
 eventDuration:12,
 jetDuration:8,
 jetFirst:Object.freeze([40,52]),
 jetGap:Object.freeze([54,72]),
 eventFirst:Object.freeze([48,62]),
 eventGap:Object.freeze([56,74]),
 minimumGap:9,
 jetPickupLifetime:18
});

export const ENCOUNTER_TEMPLATES=Object.freeze([
 Object.freeze({
  id:'moving-choice',
  complexity:1,
  weight:1.15,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'solid'}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'moving',reward:false}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'moving',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'banana-risk-cracked',
  complexity:2,
  weight:1.1,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'solid'}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'cracked',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'cracked',reward:true,hazard:'thorn-pod'}),
   Object.freeze({phase:ENCOUNTER_PHASES.REWARD,optional:'solid',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'spring-reward-line',
  complexity:2,
  weight:1.08,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:null}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'spring',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.REWARD,optional:'leaf',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'swing-opening',
  complexity:3,
  weight:1,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'swing',reward:false}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'swing',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'solid',reward:true,hazard:'swinging-pod'}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'vanish-reunion',
  complexity:4,
  weight:.9,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'solid'}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'vanish',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'vanish',reward:true,hazard:'vine-sweep'}),
   Object.freeze({phase:ENCOUNTER_PHASES.REWARD,optional:'leaf',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'fruit-gauntlet',
  complexity:5,
  weight:.84,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'solid'}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'moving',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'swing',reward:true,hazard:'falling-fruit'}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'vanish',reward:true,hazard:'vine-sweep'}),
   Object.freeze({phase:ENCOUNTER_PHASES.REWARD,optional:'spring',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 }),
 Object.freeze({
  id:'canopy-scramble',
  complexity:6,
  weight:.78,
  steps:Object.freeze([
   Object.freeze({phase:ENCOUNTER_PHASES.READ,optional:'moving'}),
   Object.freeze({phase:ENCOUNTER_PHASES.BUILD,optional:'cracked',reward:true,hazard:'thorn-pod'}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'swing',reward:true,hazard:'swinging-pod'}),
   Object.freeze({phase:ENCOUNTER_PHASES.CHALLENGE,optional:'vanish',reward:true,hazard:'falling-fruit'}),
   Object.freeze({phase:ENCOUNTER_PHASES.REWARD,optional:'spring',reward:true}),
   Object.freeze({phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true})
  ])
 })
]);

export const paceAt=height=>{
 const meters=Math.max(0,Number(height)||0);
 const earlyMeters=Math.min(meters,JUMP_DIFFICULTY.paceSoftStepAfter);
 const earlySteps=Math.floor(earlyMeters/JUMP_DIFFICULTY.paceStepMeters);
 const lateMeters=Math.max(0,meters-JUMP_DIFFICULTY.paceSoftStepAfter);
 const lateSteps=Math.floor(lateMeters/JUMP_DIFFICULTY.paceStepMeters);
 return JUMP_DIFFICULTY.paceStart+earlySteps*JUMP_DIFFICULTY.paceStep+lateSteps*JUMP_DIFFICULTY.paceLateStep;
};

export function difficultyAt(height=0,time=0){
 const altitude=clamp((Number(height)||0)/JUMP_DIFFICULTY.altitudeFull);
 const activeTime=clamp((Number(time)||0)/JUMP_DIFFICULTY.timeFull);
 const intensity=clamp(altitude*.74+activeTime*.26);
 const complexity=Math.max(1,Math.min(JUMP_DIFFICULTY.maxEncounterComplexity,1+Math.floor(intensity*JUMP_DIFFICULTY.maxEncounterComplexity)));
 return Object.freeze({
  altitude,
  activeTime,
  intensity,
  complexity,
  pace:paceAt(height),
  routeWidth:lerp(JUMP_DIFFICULTY.routeWidth.start,JUMP_DIFFICULTY.routeWidth.end,intensity),
  rise:lerp(JUMP_DIFFICULTY.rise.start,JUMP_DIFFICULTY.rise.end,intensity),
  routeShift:lerp(JUMP_DIFFICULTY.routeShift.start,JUMP_DIFFICULTY.routeShift.end,intensity),
  routeMinShift:lerp(JUMP_DIFFICULTY.routeMinShift.start,JUMP_DIFFICULTY.routeMinShift.end,intensity),
  routeEdgeGap:lerp(JUMP_DIFFICULTY.routeEdgeGap.start,JUMP_DIFFICULTY.routeEdgeGap.end,intensity),
  optionalWidth:lerp(JUMP_DIFFICULTY.optionalWidth.start,JUMP_DIFFICULTY.optionalWidth.end,intensity),
  optionalRewardDistance:lerp(JUMP_DIFFICULTY.optionalRewardDistance.start,JUMP_DIFFICULTY.optionalRewardDistance.end,intensity),
  movingFrequency:lerp(JUMP_DIFFICULTY.movingFrequency.start,JUMP_DIFFICULTY.movingFrequency.end,intensity),
  hazardDensity:lerp(JUMP_DIFFICULTY.hazardDensity.start,JUMP_DIFFICULTY.hazardDensity.end,intensity),
  recoveryFrequency:lerp(JUMP_DIFFICULTY.recoveryFrequency.start,JUMP_DIFFICULTY.recoveryFrequency.end,intensity)
 });
}

export function chooseEncounter(random,difficulty,index=0){
 const eligible=ENCOUNTER_TEMPLATES.filter(template=>template.complexity<=difficulty.complexity);
 const antiRepeat=eligible.length>1?eligible.filter(template=>template.id!==index):eligible;
 const pool=antiRepeat.length?antiRepeat:eligible;
 const total=pool.reduce((sum,template)=>sum+template.weight,0);
 let roll=random()*total;
 for(const template of pool){
  roll-=template.weight;
  if(roll<=0)return template;
 }
 return pool.at(-1);
}

export function wrappedDelta(from,to,span){
 let delta=to-from;
 if(!Number.isFinite(span)||span<=0)return delta;
 delta=((delta+span/2)%span+span)%span-span/2;
 return delta;
}

export function wrappedDistance(a,b,span){
 return Math.abs(wrappedDelta(a,b,span));
}

export function simulateHorizontalTransfer({
 fromX,
 toX,
 flightTime,
 initialVx=0,
 speed,
 acceleration,
 step,
 wrapSpan,
 targetAt
}){
 let x=fromX,vx=initialVx,time=0;
 const dt=Math.max(1e-6,step);
 while(time+1e-9<flightTime){
  const slice=Math.min(dt,flightTime-time);
  const target=targetAt?targetAt(time+slice):toX;
  const delta=wrappedDelta(x,target,wrapSpan);
  const desired=Math.abs(delta)<.04?0:Math.sign(delta)*speed;
  const amount=acceleration*slice;
  vx+=Math.max(-amount,Math.min(amount,desired-vx));
  x+=vx*slice;
  if(wrapSpan){
   x=((x+wrapSpan/2)%wrapSpan+wrapSpan)%wrapSpan-wrapSpan/2;
  }
  time+=slice;
 }
 const target=targetAt?targetAt(flightTime):toX;
 return Object.freeze({x,vx,error:wrappedDistance(x,target,wrapSpan),time});
}

export function validateRequiredTransfer({
 fromX,
 toX,
 flightTime,
 targetWidth,
 speed,
 acceleration,
 step,
 wrapSpan,
 landingMargin=JUMP_DIFFICULTY.safeLandingMargin,
 targetAt
}){
 const acceptance=Math.max(.16,targetWidth/2-landingMargin);
 const direction=Math.sign(wrappedDelta(fromX,toX,wrapSpan))||1;
 // The required route is guaranteed from neutral or modestly-wrong momentum, not
 // from a full-speed wrong-way entry. Players now need to plan the next landing.
 const initialVelocities=[0,-direction*speed*.38,direction*speed*.72];
 const results=initialVelocities.map(initialVx=>simulateHorizontalTransfer({
  fromX,toX,flightTime,initialVx,speed,acceleration,step,wrapSpan,targetAt
 }));
 return Object.freeze({
  viable:results.every(result=>result.error<=acceptance),
  acceptance,
  worstError:Math.max(...results.map(result=>result.error)),
  results
 });
}

function mix32(value){
 let x=value>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;
 return x>>>0;
}
const unitHash=(seed,index,salt)=>mix32((seed>>>0)^Math.imul((index+1)>>>0,0x9e3779b1)^salt)/4294967296;
const rangeHash=(seed,index,salt,[min,max])=>min+(max-min)*unitHash(seed,index,salt);

export const firstJetTime=seed=>rangeHash(seed,0,0x91e10da5,SPECIAL_INTENSITY.jetFirst);
export const jetGapFor=(seed,index)=>rangeHash(seed,index,0x3f6c5b21,SPECIAL_INTENSITY.jetGap);
export const firstEventTime=seed=>rangeHash(seed,0,0x6d2b79f5,SPECIAL_INTENSITY.eventFirst);
export const eventGapFor=(seed,index)=>rangeHash(seed,index,0xb5297a4d,SPECIAL_INTENSITY.eventGap);

export function makeHazardSpec(type,{id,baseX,baseY,runTime,random,safeX,safeWidth}){
 const phase=random()*Math.PI*2;
 const common={
  id,type,x:baseX,y:baseY,baseX,baseY,phase,createdAt:runTime,
  safeX,safeWidth,telegraphCycle:-1,activeCycle:-1,route:'optional'
 };
 if(type==='swinging-pod')return {...common,radius:.46,range:.58+random()*.22,speed:.72+random()*.28,lead:1.0,cycle:4.6};
 if(type==='vine-sweep')return {...common,radius:.38,range:.82+random()*.18,speed:1,lead:1.05,activeDuration:.78,recovery:2.1,cycle:3.93};
 if(type==='falling-fruit')return {...common,radius:.43,range:0,speed:1,lead:1.1,activeDuration:.72,recovery:2.4,cycle:4.22,dropHeight:3.1+random()*.5};
 return {...common,type:'thorn-pod',radius:.42,range:.22+random()*.18,speed:.7+random()*.7,lead:0,cycle:0};
}

export function hazardMotion(hazard,time){
 const age=Math.max(0,time-hazard.createdAt);
 if(hazard.type==='thorn-pod'){
  return Object.freeze({
   x:hazard.baseX+Math.sin(time*(1.25+(hazard.speed||1)*.22)+hazard.phase)*(hazard.range||.28),
   y:hazard.baseY,
   active:true,
   telegraphing:false,
   cycleIndex:0,
   telegraphKind:'static-thorns'
  });
 }
 if(hazard.type==='swinging-pod'){
  const lead=hazard.lead||1;
  const active=age>=lead;
  const swingAge=Math.max(0,age-lead);
  const angle=Math.sin(swingAge*(1.28+(hazard.speed||1)*.32)+hazard.phase);
  return Object.freeze({
   x:hazard.baseX+angle*hazard.range,
   y:hazard.baseY-.12*Math.cos(swingAge*1.35+hazard.phase),
   active,
   telegraphing:!active,
   cycleIndex:0,
   telegraphKind:'pendulum-rustle'
  });
 }
 const cycle=Math.max(.1,hazard.cycle||4);
 const cycleIndex=Math.floor(age/cycle);
 const local=age-cycleIndex*cycle;
 const lead=hazard.lead||1;
 const activeDuration=hazard.activeDuration||.75;
 const active=local>=lead&&local<lead+activeDuration;
 const telegraphing=local<lead;
 const progress=active?clamp((local-lead)/activeDuration):0;
 if(hazard.type==='vine-sweep'){
  return Object.freeze({
   x:active?hazard.baseX+lerp(-hazard.range,hazard.range,progress):hazard.baseX-hazard.range,
   y:hazard.baseY,
   active,
   telegraphing,
   cycleIndex,
   telegraphKind:'vine-rustle'
  });
 }
 return Object.freeze({
  x:hazard.baseX,
  y:active?hazard.baseY+(hazard.dropHeight||3.2)*(1-progress):hazard.baseY+(hazard.dropHeight||3.2),
  active,
  telegraphing,
  cycleIndex,
  telegraphKind:'leaf-shake'
 });
}

export function hazardEnvelope(hazard){
 if(hazard.type==='falling-fruit')return hazard.radius;
 return hazard.radius+Math.abs(hazard.range||0);
}

export function hazardClearsRequiredRoute(hazard,wrapSpan,margin=JUMP_DIFFICULTY.hazardSafeMargin){
 const safeHalf=Math.max(0,(hazard.safeWidth||0)/2);
 return wrappedDistance(hazard.baseX,hazard.safeX,wrapSpan)>=safeHalf+hazardEnvelope(hazard)+margin;
}
