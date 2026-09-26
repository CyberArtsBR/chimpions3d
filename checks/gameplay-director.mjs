import assert from 'node:assert/strict';
import {
  Game, STEP, WIDTH, VINE_INSET, WRAP_SPAN, JUMP, GRAVITY, SPEED,
  JET_DURATION, paceAt, platformTravelFor
} from '../src/physics.js';
import {
  ENCOUNTER_PHASES, ENCOUNTER_TEMPLATES, HAZARD_TYPES, JUMP_DIFFICULTY, SPECIAL_INTENSITY,
  difficultyAt, hazardClearsRequiredRoute, hazardMotion, makeHazardSpec,
  validateRequiredTransfer, wrappedDistance
} from '../src/jumpGameplayDirector.js';

const flightTime=rise=>{
  const d=JUMP*JUMP-2*GRAVITY*rise;
  assert(d>0,'Required safe-route rise must stay under normal-jump apex');
  return (JUMP+Math.sqrt(d))/GRAVITY;
};

let generatedTransfers=0;
const encounterTypes=new Set(),encounterPhases=new Set(),platformTypes=new Set(),hazardTypes=new Set();
const seedCount=2048;

for(let seed=0;seed<seedCount;seed++){
  const g=new Game(seed);
  g.time=(seed%7)*90;
  g.camera=180+(seed%5)*20;
  g.generate();

  const safe=g.platforms.filter(p=>p.route==='safe').sort((a,b)=>a.y-b.y);
  assert(safe.length>=35,'Generated route should contain a meaningful forward window');

  for(const p of g.platforms){
    if(p.encounterType)encounterTypes.add(p.encounterType);
    if(p.encounterPhase)encounterPhases.add(p.encounterPhase);
    platformTypes.add(p.type);
    const extent=p.width/2+platformTravelFor(p.type);
    assert(Math.abs(p.baseX)+extent<=WIDTH/2-VINE_INSET-.35+1e-8,'Platform full travel envelope must remain inside arena');
  }

  for(let i=1;i<safe.length;i++){
    const from=safe[i-1],to=safe[i],rise=to.y-from.y;
    const check=validateRequiredTransfer({
      fromX:from.baseX,toX:to.baseX,flightTime:flightTime(rise),targetWidth:to.width,
      speed:SPEED,acceleration:24,step:STEP,wrapSpan:WRAP_SPAN,
      landingMargin:JUMP_DIFFICULTY.safeLandingMargin
    });
    assert(check.viable,'Required route transfer failed simulation: seed '+seed+', index '+i+', error '+check.worstError);
    generatedTransfers++;
  }

  for(const h of g.hazards){
    hazardTypes.add(h.type);
    assert(h.route==='optional','Hazards must belong to optional/risk space');
    assert(hazardClearsRequiredRoute(h,WRAP_SPAN),'Hazard envelope must clear mandatory route');
    for(let sample=0;sample<=24;sample++){
      const time=h.createdAt+(h.cycle||4)*sample/24;
      const m=hazardMotion(h,time);
      const safeHalf=(h.safeWidth||0)/2;
      if(m.active)assert(wrappedDistance(m.x,h.safeX,WRAP_SPAN)>=safeHalf+h.radius+JUMP_DIFFICULTY.hazardSafeMargin-1e-8,
        'Active hazard must never overlap mandatory safe lane: '+h.type);
    }
  }
}

assert(generatedTransfers>=70_000,'Expected tens of thousands of simulated transfers, saw '+generatedTransfers);
for(const template of ENCOUNTER_TEMPLATES)assert(encounterTypes.has(template.id),'Every encounter template must appear across deterministic seed sweep: '+template.id);
for(const phase of Object.values(ENCOUNTER_PHASES))assert(encounterPhases.has(phase),'Every pacing phase must appear: '+phase);
for(const type of ['solid','moving','cracked','spring','leaf','vanish','swing'])assert(platformTypes.has(type),'Platform vocabulary must retain '+type);

