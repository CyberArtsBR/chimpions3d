import {
 ENCOUNTER_PHASES,
 JUMP_DIFFICULTY,
 SPECIAL_INTENSITY,
 chooseEncounter,
 difficultyAt,
 eventGapFor,
 firstEventTime,
 firstJetTime,
 hazardClearsRequiredRoute,
 hazardMotion,
 jetGapFor,
 makeHazardSpec,
 paceAt as directedPaceAt,
 validateRequiredTransfer,
 wrappedDistance as directedWrappedDistance
} from './jumpGameplayDirector.js';

export const WIDTH=14.4, GRAVITY=18, JUMP=13.6*Math.sqrt(1.3), SPEED=6.2, VIEW_HEIGHT=12.4, STEP=1/60;
export const PLATFORM_SCALE=1.5*.75*.75, PLATFORM_LENGTH=PLATFORM_SCALE*1.3, ITEM_SCALE=1.5, BANANA_HEIGHT=1.35;
export const SPRING_JUMP=28*Math.sqrt(1.3), LEAF_JUMP=JUMP*1.08, JET_DURATION=SPECIAL_INTENSITY.jetDuration, JET_SPEED=24;
export const FAST_FALL_EXTRA_GRAVITY=16, FAST_FALL_MAX_SPEED=22, FAST_FALL_MIN_BOUNCE_AGE=.18;
export const VINE_INSET=.24;
export const EVENT_INTERVAL=65, EVENT_DURATION=SPECIAL_INTENSITY.eventDuration;
export const RULESET='2026-10-expedition-v15-mastery';
export const WRAP_SPAN=WIDTH-2*VINE_INSET;

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const wrapX=x=>((x+WRAP_SPAN/2)%WRAP_SPAN+WRAP_SPAN)%WRAP_SPAN-WRAP_SPAN/2;
const wrappedDistance=(a,b)=>directedWrappedDistance(a,b,WRAP_SPAN);
const FLOW_THRESHOLDS=Object.freeze([0,14,32,56,88,126]);
const FLOW_MULTIPLIERS=Object.freeze([1,1.5,2,3,4,5]);
const flowMultiplierFor=points=>{
 let index=0;for(let i=1;i<FLOW_THRESHOLDS.length;i++)if(points>=FLOW_THRESHOLDS[i])index=i;else break;
 return FLOW_MULTIPLIERS[index];
};
const flowProgressFor=points=>{
 let index=0;for(let i=1;i<FLOW_THRESHOLDS.length;i++)if(points>=FLOW_THRESHOLDS[i])index=i;else break;
 if(index>=FLOW_THRESHOLDS.length-1)return 1;
 return clamp((points-FLOW_THRESHOLDS[index])/(FLOW_THRESHOLDS[index+1]-FLOW_THRESHOLDS[index]));
};
const normalizeControl=input=>{
 if(input&&typeof input==='object')return {steer:Math.max(-1,Math.min(1,Number(input.steer)||0)),fastFall:!!input.fastFall};
 return {steer:Math.max(-1,Math.min(1,Number(input)||0)),fastFall:false};
};

// Pace advances at deterministic 200m altitude milestones and stays unbounded.
// After 1000m the director softens each step, but never stops increasing pace.
export const paceAt=height=>directedPaceAt(height);

const PLATFORM_TRAVEL=1.65, PLATFORM_HEIGHT_BAND=2.2, PLATFORM_GAP=.8;
export const platformTravelFor=type=>type==='moving'?PLATFORM_TRAVEL:type==='swing'?1.35:0;

// Moving-platform speed no longer gets a second late-run acceleration multiplier.
export const platformPhaseAt=time=>.72*Math.max(0,time);
const VERTICAL_PHASE_SPEED=1.22;
const swingAngleAt=(platform,time)=>Math.sin(time*(.78+(platform.moveSpeed||1)*.18)+(platform.phase||0))*.62;

export const movingX=(platform,time)=>
 platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange??PLATFORM_TRAVEL);

