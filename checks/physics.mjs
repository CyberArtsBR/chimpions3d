import assert from 'node:assert/strict';
import {
 Game,STEP,WIDTH,JUMP,GRAVITY,SPRING_JUMP,LEAF_JUMP,PLATFORM_SCALE,PLATFORM_LENGTH,JET_DURATION,ITEM_SCALE,BANANA_HEIGHT,VINE_INSET,
 RULESET,WRAP_SPAN,paceAt,platformX,platformY,platformTravelFor
} from '../src/physics.js';
import {difficultyAt,SPECIAL_INTENSITY} from '../src/jumpGameplayDirector.js';
import {scoreFor,ordinal} from '../src/score.js';

assert.equal(scoreFor(123.9,4),163);
assert.equal(scoreFor(123.9,4,20),183);
assert.equal(scoreFor(500,0),500);
assert.equal(ordinal(1),'1st');assert.equal(ordinal(2),'2nd');assert.equal(ordinal(3),'3rd');assert.equal(ordinal(10),'10th');

assert.equal(RULESET,'2026-10-expedition-v15-mastery');
assert(JUMP*JUMP/(2*GRAVITY)>4.3);
assert(Math.abs(JUMP**2/13.6**2-1.3)<1e-10);
assert(Math.abs(SPRING_JUMP**2/28**2-1.3)<1e-10);
assert(LEAF_JUMP>JUMP&&LEAF_JUMP<SPRING_JUMP);
assert.equal(ITEM_SCALE,1.5);assert.equal(BANANA_HEIGHT,1.35);assert.equal(PLATFORM_SCALE,1.5*.75*.75);
assert.equal(JET_DURATION,8);

assert.equal(paceAt(0),.96);
assert.equal(paceAt(60),.96);
assert.equal(paceAt(180),.96);
assert.equal(paceAt(300),1.02);
assert.equal(paceAt(720),1.14);
assert(paceAt(10_000)>2.8,'Pace must remain uncapped after 1000m');

const early=difficultyAt(0,0),late=difficultyAt(1000,900);
assert(early.routeWidth>late.routeWidth);
assert(early.hazardDensity<late.hazardDensity);
assert(early.optionalRewardDistance<late.optionalRewardDistance);

function fixture(type='solid',routeTier='SAFE'){
 const g=new Game(1);
 g.platforms=[{id:0,x:0,baseX:0,y:0,baseY:0,width:3,type,coin:false,route:routeTier.toLowerCase(),routeTier,required:routeTier==='SAFE',broken:false,fragile:type==='cracked',phase:0,moveSpeed:1,moveRange:platformTravelFor(type),vanishAt:null}];
 g.hazards=[];g.nextY=100;g.nextJetAt=Infinity;g.nextEventAt=Infinity;
 return g;
}
const landing=fixture();landing.y=.05;landing.vy=-20;let landingEvents=landing.step(0);assert.equal(landing.y,0);assert.equal(landing.vy,JUMP);assert.equal(landingEvents.find(e=>e.type==='bounce')?.landingQuality,'PERFECT');assert.equal(landing.perfectLandings,1);assert(landing.skillBonus>0);
landing.y=-.1;landing.vy=10;landing.step(0);assert(landing.vy<10&&landing.vy>0);
const spring=fixture('spring');spring.y=.05;spring.vy=-20;spring.step(0);assert.equal(spring.vy,SPRING_JUMP);
const leaf=fixture('leaf','RISK');leaf.y=.05;leaf.vy=-20;leaf.step(0);assert.equal(leaf.vy,LEAF_JUMP);assert.equal(leaf.riskLandings,1);
const danger=fixture('solid','DANGER');danger.y=.05;danger.vy=-20;danger.step(0);assert.equal(danger.dangerLandings,1);assert(danger.skillBonus>=25);
const broken=fixture('cracked');broken.y=.05;broken.vy=-20;broken.step(0);assert(broken.platforms[0].broken);
const vanish=fixture('vanish');vanish.y=.05;vanish.vy=-20;let vanishEvents=vanish.step(0);for(let i=0;i<70;i++)vanishEvents.push(...vanish.step(0));assert(vanish.platforms[0].broken);assert(vanishEvents.some(e=>e.type==='vanish'));

const fast=fixture();fast.y=2;fast.vy=-1;fast.bounceAge=.5;const beforeFast=fast.vy;const fastEvents=fast.step({steer:0,fastFall:true});assert(fast.vy<beforeFast-GRAVITY*STEP);assert(fast.fastFallUsedSinceBounce);assert(fastEvents.some(e=>e.type==='fast-fall'));

const wrap=new Game(2);wrap.nextJetAt=Infinity;wrap.nextEventAt=Infinity;wrap.x=WIDTH/2-VINE_INSET-.01;wrap.vx=4.4;
const wrapEvents=wrap.step(1);assert(wrapEvents.some(e=>e.type==='wrap'&&e.side==='right'));assert(Math.abs(wrap.x)<=WRAP_SPAN/2+.001);

const moving={baseX:0,baseY:0,type:'moving',moveSpeed:1,moveRange:platformTravelFor('moving'),phase:.4};
assert.notEqual(platformX(moving,1),platformX(moving,2));
const leafPlatform={baseX:0,baseY:0,type:'leaf',moveSpeed:1,moveRange:platformTravelFor('leaf'),phase:.4};
assert.equal(platformX(leafPlatform,1),platformX(leafPlatform,2),'Leaf must flex/rebound rather than masquerade as a horizontal mover');
const swing={baseX:0,baseY:0,type:'swing',moveSpeed:1,moveRange:platformTravelFor('swing'),phase:.4};
assert.notEqual(platformX(swing,1),platformX(swing,2));assert.notEqual(platformY(swing,1),platformY(swing,2),'Swing must follow a pendulum arc');

const a=new Game(44),b=new Game(44);
a.nextJetAt=b.nextJetAt=Infinity;a.nextEventAt=b.nextEventAt=Infinity;
for(let i=0;i<600;i++){const axis=i%120<40?1:i%120<80?-1:0;a.step(axis);b.step(axis);}
assert.deepEqual(a,b);

for(let seed=0;seed<400;seed++){
 const g=new Game(seed);g.camera=260;g.generate();
 const safe=g.platforms.filter(p=>p.route==='safe').sort((x,y)=>x.y-y.y);
 assert(safe.length>10);
 for(let i=1;i<safe.length;i++){
  const rise=safe[i].y-safe[i-1].y;
  assert(rise>3.7&&rise<5.2,'Safe route vertical spacing must remain inside the current jump envelope');
  assert(safe[i].required!==false);assert.equal(safe[i].routeTier,'SAFE');
 }
 for(const p of g.platforms)assert(Math.abs(p.baseX)+p.width/2+platformTravelFor(p.type)<=WIDTH/2-VINE_INSET-.35+1e-9);
 const optional=g.platforms.filter(p=>p.route!=='safe');
 for(const p of optional)assert(['RISK','DANGER'].includes(p.routeTier));
}

const special=new Game(7);
assert(special.nextJetAt>=SPECIAL_INTENSITY.jetFirst[0]&&special.nextJetAt<=SPECIAL_INTENSITY.jetFirst[1]);
assert(special.nextEventAt>=SPECIAL_INTENSITY.eventFirst[0]&&special.nextEventAt<=SPECIAL_INTENSITY.eventFirst[1]);

console.log('PASS physics: mastery landings, real platform mechanics, Fast Fall, Flow scoring, deterministic routes, wrap and special budget');