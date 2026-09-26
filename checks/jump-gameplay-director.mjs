import assert from 'node:assert/strict';
import {
 Game,STEP,WIDTH,JUMP,GRAVITY,SPRING_JUMP,PLATFORM_SCALE,PLATFORM_LENGTH,JET_DURATION,ITEM_SCALE,BANANA_HEIGHT,VINE_INSET,
 RULESET,WRAP_SPAN,paceAt,platformX,platformTravelFor
} from '../src/physics.js';
import {
 ENCOUNTER_PHASES,ENCOUNTER_TEMPLATES,HAZARD_TYPES,JUMP_DIFFICULTY,SPECIAL_INTENSITY,
 difficultyAt,firstEventTime,firstJetTime,hazardClearsRequiredRoute,hazardMotion,makeHazardSpec,
 validateRequiredTransfer,wrappedDistance
} from '../src/jumpGameplayDirector.js';
import {scoreFor,ordinal} from '../src/score.js';

assert.equal(scoreFor(123.9,4),163);
assert.equal(scoreFor(500,0),500);
assert.equal(ordinal(1),'1st');
assert.equal(ordinal(2),'2nd');
assert.equal(ordinal(3),'3rd');
assert.equal(ordinal(10),'10th');

assert.equal(RULESET,'2026-09-expedition-v8-gameplay-director');
assert(JUMP*JUMP/(2*GRAVITY)>4.3);
assert(Math.abs(JUMP**2/12.6**2-1.3)<1e-10,'Normal jump impulse remains unchanged');
assert(Math.abs(SPRING_JUMP**2/28**2-1.3)<1e-10,'Spring jump impulse remains unchanged');
assert.equal(ITEM_SCALE,1.5);
assert.equal(BANANA_HEIGHT,1.35);
assert.equal(PLATFORM_SCALE,1.5*.75*.75);

const expectedPace=new Map([[0,.96],[60,1],[180,1.1],[300,1.2],[480,1.32],[720,1.42],[10_000,1.42]]);
for(const [time,value] of expectedPace)assert(Math.abs(paceAt(time)-value)<1e-10,'Unexpected pace at '+time);
assert(paceAt(300)<1.25&&paceAt(10_000)<1.5,'Global pace remains modest rather than reaching the previous 3x');

const early=difficultyAt(0,0),mid=difficultyAt(450,300),late=difficultyAt(1000,900);
assert(early.routeWidth>mid.routeWidth&&mid.routeWidth>late.routeWidth);
assert(early.optionalRewardDistance<mid.optionalRewardDistance&&mid.optionalRewardDistance<late.optionalRewardDistance);
assert(early.hazardDensity<mid.hazardDensity&&mid.hazardDensity<=late.hazardDensity);
assert(early.complexity<late.complexity);

function fixture(type='solid'){
 const g=new Game(1);
 g.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type,coin:false,route:'safe',required:true,broken:false,phase:0,moveSpeed:1,moveRange:platformTravelFor(type),vanishAt:null}];
 g.hazards=[];g.nextY=100;g.nextJetAt=Infinity;g.nextEventAt=Infinity;
 return g;
}
const landing=fixture();landing.y=.05;landing.vy=-20;landing.step(0);assert.equal(landing.y,0);assert.equal(landing.vy,JUMP);
landing.y=-.1;landing.vy=10;landing.step(0);assert(landing.vy<10&&landing.vy>0,'Ascending character still passes through branches');
const spring=fixture('spring');spring.y=.05;spring.vy=-20;spring.step(0);assert.equal(spring.vy,SPRING_JUMP);
const cracked=fixture('cracked');cracked.y=.05;cracked.vy=-20;cracked.step(0);assert(cracked.platforms[0].broken);
const vanish=fixture('vanish');vanish.y=.05;vanish.vy=-20;let vanishEvents=vanish.step(0);assert(vanishEvents.some(e=>e.type==='bounce'));for(let i=0;i<40;i++)vanishEvents.push(...vanish.step(0));assert(vanish.platforms[0].broken);assert(vanishEvents.some(e=>e.type==='vanish'));