export const platformX=(platform,time)=>{
 if(platform.type==='moving')return movingX(platform,time);
 if(platform.type==='swing')return platform.baseX+Math.sin(swingAngleAt(platform,time))*(platform.moveRange||1.35);
 return platform.baseX;
};
export const platformY=(platform,time)=>{
 if(platform.type==='vertical')return platform.baseY+Math.sin(platformPhaseAt(time)*VERTICAL_PHASE_SPEED+platform.phase)*.65;
 if(platform.type==='swing')return platform.baseY+(1-Math.cos(swingAngleAt(platform,time)))*.36;
 return platform.baseY;
};

export const hazardX=(hazard,time)=>hazardMotion(hazard,time).x;
const EVENT_TYPES=['banana-bloom','spring-fever'];

const transferFlightTime=rise=>{
 const discriminant=JUMP*JUMP-2*GRAVITY*rise;
 return discriminant>0?(JUMP+Math.sqrt(discriminant))/GRAVITY:0;
};

export class Game {
 constructor(seed=1){this.reset(seed);}
 reset(seed=1){
  this.runSeed=seed>>>0;this.seed=this.runSeed;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
  this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
  this.jetpack=null;this.jetRemaining=0;this.jetIndex=0;this.nextJetAt=firstJetTime(this.runSeed);
  this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
  this.event=null;this.eventIndex=0;this.nextEventAt=firstEventTime(this.runSeed);this.specialBlockedUntil=0;
  this.lastMilestone=0;this.hazardCooldown=0;this.hazards=[];this.nextHazardId=0;
  this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;this.nextWidth=2.8*PLATFORM_LENGTH;this.lastRouteDirection=0;
  this.encounterIndex=0;this.encounter=null;this.lastEncounterId='';this.extraRecoveryPending=false;
  this.flowPoints=0;this.flowMultiplier=1;this.bestFlowMultiplier=1;this.skillBonus=0;
  this.perfectLandings=0;this.goodLandings=0;this.edgeLandings=0;this.riskLandings=0;this.dangerLandings=0;this.nearMisses=0;this.encountersCompleted=0;this.safeLandingStreak=0;
  this.fastFallActive=false;this.fastFallUsedSinceBounce=false;
  this.add(0,0,2.8,'solid',false,'safe',{routeTier:'SAFE',encounterType:'start',encounterPhase:ENCOUNTER_PHASES.READ});
  this.generate();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 adjustFlow(delta){
  this.flowPoints=clamp(this.flowPoints+(Number(delta)||0),0,160);
  this.flowMultiplier=flowMultiplierFor(this.flowPoints);
  this.bestFlowMultiplier=Math.max(this.bestFlowMultiplier,this.flowMultiplier);
  return this.flowMultiplier;
 }
 awardSkill(base){
  const award=Math.max(0,Math.round((Number(base)||0)*this.flowMultiplier));
  this.skillBonus+=award;return award;
 }
 masterySnapshot(extra={}){return Object.freeze({
  flowPoints:this.flowPoints,flowMultiplier:this.flowMultiplier,flowProgress:flowProgressFor(this.flowPoints),bestFlow:this.bestFlowMultiplier,
  skillBonus:this.skillBonus,perfectLandings:this.perfectLandings,goodLandings:this.goodLandings,edgeLandings:this.edgeLandings,
  riskLandings:this.riskLandings,dangerLandings:this.dangerLandings,nearMisses:this.nearMisses,encountersCompleted:this.encountersCompleted,
  ...extra
 });}
 publishMastery(type,extra={}){
  if(typeof window==='undefined'||typeof window.dispatchEvent!=='function'||typeof window.CustomEvent!=='function')return;
  window.dispatchEvent(new window.CustomEvent('chimp-mastery',{detail:{type,...this.masterySnapshot(extra)}}));
 }
 canPlace(x,y,width,type){
  const extent=width/2+platformTravelFor(type);
  if(Math.abs(x)+extent>WIDTH/2-VINE_INSET-.35)return false;
  const motionBand=type==='vertical'?.65:type==='swing'?.16:0;
  return this.platforms.every(p=>p.broken||Math.abs((p.baseY??p.y)-y)>=PLATFORM_HEIGHT_BAND+motionBand+(p.type==='vertical'?.65:p.type==='swing'?.16:0)||
   Math.abs(p.baseX-x)>=extent+p.width/2+platformTravelFor(p.type)+PLATFORM_GAP);
 }
 add(x,y,width,type,coin=true,route='safe',metadata={}){
  const size=Math.max(0,Math.min(1,(width-.95)/1.5));
  width*=PLATFORM_LENGTH;
  const moveRange=platformTravelFor(type),moveSpeed=1.25*(.62+.86*size);
  if(!this.canPlace(x,y,width,type))return false;
  this.platforms.push({
   id:this.nextId++,x,baseX:x,y,baseY:y,width,type,coin,route,routeTier:metadata.routeTier||String(route||'safe').toUpperCase(),
   reward:width<=1.3*PLATFORM_LENGTH?2:1,
   fragile:type==='cracked',broken:false,phase:this.random()*6.28,
   moveSpeed,moveRange,vanishAt:null,...metadata
  });
  const platform=this.platforms.at(-1);
  platform.x=platformX(platform,this.time);platform.y=platformY(platform,this.time);
  return true;
 }
 nextEncounterStep(difficulty){
  if(this.extraRecoveryPending){
   this.extraRecoveryPending=false;this.encounter=null;
  }else if(this.encounter&&this.encounter.step>=this.encounter.template.steps.length&&this.random()<difficulty.recoveryFrequency){
   this.extraRecoveryPending=true;
   return {
    encounterId:this.encounter.id,
    encounterType:this.encounter.template.id,
    encounterStep:this.encounter.step,
    phase:ENCOUNTER_PHASES.RELEASE,optional:null,recovery:true,extendedRecovery:true
   };
  }
  if(!this.encounter||this.encounter.step>=this.encounter.template.steps.length){
   const template=chooseEncounter(()=>this.random(),difficulty,this.lastEncounterId);
   this.encounter={id:this.encounterIndex++,template,step:0};
   this.lastEncounterId=template.id;
  }
  const stepIndex=this.encounter.step++;
  return {
   encounterId:this.encounter.id,
   encounterType:this.encounter.template.id,
   encounterStep:stepIndex,
   ...this.encounter.template.steps[stepIndex]
  };
 }
 requiredTransferViable(x,y,width){
  const rise=y-this.nextY,flightTime=transferFlightTime(rise);
  if(!flightTime)return false;
  return validateRequiredTransfer({
   fromX:this.nextX,
   toX:x,
   flightTime,
   targetWidth:width*PLATFORM_LENGTH,
   speed:SPEED,
   acceleration:24,
   step:STEP,
   wrapSpan:WRAP_SPAN,
   landingMargin:JUMP_DIFFICULTY.safeLandingMargin
  }).viable;
 }
 addHazardNear(platform,safePlatform,type='thorn-pod'){
  if(this.hazards.some(h=>Math.abs(h.baseY-platform.y)<1.9))return false;
  const away=wrappedDistance(platform.baseX,safePlatform.baseX)<.01?(this.random()<.5?-1:1):
   (wrapX(platform.baseX-safePlatform.baseX)>=0?1:-1);
  const provisional=makeHazardSpec(type,{
   id:this.nextHazardId,
   baseX:platform.baseX,
   baseY:platform.y+.72,
   runTime:this.time,
   random:()=>this.random(),
   safeX:safePlatform.baseX,
   safeWidth:safePlatform.width
  });
  const envelope=provisional.radius+Math.abs(provisional.range||0);
  const limit=WIDTH/2-VINE_INSET-.35-envelope;
  let baseX=platform.baseX+away*(platform.width/2+envelope+.28);
  baseX=Math.max(-limit,Math.min(limit,baseX));
  const hazard={...provisional,id:this.nextHazardId++,x:baseX,baseX,y:provisional.baseY};
  if(!hazardClearsRequiredRoute(hazard,WRAP_SPAN))return false;
  this.hazards.push(hazard);return true;
 }
 addOptional(step,safePlatform,difficulty){
  if(!step.optional)return null;
  let type=step.optional;
  if(type==='solid'&&step.phase===ENCOUNTER_PHASES.BUILD&&this.random()<difficulty.movingFrequency)type='moving';
  const width=Math.max(.98,difficulty.optionalWidth+(this.random()-.5)*.34);
  const y=safePlatform.y-.92-this.random()*.34;
  const extent=width*PLATFORM_LENGTH/2+platformTravelFor(type);
  const edge=WIDTH/2-VINE_INSET-.35-extent,places=[];
  const minRiskDistance=Math.min(difficulty.optionalRewardDistance,Math.max(1.1,edge*.72));
  for(let px=-edge;px<=edge+.001;px+=.15){
   if(wrappedDistance(px,safePlatform.baseX)<minRiskDistance)continue;
   if(this.canPlace(px,y,width*PLATFORM_LENGTH,type))places.push(px);
  }
  if(!places.length)return null;
  places.sort((a,b)=>wrappedDistance(b,safePlatform.baseX)-wrappedDistance(a,safePlatform.baseX));
  const px=places[Math.min(places.length-1,Math.floor(this.random()*Math.min(4,places.length)))];
  const reward=!!step.reward;
  const danger=!!step.hazard||(reward&&step.phase===ENCOUNTER_PHASES.CHALLENGE&&difficulty.complexity>=4);
  const routeTier=danger?'DANGER':'RISK',route=routeTier.toLowerCase();
  const coin=this.random()<(reward ? .9 : .5);
  if(!this.add(px,y,width,type,coin,route,{
   routeTier,encounterId:step.encounterId,encounterType:step.encounterType,encounterPhase:step.phase,encounterStep:step.encounterStep
  }))return null;
  const placed=this.platforms.at(-1);placed.reward=danger?3:reward?2:1;
  return placed;
 }
 generate(){
  while(this.nextY<this.camera+10){
   const difficulty=difficultyAt(this.nextY,this.time);
   const step=this.nextEncounterStep(difficulty);
   const recovery=step.recovery||step.phase===ENCOUNTER_PHASES.READ||step.phase===ENCOUNTER_PHASES.RELEASE;
   const rise=difficulty.rise+(this.random()-.5)*JUMP_DIFFICULTY.rise.jitter*(recovery ? .65 : 1);
   const y=this.nextY+rise;
   const width=Math.min(2.35,difficulty.routeWidth+(recovery ? .08 : 0));
   const targetWidth=width*PLATFORM_LENGTH;
   const limit=WIDTH/2-VINE_INSET-.35-targetWidth/2;
   const phaseShift=step.phase===ENCOUNTER_PHASES.CHALLENGE?1:step.phase===ENCOUNTER_PHASES.BUILD?.99:recovery?.95:.97;
   const reach=Math.min(difficulty.routeShift*phaseShift,WIDTH/2);
   const minShiftFactor=step.phase===ENCOUNTER_PHASES.CHALLENGE?1:step.phase===ENCOUNTER_PHASES.BUILD?.99:recovery?.94:.97;
   const edgeGap=difficulty.routeEdgeGap*(recovery?.72:1);
   const footprintShift=(this.nextWidth+targetWidth)/2+edgeGap;
   const minShift=Math.min(reach*.97,Math.max(2.75,difficulty.routeMinShift*minShiftFactor,footprintShift));
   const candidates=[],viable=[];
   for(let x=-limit;x<=limit+.001;x+=.2){
    if(!this.canPlace(x,y,targetWidth,'solid')||!this.requiredTransferViable(x,y,width))continue;
    viable.push(x);
    const distance=wrappedDistance(x,this.nextX);
    if(distance>=minShift&&distance<=reach)candidates.push(x);
   }
   let x;
   const source=candidates.length?candidates:viable;
   if(source.length){
    const ranked=[...source].sort((a,b)=>wrappedDistance(b,this.nextX)-wrappedDistance(a,this.nextX));
    const opposite=ranked.filter(value=>{
     if(!this.lastRouteDirection)return true;
     const direction=Math.sign(wrapX(value-this.nextX));
     return direction&&direction!==this.lastRouteDirection;
    });
    const useOpposite=opposite.length&&this.lastRouteDirection&&this.random()<.84;
    const directionalPool=useOpposite?opposite:ranked;
    const hardFraction=step.phase===ENCOUNTER_PHASES.CHALLENGE?.12:recovery?.32:.20;
    const hardPool=directionalPool.slice(0,Math.max(1,Math.ceil(directionalPool.length*hardFraction)));
    x=hardPool[Math.floor(this.random()*hardPool.length)];
   }else{
    // Absolute emergency only: normal generation should always find a deliberate
    // lateral transfer. Keep this only to avoid terminating an otherwise valid run.
    x=Math.max(-limit,Math.min(limit,this.nextX));
    if(!this.requiredTransferViable(x,y,width))break;
   }
   const safeBanana=this.random()<(step.phase===ENCOUNTER_PHASES.REWARD ? .76 : .48);
   if(!this.add(x,y,width,'solid',safeBanana,'safe',{
    routeTier:'SAFE',encounterId:step.encounterId,encounterType:step.encounterType,encounterPhase:step.phase,encounterStep:step.encounterStep,
    required:true,recovery,extendedRecovery:!!step.extendedRecovery
   }))break;
   const safePlatform=this.platforms.at(-1);
   const chosenDirection=Math.sign(wrapX(x-this.nextX));
   if(chosenDirection)this.lastRouteDirection=chosenDirection;
   this.nextX=x;this.nextY=y;this.nextWidth=safePlatform.width;

   const optional=this.addOptional(step,safePlatform,difficulty);
   const specialClear=!this.event&&this.jetRemaining<=0&&!this.jetpack&&this.time>=this.specialBlockedUntil;
   if(specialClear&&optional&&step.hazard)this.addHazardNear(optional,safePlatform,step.hazard);
   else if(specialClear&&optional&&step.phase===ENCOUNTER_PHASES.CHALLENGE&&this.random()<difficulty.hazardDensity)
    this.addHazardNear(optional,safePlatform,'thorn-pod');

   if(optional&&difficulty.complexity>=4&&step.phase===ENCOUNTER_PHASES.CHALLENGE&&this.random()<.38){
    const echo={...step,optional:this.random()<.5?'leaf':'cracked',reward:true,hazard:null};
    this.addOptional(echo,safePlatform,difficulty);
   }
  }
 }
 spawnJetpack(){
  const optional=this.platforms.filter(p=>!p.broken&&p.route!=='safe'&&p.y>this.camera-4&&p.y<this.camera+4);
  const supports=optional.length?optional:this.platforms.filter(p=>!p.broken&&p.y>this.camera-4&&p.y<this.camera+4);
  for(let attempt=0;attempt<64&&supports.length;attempt++){
   const support=supports[Math.floor(this.random()*supports.length)];
   const side=support.route==='safe'?(this.random()<.5?-1:1):Math.sign(support.baseX||1);
   const y=support.y+1.65+this.random()*2.2;
   const x=wrapX(support.x+side*(.65+this.random()*.85));
   const rise=y-support.y,flight=transferFlightTime(rise);
   const distance=wrappedDistance(x,support.x);
   if(y>this.camera+5.3||y<this.camera-2||distance>Math.max(1,flight*SPEED*.65))continue;
   if(this.platforms.some(p=>!p.broken&&Math.abs(p.y-y)<.85&&wrappedDistance(p.x,x)<p.width/2+.6))continue;
   this.jetpack={x,y,expires:this.time+SPECIAL_INTENSITY.jetPickupLifetime,route:support.route==='safe'?'risk':'reward'};
   return true;
  }
  return false;
 }
 hazardPressure(){
  return this.hazards.some(h=>Math.abs(h.baseY-this.y)<5.2);
 }
 updateCanopyEvent(events){
  if(this.event&&this.time>=this.event.ends){
   const ended=this.event.type;this.event=null;
   this.specialBlockedUntil=Math.max(this.specialBlockedUntil,this.time+SPECIAL_INTENSITY.minimumGap);
   for(const h of this.hazards)if(h.type!=='thorn-pod'){h.createdAt=this.time;h.telegraphCycle=-1;h.activeCycle=-1;}
   events.push({type:'event-end',eventType:ended});
  }
  if(!this.event&&this.time>=this.nextEventAt){
   const busy=this.jetRemaining>0||!!this.jetpack||this.hazardPressure()||this.time<this.specialBlockedUntil;
   if(!busy){
    const type=EVENT_TYPES[(this.runSeed+this.eventIndex*5)%EVENT_TYPES.length];
    this.event={type,started:this.time,ends:this.time+EVENT_DURATION};
    for(const h of this.hazards){h.active=false;h.telegraphing=false;}
    this.eventIndex++;
    this.nextEventAt=this.event.ends+eventGapFor(this.runSeed,this.eventIndex);
    this.specialBlockedUntil=this.event.ends+SPECIAL_INTENSITY.minimumGap;
    events.push({type:'event-start',eventType:type,duration:EVENT_DURATION});
   }
  }
 }
 updateHazards(events){
  const specialBusy=!!this.event||this.jetRemaining>0;
  for(const h of this.hazards){
   const motion=hazardMotion(h,this.time);h.x=motion.x;h.y=motion.y;
   h.active=!specialBusy&&motion.active;h.telegraphing=!specialBusy&&motion.telegraphing;
   const nearView=Math.abs(h.baseY-this.camera)<VIEW_HEIGHT*.72+2;
   if(nearView&&h.telegraphing&&h.telegraphCycle!==motion.cycleIndex){
    h.telegraphCycle=motion.cycleIndex;
    events.push({
     type:'hazard-telegraph',hazardType:h.type,x:h.x,y:h.y,lead:h.lead||0,
     telegraphKind:motion.telegraphKind,hazardId:h.id,cycle:motion.cycleIndex
    });
   }
   if(h.active&&h.activeCycle!==motion.cycleIndex){
    h.activeCycle=motion.cycleIndex;
    if(nearView)events.push({type:'hazard-active',hazardType:h.type,x:h.x,y:h.y,hazardId:h.id,cycle:motion.cycleIndex});
   }
  }
 }
 step(input,dt=STEP){
  if(this.dead)return [];
  const control=normalizeControl(input),events=[],realDt=dt;this.time+=realDt;this.updateCanopyEvent(events);
  this.hazardCooldown=Math.max(0,this.hazardCooldown-realDt);

  dt*=paceAt(this.height);this.bounceAge+=dt;
  this.previousCamera=this.camera;
  const target=control.steer*SPEED,amount=24*dt;
  this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));