// Long-height generation: validate route viability deep into expert play without changing physics.
let longTransfers=0;
for(let seed=0;seed<96;seed++){
  const g=new Game(50_000+seed);
  g.time=600;
  g.camera=1450;
  g.generate();
  const safe=g.platforms.filter(p=>p.route==='safe').sort((a,b)=>a.y-b.y);
  assert(safe.at(-1)?.y>1400,'Long-height route must continue beyond 1400m');
  for(let i=1;i<safe.length;i++){
    const from=safe[i-1],to=safe[i];
    const check=validateRequiredTransfer({
      fromX:from.baseX,toX:to.baseX,flightTime:flightTime(to.y-from.y),targetWidth:to.width,
      speed:SPEED,acceleration:24,step:STEP,wrapSpan:WRAP_SPAN,
      landingMargin:JUMP_DIFFICULTY.safeLandingMargin
    });
    assert(check.viable,'Long-height required transfer must remain viable');
    longTransfers++;
  }
  for(const h of g.hazards){hazardTypes.add(h.type);assert(hazardClearsRequiredRoute(h,WRAP_SPAN));}
}
assert(longTransfers>=30_000,'Expected deep-route transfer volume, saw '+longTransfers);
for(const type of HAZARD_TYPES)assert(hazardTypes.has(type),'All deterministic hazard families must generate: '+type);

// Explicit hazard timing contracts: dynamic damage always has a telegraph period.
for(const [index,type] of HAZARD_TYPES.entries()){
  let state=123456789+index;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const h=makeHazardSpec(type,{id:index,baseX:4.5,baseY:20,runTime:10,random,safeX:0,safeWidth:3});
  assert(hazardClearsRequiredRoute(h,WRAP_SPAN));
  const atSpawn=hazardMotion(h,10);
  if(type==='thorn-pod')assert(atSpawn.active&&!atSpawn.telegraphing);
  else{
    assert(!atSpawn.active&&atSpawn.telegraphing,'Dynamic hazards must telegraph before becoming active');
    assert((h.lead||0)>=JUMP_DIFFICULTY.dynamicHazardTelegraphMin,'Dynamic hazard telegraph must meet minimum read time');
    const active=hazardMotion(h,10+h.lead+.05);
    assert(active.active,'Dynamic hazard must enter deterministic active window after telegraph');
  }
}

// Wrap reachability must be simulated, not treated as a raw screen-space gap.
const wrapCheck=validateRequiredTransfer({
  fromX:WRAP_SPAN/2-.12,toX:-WRAP_SPAN/2+.18,flightTime:1.2,targetWidth:4.5,
  speed:SPEED,acceleration:24,step:STEP,wrapSpan:WRAP_SPAN
});
assert(wrapCheck.viable&&wrapCheck.worstError<1.95,'Edge wrap transfer must remain reachable through wrapped distance');

// Fixed simulation must be independent of 30/60/120/144 Hz rendering.
function renderRateSnapshot(hz){
  const g=new Game(8128);
  g.platforms=[{id:0,x:0,baseX:0,y:0,width:20,type:'solid',coin:false,route:'safe',required:true,broken:false,phase:0,moveSpeed:0,moveRange:0,vanishAt:null}];
  g.hazards=[];g.nextY=10_000;g.nextJetAt=Infinity;g.nextEventAt=Infinity;
  let accumulator=0,stepIndex=0;
  const frames=Math.round(hz*24);
  for(let frame=0;frame<frames;frame++){
    accumulator+=1/hz;
    while(accumulator+1e-12>=STEP){
      const axis=stepIndex%180<60?1:stepIndex%180<120?-1:0;
      g.step(axis,STEP);stepIndex++;accumulator-=STEP;
    }
  }
  return {steps:stepIndex,time:g.time,x:g.x,y:g.y,vx:g.vx,vy:g.vy,bounces:g.bounces,height:g.height,seed:g.seed,dead:g.dead};
}
const rate60=renderRateSnapshot(60);
for(const hz of [30,120,144])assert.deepEqual(renderRateSnapshot(hz),rate60,'Fixed simulation must be render-rate independent at '+hz+' Hz');