const wrap=new Game(2);wrap.nextJetAt=Infinity;wrap.nextEventAt=Infinity;wrap.x=WIDTH/2-VINE_INSET-.01;wrap.vx=4.4;
const wrapEvents=wrap.step(1);assert(wrapEvents.some(e=>e.type==='wrap'&&e.side==='right'));assert(Math.abs(wrap.x)<=WRAP_SPAN/2+.001);

for(const type of ['moving','leaf','swing']){
 const p={baseX:0,type,moveSpeed:1,moveRange:platformTravelFor(type),phase:.4};
 assert.notEqual(platformX(p,1),platformX(p,2),type+' platform must move deterministically');
}

const deterministicA=new Game(44),deterministicB=new Game(44);
deterministicA.nextJetAt=deterministicB.nextJetAt=Infinity;
deterministicA.nextEventAt=deterministicB.nextEventAt=Infinity;
for(let i=0;i<900;i++){
 const input=i%160<45?1:i%160>115?-1:0;
 deterministicA.step(input);deterministicB.step(input);
}
assert.deepEqual(deterministicA,deterministicB,'Same seed and fixed-step input trace must reproduce exactly');

const renderRates=[30,60,120,144];
const renderSnapshots=[];
for(const hz of renderRates){
 const g=new Game(90210);g.nextJetAt=Infinity;g.nextEventAt=Infinity;
 let accumulator=0,simTime=0;
 const renderDt=1/hz;
 while(simTime<6){
  accumulator+=renderDt;simTime+=renderDt;
  while(accumulator+1e-12>=STEP){
   const axis=g.time<2?1:g.time<4?-1:.25;
   g.step(axis,STEP);accumulator-=STEP;
  }
 }
 renderSnapshots.push(JSON.stringify({x:g.x,y:g.y,vx:g.vx,vy:g.vy,time:g.time,height:g.height,bounces:g.bounces,dead:g.dead}));
}
assert.equal(new Set(renderSnapshots).size,1,'30/60/120/144 Hz render cadence must not alter fixed-step simulation');

let transferCount=0,safePlatforms=0,hazardCount=0;
const encounterTypes=new Set(),hazardTypes=new Set(),phases=new Set();
for(let seed=0;seed<2000;seed++){
 const g=new Game(seed);
 g.camera=150+(seed%5)*80;
 g.generate();
 const safe=g.platforms.filter(p=>p.route==='safe').sort((a,b)=>a.y-b.y);
 safePlatforms+=safe.length;
 for(const p of safe){if(p.encounterType)encounterTypes.add(p.encounterType);if(p.encounterPhase)phases.add(p.encounterPhase);}
 for(let i=1;i<safe.length;i++){
  const a=safe[i-1],b=safe[i],rise=b.y-a.y;
  const disc=JUMP*JUMP-2*GRAVITY*rise;
  assert(disc>0,'Required route vertical reach failed');
  const flight=(JUMP+Math.sqrt(disc))/GRAVITY;
  const result=validateRequiredTransfer({
   fromX:a.baseX,toX:b.baseX,flightTime:flight,targetWidth:b.width,
   speed:6.2,acceleration:24,step:STEP,wrapSpan:WRAP_SPAN,landingMargin:JUMP_DIFFICULTY.safeLandingMargin
  });
  assert(result.viable,'Required route transfer failed seed '+seed+' row '+i+' error '+result.worstError);
  transferCount++;
 }
 for(const h of g.hazards){
  hazardCount++;hazardTypes.add(h.type);
  assert(hazardClearsRequiredRoute(h,WRAP_SPAN),'Hazard envelope intersects required safe route');
  if(h.type!=='thorn-pod')assert((h.lead||0)>=JUMP_DIFFICULTY.dynamicHazardTelegraphMin,'Dynamic hazard telegraph too short');
 }
}
assert(transferCount>=50_000,'Expected at least fifty thousand validated transfers, got '+transferCount);
assert(safePlatforms>transferCount);
assert(hazardCount>0);