  const oldX=this.x,oldY=this.y,travel=this.vx*dt;
  const vineX=WIDTH/2-VINE_INSET,nextX=oldX+travel;
  if(nextX>vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'right',x:this.x,y:this.y});}
  else if(nextX<-vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'left',x:this.x,y:this.y});}
  else this.x=nextX;

  if(this.jetRemaining>0){
   this.fastFallActive=false;
   const flight=Math.min(realDt,this.jetRemaining);this.y+=JET_SPEED*flight;this.jetRemaining=Math.max(0,this.jetRemaining-realDt);this.vy=JET_SPEED/paceAt(this.height);
   if(this.jetRemaining===0){
    this.vy=JUMP;
    for(const h of this.hazards)if(h.type!=='thorn-pod'){h.createdAt=this.time;h.telegraphCycle=-1;h.activeCycle=-1;}
    events.push({type:'jet-end'});
   }
  }else{
   const fastFall=control.fastFall&&this.vy<0&&this.bounceAge>=FAST_FALL_MIN_BOUNCE_AGE;
   const gravity=GRAVITY+(fastFall?FAST_FALL_EXTRA_GRAVITY:0);
   this.y+=this.vy*dt-.5*gravity*dt*dt;this.vy-=gravity*dt;
   if(fastFall){
    this.vy=Math.max(this.vy,-FAST_FALL_MAX_SPEED);this.fastFallUsedSinceBounce=true;
    if(!this.fastFallActive){events.push({type:'fast-fall',x:this.x,y:this.y});this.publishMastery('fast-fall',{x:this.x,y:this.y});}
   }
   this.fastFallActive=fastFall;
  }

  if(this.time>=this.nextJetAt&&this.jetRemaining<=0&&!this.jetpack){
   const busy=!!this.event||this.hazardPressure()||this.time<this.specialBlockedUntil;
   if(!busy){
    if(this.spawnJetpack()){
     this.jetIndex++;this.nextJetAt=this.time+jetGapFor(this.runSeed,this.jetIndex);
     this.specialBlockedUntil=this.time+SPECIAL_INTENSITY.minimumGap;
     events.push({type:'jet-spawn',route:this.jetpack.route});
    }else this.nextJetAt=this.time+3;
   }
  }
  if(this.jetpack){
   const j=this.jetpack,dx=wrappedDistance(this.x,j.x);
   if(dx<.65*ITEM_SCALE&&j.y>=Math.min(oldY,this.y)+.15&&j.y<=Math.max(oldY,this.y)+1.45){
    this.jetpack=null;this.jetRemaining=JET_DURATION;
    this.specialBlockedUntil=Math.max(this.specialBlockedUntil,this.time+JET_DURATION+SPECIAL_INTENSITY.minimumGap);
    events.push({type:'jet',x:this.x,y:this.y,duration:JET_DURATION});
   }else if(this.time>j.expires||j.y<this.camera-VIEW_HEIGHT/2)this.jetpack=null;
  }

  for(const p of this.platforms){
   if(p.type==='vanish'&&p.vanishAt!=null&&!p.broken&&this.time>=p.vanishAt){
    p.broken=true;events.push({type:'vanish',x:p.x,y:p.y,platformId:p.id});
   }
  }

  let landing=null,landingMeta=null,earliest=2;
  for(const p of this.platforms){
   const previousX=p.x,previousY=p.y;
   p.x=platformX(p,this.time);p.y=platformY(p,this.time);
   if(p.broken)continue;
   if(this.vy<0&&oldY>=previousY&&this.y<=p.y){
    const denominator=(oldY-this.y)+(p.y-previousY),t=denominator?clamp((oldY-previousY)/denominator,0,1):1,x=oldX+travel*t;
    const px=previousX+(p.x-previousX)*t,distance=wrappedDistance(x,px);
    if(distance<p.width/2+.24&&t<earliest){earliest=t;landing=p;landingMeta={distance,platformVx:(p.x-previousX)/Math.max(dt,1e-6)};}
   }
   const dx=wrappedDistance(this.x,p.x);
   if(p.coin&&dx<.65*ITEM_SCALE&&Math.abs(this.y+.65-(p.y+BANANA_HEIGHT))<.85+.25*(ITEM_SCALE-1)){
    p.coin=false;
    const bloom=this.event?.type==='banana-bloom'?1:0,value=(p.reward||1)+bloom;
    this.bananas+=value;events.push({type:'coin',x:p.x,y:p.y+BANANA_HEIGHT,value,bloom:!!bloom,route:p.route,routeTier:p.routeTier});
   }
  }

  this.updateHazards(events);
  if(this.jetRemaining<=0){
   for(const h of this.hazards){
    if(!h.active||this.hazardCooldown>0)continue;
    const dx=wrappedDistance(this.x,h.x),dy=Math.abs(this.y+.45-h.y),collision=dx<h.radius+.28&&dy<.62;
    if(collision){
     const delta=wrapX(this.x-h.x),push=delta>=0?1:-1;
     this.vx=Math.max(-SPEED*1.25,Math.min(SPEED*1.25,this.vx+push*3.8));
     this.vy=Math.min(this.vy,-2.4);this.hazardCooldown=.9;this.adjustFlow(-18);
     const event={type:'hazard',hazardType:h.type,x:h.x,y:h.y,hazardId:h.id,...this.masterySnapshot()};events.push(event);this.publishMastery('hazard',{hazardType:h.type});break;
    }
    if(dx<h.radius+1.0&&dy<.86&&h.nearMissCycle!==h.activeCycle){
     h.nearMissCycle=h.activeCycle;this.nearMisses++;this.adjustFlow(8);const skillAward=this.awardSkill(20);
     const event={type:'near-miss',hazardType:h.type,x:h.x,y:h.y,hazardId:h.id,skillAward,...this.masterySnapshot()};events.push(event);this.publishMastery('near-miss',{hazardType:h.type,skillAward});
    }
   }
  }

  if(landing){
   this.y=landing.y;
   const half=Math.max(.2,landing.width/2),centerRatio=(landingMeta?.distance||0)/half,relativeVx=Math.abs(this.vx-(landingMeta?.platformVx||0));
   const landingQuality=centerRatio<=.28&&relativeVx<=SPEED*.60?'PERFECT':centerRatio>=.76||relativeVx>=SPEED*1.05?'EDGE':'GOOD';
   const routeTier=landing.routeTier||String(landing.route||'safe').toUpperCase(),usedFastFall=this.fastFallUsedSinceBounce;
   let baseSkill=0;
   if(landingQuality==='PERFECT'){this.perfectLandings++;this.adjustFlow(10);baseSkill+=15;}
   else if(landingQuality==='GOOD'){this.goodLandings++;this.adjustFlow(2);baseSkill+=3;}
   else{this.edgeLandings++;this.adjustFlow(-8);}
   if(routeTier==='DANGER'){this.dangerLandings++;this.riskLandings++;this.safeLandingStreak=0;this.adjustFlow(8);baseSkill+=25;}
   else if(routeTier==='RISK'){this.riskLandings++;this.safeLandingStreak=0;this.adjustFlow(4);baseSkill+=10;}
   else{this.safeLandingStreak++;if(this.safeLandingStreak>3)this.adjustFlow(-2);}
   if((landing.type==='moving'||landing.type==='swing')&&landingQuality!=='EDGE'){this.adjustFlow(3);baseSkill+=6;}
   const fastFallPerfect=usedFastFall&&landingQuality==='PERFECT';if(fastFallPerfect){this.adjustFlow(5);baseSkill+=10;}
   const skillAward=this.awardSkill(baseSkill);
   const springBoost=this.event?.type==='spring-fever'?1.08:1;
   this.vy=landing.type==='spring'?SPRING_JUMP*springBoost:landing.type==='leaf'?LEAF_JUMP:JUMP;
   this.bounceAge=0;this.bounces++;this.fastFallActive=false;this.fastFallUsedSinceBounce=false;
   if(landing.type==='cracked'||landing.fragile)landing.broken=true;
   if(landing.type==='vanish'&&landing.vanishAt==null)landing.vanishAt=this.time+.8;
   const bounceEvent={
    type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring',
    fragile:landing.type==='cracked',platformType:landing.type,
    route:landing.route,routeTier,platformId:landing.id,
    landingQuality,centerRatio,relativeVx,fastFallPerfect,skillAward,
    encounterId:landing.encounterId,encounterType:landing.encounterType,encounterPhase:landing.encounterPhase,
    ...this.masterySnapshot()
   };
   events.push(bounceEvent);this.publishMastery('landing',bounceEvent);
   if(landing.route==='safe'&&landing.encounterPhase===ENCOUNTER_PHASES.RELEASE){
    this.encountersCompleted++;this.adjustFlow(6);const encounterSkill=this.awardSkill(30);
    const event={type:'encounter-complete',encounterId:landing.encounterId,encounterType:landing.encounterType,x:this.x,y:this.y,skillAward:encounterSkill,...this.masterySnapshot()};
    events.push(event);this.publishMastery('encounter-complete',{encounterId:landing.encounterId,encounterType:landing.encounterType,skillAward:encounterSkill});
   }
  }

  this.height=Math.max(this.height,this.y);
  const milestone=Math.floor(this.height/50)*50;
  if(milestone>this.lastMilestone){
   this.lastMilestone=milestone;if(milestone>0)events.push({type:'milestone',meters:milestone,x:this.x,y:this.y});
  }

  const cameraTarget=Math.max(this.camera,this.height-VIEW_HEIGHT*.085+Math.max(0,this.vy)*.018);
  this.camera+=Math.max(0,cameraTarget-this.camera)*(1-Math.exp(-8*dt));
  if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death',...this.masterySnapshot()});this.publishMastery('death');}

  this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
  this.hazards=this.hazards.filter(h=>h.baseY>this.camera-10);
  this.generate();return events;
 }
}