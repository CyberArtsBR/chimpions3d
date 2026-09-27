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
export const SPRING_JUMP=28*Math.sqrt(1.3), JET_DURATION=SPECIAL_INTENSITY.jetDuration, JET_SPEED=24;
export const VINE_INSET=.24;
export const EVENT_INTERVAL=65, EVENT_DURATION=SPECIAL_INTENSITY.eventDuration;
export const RULESET='2026-09-expedition-v12-200m-pace';
export const WRAP_SPAN=WIDTH-2*VINE_INSET;

const wrapX=x=>((x+WRAP_SPAN/2)%WRAP_SPAN+WRAP_SPAN)%WRAP_SPAN-WRAP_SPAN/2;
const wrappedDistance=(a,b)=>directedWrappedDistance(a,b,WRAP_SPAN);

// Pace now advances only at deterministic 200m altitude milestones.
// Jump geometry stays unchanged; only simulation pace increases in modest steps.
export const paceAt=height=>directedPaceAt(height);

const PLATFORM_TRAVEL=1.65, PLATFORM_HEIGHT_BAND=2.2, PLATFORM_GAP=.8;
export const platformTravelFor=type=>type==='moving'?PLATFORM_TRAVEL:type==='leaf'?1.05:type==='swing'?1.35:0;

// Moving-platform speed no longer gets a second late-run acceleration multiplier.
export const platformPhaseAt=time=>.72*Math.max(0,time);

export const movingX=(platform,time)=>
 platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange??PLATFORM_TRAVEL);