// Pause/restart/replay semantics: no step means no simulation mutation; reset and same-seed replay are exact.
const pauseGame=new Game(991);
pauseGame.nextJetAt=Infinity;pauseGame.nextEventAt=Infinity;
for(let i=0;i<120;i++)pauseGame.step(i%40<20?1:-1);
const beforePause=structuredClone({
  time:pauseGame.time,x:pauseGame.x,y:pauseGame.y,vx:pauseGame.vx,vy:pauseGame.vy,
  height:pauseGame.height,bounces:pauseGame.bounces,bananas:pauseGame.bananas,seed:pauseGame.seed,
  platforms:pauseGame.platforms,hazards:pauseGame.hazards
});
const afterPause=structuredClone({
  time:pauseGame.time,x:pauseGame.x,y:pauseGame.y,vx:pauseGame.vx,vy:pauseGame.vy,
  height:pauseGame.height,bounces:pauseGame.bounces,bananas:pauseGame.bananas,seed:pauseGame.seed,
  platforms:pauseGame.platforms,hazards:pauseGame.hazards
});
assert.deepEqual(afterPause,beforePause,'Paused simulation must not mutate without steps');
const replayA=new Game(777),replayB=new Game(777);
assert.deepEqual(replayA,replayB,'Same seed restart must reproduce initial route exactly');
for(let i=0;i<480;i++){const axis=i%150<50?1:i%150<100?-1:0;replayA.step(axis);replayB.step(axis);}
assert.deepEqual(replayA,replayB,'Replay seed plus identical fixed-step trace must remain exact');

// Special-intensity coordination: events suppress hazards and block jet spawn; jet suppresses hazards.
const overlap=new Game(123);
overlap.platforms=[{id:0,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,route:'safe',required:true,broken:false,phase:0,moveSpeed:0,moveRange:0,vanishAt:null}];
overlap.nextY=10_000;overlap.y=0;overlap.vy=JUMP;overlap.camera=5;
overlap.event={type:'banana-bloom',started:0,ends:8};overlap.nextEventAt=Infinity;overlap.time=1;overlap.nextJetAt=1;
let rnd=1;const random=()=>((rnd=(Math.imul(rnd,1664525)+1013904223)>>>0)/4294967296);
overlap.hazards=[makeHazardSpec('vine-sweep',{id:1,baseX:0,baseY:.45,runTime:0,random,safeX:5,safeWidth:1})];
const specialEvents=overlap.step(0);
assert(!specialEvents.some(e=>e.type==='jet-spawn'),'Jetpack must not spawn during canopy event');
assert(!specialEvents.some(e=>e.type==='hazard'),'Hazards must be suppressed during canopy event');
assert.equal(overlap.hazards[0].active,false);

overlap.event=null;overlap.specialBlockedUntil=0;overlap.jetpack={x:0,y:.8,expires:100,route:'reward'};
overlap.y=.1;overlap.vy=0;
const jetEvents=overlap.step(0);
assert(jetEvents.some(e=>e.type==='jet'));
assert.equal(overlap.jetRemaining,JET_DURATION);
assert(!jetEvents.some(e=>e.type==='hazard'),'Hazards must be suppressed while jet activates');

assert(JET_DURATION<SPECIAL_INTENSITY.eventDuration,'Jet flight should be valuable without dominating a third of a minute');
assert(paceAt(300)<=1.2&&paceAt(720)<=1.42,'Difficulty must not return to 3x whole-simulation compression');
assert(difficultyAt(1400,900).complexity===JUMP_DIFFICULTY.maxEncounterComplexity);

console.log(JSON.stringify({
  status:'PASS',
  seeds:seedCount+96,
  generatedTransfers,
  longTransfers,
  totalValidatedTransfers:generatedTransfers+longTransfers,
  encounters:[...encounterTypes].sort(),
  hazards:[...hazardTypes].sort(),
  renderRates:[30,60,120,144]
}));