for(const phase of Object.values(ENCOUNTER_PHASES))assert(phases.has(phase),'Missing generated pacing phase '+phase);
for(const template of ENCOUNTER_TEMPLATES){
 const g=new Game(template.complexity*7919);
 g.platforms=[{id:0,x:0,baseX:0,y:1000,width:2.3*PLATFORM_LENGTH,type:'solid',coin:false,route:'safe',required:true,broken:false,phase:0,moveSpeed:1,moveRange:0,vanishAt:null}];
 g.hazards=[];g.nextY=1000;g.nextX=0;g.nextWidth=2.3*PLATFORM_LENGTH;g.camera=1125;g.time=900;g.encounter=null;g.lastEncounterId='';
 g.generate();
 for(const p of g.platforms)if(p.encounterType)encounterTypes.add(p.encounterType);
 for(const h of g.hazards)hazardTypes.add(h.type);
}
for(const template of ENCOUNTER_TEMPLATES)assert(encounterTypes.has(template.id),'Encounter template never generated: '+template.id);

let syntheticSeed=17;
const random=()=>((syntheticSeed=(Math.imul(syntheticSeed,1664525)+1013904223)>>>0)/4294967296);
for(const type of HAZARD_TYPES){
 const h=makeHazardSpec(type,{id:1,baseX:4.5,baseY:20,runTime:10,random,safeX:0,safeWidth:2.2});
 hazardTypes.add(h.type);
 assert(hazardClearsRequiredRoute(h,WRAP_SPAN));
 if(type!=='thorn-pod'){
  const pre=hazardMotion(h,10+Math.min(.2,h.lead*.25));
  assert(pre.telegraphing&&!pre.active,type+' must telegraph before activation');
  const active=hazardMotion(h,10+h.lead+.05);
  assert(active.active,type+' must expose a deterministic active window');
 }
}
for(const type of HAZARD_TYPES)assert(hazardTypes.has(type),'Hazard family untested: '+type);

for(let seed=0;seed<2000;seed++){
 const jet=firstJetTime(seed),event=firstEventTime(seed);
 assert(jet>=SPECIAL_INTENSITY.jetFirst[0]&&jet<=SPECIAL_INTENSITY.jetFirst[1]);
 assert(event>=SPECIAL_INTENSITY.eventFirst[0]&&event<=SPECIAL_INTENSITY.eventFirst[1]);
}
const budget=new Game(77);budget.nextY=10000;budget.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type:'solid',coin:false,route:'safe',required:true,broken:false,phase:0,moveSpeed:1,moveRange:0,vanishAt:null}];
budget.hazards=[];budget.jetRemaining=4;budget.nextEventAt=budget.time;let budgetEvents=[];budget.updateCanopyEvent(budgetEvents);assert(!budget.event,'Canopy event must not start during jetpack');
budget.jetRemaining=0;budget.jetpack={x:0,y:0,expires:100,route:'reward'};budget.nextEventAt=budget.time;budgetEvents=[];budget.updateCanopyEvent(budgetEvents);assert(!budget.event,'Canopy event must not start while jetpack pickup is active');
budget.jetpack=null;budget.specialBlockedUntil=0;budgetEvents=[];budget.updateCanopyEvent(budgetEvents);assert(budget.event&&budgetEvents.some(e=>e.type==='event-start'));
budget.nextJetAt=budget.time;const beforeJet=budget.jetpack;budget.step(0);assert.equal(budget.jetpack,beforeJet,'Jetpack must not spawn on top of an active canopy event');

const replaySeed=123456789,replayA=new Game(replaySeed),replayB=new Game(replaySeed);
for(let i=0;i<1800&&!replayA.dead&&!replayB.dead;i++){
 const axis=i%210<70?.82:i%210<140?-.67:0;
 replayA.step(axis);replayB.step(axis);
}
assert.deepEqual(replayA,replayB,'Replay seed and trace must remain deterministic after director changes');
replayA.reset(replaySeed);
const replayC=new Game(replaySeed);assert.deepEqual(replayA,replayC,'Restart/reset must restore deterministic run state');

console.log(JSON.stringify({
 status:'PASS',
 ruleset:RULESET,
 seeds:2000,
 validatedTransfers:transferCount,
 safePlatforms,
 hazards:hazardCount,
 encounterTemplates:[...encounterTypes].sort(),
 hazardFamilies:[...hazardTypes].sort(),
 renderRates,
 pace:{start:paceAt(0),minute3:paceAt(180),minute5:paceAt(300),cap:paceAt(10000)},
 jetDuration:JET_DURATION
},null,2));