export const platformX=(platform,time)=>{
 if(platform.type==='moving')return movingX(platform,time);
 if(platform.type==='leaf')return platform.baseX+Math.sin(platformPhaseAt(time)*.58*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange||1.05);
 if(platform.type==='swing')return platform.baseX+Math.sin(time*(.78+(platform.moveSpeed||1)*.18)+(platform.phase||0))*(platform.moveRange||1.35);
 return platform.baseX;
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
  this.add(0,0,2.8,'solid',false,'safe',{encounterType:'start',encounterPhase:ENCOUNTER_PHASES.READ});
  this.generate();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 canPlace(x,y,width,type){
  const extent=width/2+platformTravelFor(type);
  if(Math.abs(x)+extent>WIDTH/2-VINE_INSET-.35)return false;
  return this.platforms.every(p=>p.broken||Math.abs(p.y-y)>=PLATFORM_HEIGHT_BAND||
   Math.abs(p.baseX-x)>=extent+p.width/2+platformTravelFor(p.type)+PLATFORM_GAP);
 }
 add(x,y,width,type,coin=true,route='safe',metadata={}){
  const size=Math.max(0,Math.min(1,(width-.95)/1.5));
  width*=PLATFORM_LENGTH;
  const moveRange=platformTravelFor(type),moveSpeed=1.25*(.62+.86*size);
  if(!this.canPlace(x,y,width,type))return false;
  this.platforms.push({
   id:this.nextId++,x,baseX:x,y,width,type,coin,route,
   reward:width<=1.3*PLATFORM_LENGTH?2:1,
   fragile:type==='cracked',broken:false,phase:this.random()*6.28,
   moveSpeed,moveRange,vanishAt:null,...metadata
  });
  const platform=this.platforms.at(-1);
  if(moveRange)platform.x=platformX(platform,this.time);
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
  const reward=!!step.reward,coin=this.random()<(reward ? .88 : .44);
  if(!this.add(px,y,width,type,coin,reward?'reward':'risk',{
   encounterId:step.encounterId,encounterType:step.encounterType,encounterPhase:step.phase,encounterStep:step.encounterStep
  }))return null;
  const placed=this.platforms.at(-1);if(reward)placed.reward=2;
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
   const phaseShift=step.phase===ENCOUNTER_PHASES.CHALLENGE?1:step.phase===ENCOUNTER_PHASES.BUILD?.98:recovery?.94:.96;
   const reach=Math.min(difficulty.routeShift*phaseShift,WIDTH/2);
   const minShiftFactor=step.phase===ENCOUNTER_PHASES.CHALLENGE?1:step.phase===ENCOUNTER_PHASES.BUILD?.98:recovery?.90:.95;
   const edgeGap=difficulty.routeEdgeGap*(recovery?.58:1);
   const footprintShift=(this.nextWidth+targetWidth)/2+edgeGap;
   const minShift=Math.min(reach*.97,Math.max(2.35,difficulty.routeMinShift*minShiftFactor,footprintShift));
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
    const useOpposite=opposite.length&&this.lastRouteDirection&&this.random()<.72;
    const directionalPool=useOpposite?opposite:ranked;
    const hardFraction=step.phase===ENCOUNTER_PHASES.CHALLENGE?.18:recovery?.42:.28;
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
    encounterId:step.encounterId,encounterType:step.encounterType,encounterPhase:step.phase,encounterStep:step.encounterStep,
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

   if(optional&&difficulty.complexity>=4&&step.phase===ENCOUNTER_PHASES.CHALLENGE&&this.random()<.28){
    const echo={...step,optional:this.random()<.5?'leaf':'cracked',reward:true,hazard:null};
    this.addOptional(echo,safePlatform,difficulty);
   }
  }
 }
 spawnJetpack(){
  const optional=this.platforms.filter(p=>!p.broken&&p.route!=='safe'&&p.y>this.camera-4&&p.y<this.camera+4);
  const supports=optional.length?optional:this.platforms.filter(p=>!p.broken&&p.y>this.camera-4&&p.y<this.camera+4);
  const span=WRAP_SPAN;
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
  const events=[],realDt=dt;this.time+=realDt;this.updateCanopyEvent(events);
  this.hazardCooldown=Math.max(0,this.hazardCooldown-realDt);

  dt*=paceAt(this.height);this.bounceAge+=dt;
  this.previousCamera=this.camera;
  const target=input*SPEED,amount=24*dt;
  this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));

  const oldX=this.x,oldY=this.y,travel=this.vx*dt;
  const vineX=WIDTH/2-VINE_INSET,nextX=oldX+travel;
  if(nextX>vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'right',x:this.x,y:this.y});}
  else if(nextX<-vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'left',x:this.x,y:this.y});}
  else this.x=nextX;

  if(this.jetRemaining>0){
   const flight=Math.min(realDt,this.jetRemaining);this.y+=JET_SPEED*flight;this.jetRemaining=Math.max(0,this.jetRemaining-realDt);this.vy=JET_SPEED/paceAt(this.height);
   if(this.jetRemaining===0){
    this.vy=JUMP;
    for(const h of this.hazards)if(h.type!=='thorn-pod'){h.createdAt=this.time;h.telegraphCycle=-1;h.activeCycle=-1;}
    events.push({type:'jet-end'});
   }
  }else{
   this.y+=this.vy*dt-.5*GRAVITY*dt*dt;this.vy-=GRAVITY*dt;
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

  let landing=null,earliest=2;
  for(const p of this.platforms){
   const previousX=p.x;
   if(platformTravelFor(p.type))p.x=platformX(p,this.time);
   if(p.broken)continue;
   if(this.vy<0&&oldY>=p.y&&this.y<=p.y){
    const t=(oldY-p.y)/(oldY-this.y),x=oldX+travel*t;
    const px=previousX+(p.x-previousX)*t,distance=wrappedDistance(x,px);
    if(distance<p.width/2+.24&&t<earliest){earliest=t;landing=p;}
   }
   const dx=wrappedDistance(this.x,p.x);
   if(p.coin&&dx<.65*ITEM_SCALE&&Math.abs(this.y+.65-(p.y+BANANA_HEIGHT))<.85+.25*(ITEM_SCALE-1)){
    p.coin=false;
    const bloom=this.event?.type==='banana-bloom'?1:0,value=(p.reward||1)+bloom;
    this.bananas+=value;events.push({type:'coin',x:p.x,y:p.y+BANANA_HEIGHT,value,bloom:!!bloom,route:p.route});
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
     this.vy=Math.min(this.vy,-2.4);this.hazardCooldown=.9;
     events.push({type:'hazard',hazardType:h.type,x:h.x,y:h.y,hazardId:h.id});break;
    }
    if(dx<h.radius+1.0&&dy<.86&&h.nearMissCycle!==h.activeCycle){
     h.nearMissCycle=h.activeCycle;
     events.push({type:'near-miss',hazardType:h.type,x:h.x,y:h.y,hazardId:h.id});
    }
   }
  }

  if(landing){
   this.y=landing.y;
   const springBoost=this.event?.type==='spring-fever'?1.08:1;
   this.vy=landing.type==='spring'?SPRING_JUMP*springBoost:JUMP;
   this.bounceAge=0;this.bounces++;
   if(landing.type==='cracked'||landing.fragile)landing.broken=true;
   if(landing.type==='vanish'&&landing.vanishAt==null)landing.vanishAt=this.time+.55;
   events.push({
    type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring',
    fragile:landing.type==='cracked',platformType:landing.type,
    route:landing.route,platformId:landing.id,
    encounterId:landing.encounterId,encounterType:landing.encounterType,encounterPhase:landing.encounterPhase
   });
   if(landing.route==='safe'&&landing.encounterPhase===ENCOUNTER_PHASES.RELEASE)
    events.push({type:'encounter-complete',encounterId:landing.encounterId,encounterType:landing.encounterType,x:this.x,y:this.y});
  }

  this.height=Math.max(this.height,this.y);
  const milestone=Math.floor(this.height/50)*50;
  if(milestone>this.lastMilestone){
   this.lastMilestone=milestone;if(milestone>0)events.push({type:'milestone',meters:milestone,x:this.x,y:this.y});
  }

  const cameraTarget=Math.max(this.camera,this.height-VIEW_HEIGHT*.085+Math.max(0,this.vy)*.018);
  this.camera+=Math.max(0,cameraTarget-this.camera)*(1-Math.exp(-8*dt));
  if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death'});}

  this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
  this.hazards=this.hazards.filter(h=>h.baseY>this.camera-10);
  this.generate();return events;
 }
}
