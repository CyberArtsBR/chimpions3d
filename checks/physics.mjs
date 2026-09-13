import assert from 'node:assert/strict';
import {Game,STEP,WIDTH,JUMP,GRAVITY,SPRING_JUMP,PLATFORM_SCALE,ITEM_SCALE,VINE_INSET,paceAt,movingX,platformPhaseAt} from '../src/physics.js';
assert(JUMP*JUMP/(2*GRAVITY)>4.3);assert(2*JUMP/GRAVITY>=1.4);
let pairs=0;
for(const age of [0,90,180,360])for(let seed=0;seed<100;seed++){
 const g=new Game(seed);g.time=age;g.camera=200;g.generate();
 const safe=g.platforms.filter(p=>p.route==='safe').sort((a,b)=>a.y-b.y);
 for(let i=1;i<safe.length;i++){
  const prev=safe[i-1],p=safe[i],dy=p.y-prev.y;
  assert(dy>=3.84&&dy<=4.06,'Rows must remain widely spaced');
  assert(Math.abs(p.baseX-prev.baseX)>=1.64,'Avoid stacked branches');
  const test=new Game(seed);test.platforms=[{...p}];test.nextY=1000;
  test.nextJetAt=Infinity;test.time=age;test.y=prev.y;test.x=prev.x;test.vy=JUMP;test.height=prev.y;test.camera=Math.max(5,prev.y-.8);
  for(let tick=0;tick<100&&!test.bounces&&!test.dead;tick++){
   const target=p.type==='moving'?movingX(p,test.time+STEP):p.baseX;
   const distance=target-test.x-test.vx*Math.abs(test.vx)/48;
   test.step(Math.abs(distance)<.08?0:Math.sign(distance));
  }
  assert(test.bounces>0,'Generated transfer must be reachable: seed '+seed+' row '+i);pairs++;
 }
}
function fixture(type='solid'){
 const g=new Game(1);g.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type,coin:false,broken:false}];g.nextY=100;
 return g;
}
const bounce=fixture();for(let i=0;i<120;i++)bounce.step(0);assert(bounce.bounces>0);
const landing=fixture();landing.y=.05;landing.vy=-20;landing.step(0);assert.equal(landing.y,0);assert.equal(landing.vy,JUMP);
landing.y=-.1;landing.vy=10;landing.step(0);assert(landing.vy<10&&landing.vy>0,'Pass upwards through branches');
const wrap=new Game(2);wrap.x=WIDTH/2-.01;wrap.vx=4.4;const momentum=wrap.vx;const wrapEvents=wrap.step(1);assert.equal(wrap.x,-WIDTH/2+VINE_INSET);assert(wrap.vx>=momentum);assert(wrapEvents.some(e=>e.type==='wrap'&&e.side==='right'));
const a=new Game(44),b=new Game(44);for(let i=0;i<300;i++){a.step(i%80<40?1:-1);b.step(i%80<40?1:-1);}assert.deepEqual(a,b);
const fall=new Game(1);fall.y=-20;fall.step(0);assert(fall.dead);fall.reset(1);assert(!fall.dead&&fall.time===0);
const spring=fixture('spring');spring.y=.05;spring.vy=-20;spring.step(0);assert.equal(spring.vy,SPRING_JUMP);
const broken=fixture('cracked');broken.y=.05;broken.vy=-20;broken.step(0);assert(broken.platforms[0].broken);
// Standing still must no longer climb the generated route indefinitely.
const idle=new Game(9);for(let i=0;i<3600;i++)idle.step(0);const idleHeight=idle.height;for(let i=0;i<3600;i++)idle.step(0);assert(idle.height-idleHeight<.01,'Wider early branches may help, but standing still cannot climb indefinitely');
assert.equal(paceAt(0),.92);assert(paceAt(180)<3);assert(Math.abs(paceAt(300)-3)<1e-10);assert(Math.abs(paceAt(10000)-3)<1e-10);
assert(platformPhaseAt(180.001)-platformPhaseAt(180)<.002,'Moving phase stays continuous at speed cap');
const rates=[];for(const age of [0,180]){let moving=0,total=0;for(let seed=0;seed<100;seed++){const g=new Game(seed);g.time=age;g.camera=200;g.generate();for(const p of g.platforms.filter(p=>p.y>20&&p.route==='safe')){total++;if(p.type==='moving')moving++;}}rates.push(moving/total);}
assert(rates[0]>.30&&rates[0]<.40);assert(rates[1]>.49&&rates[1]<.61);
console.log('PASS physics: '+pairs+' generated transfers, larger gaps, near-apex arcs, wrap, landing, spring, fragile branches, retry');

assert(SPRING_JUMP**2/15.5**2>=3,'Spring height at least triples');
const jet=new Game(7);jet.time=59.99;jet.step(0);assert(jet.jetpack,'Minute spawns a jetpack');
jet.x=jet.jetpack.x;jet.y=jet.jetpack.y-.7;jet.vy=0;jet.step(0);assert.equal(jet.jetRemaining,5);
const startY=jet.y;for(let i=0;i<300;i++)jet.step(0);assert(jet.jetRemaining<1e-10);assert(jet.y-startY>=119.9);assert(!jet.dead);
jet.reset();assert.equal(jet.jetRemaining,0);assert.equal(jet.nextJetAt,60);
assert(paceAt(240)<3);assert.equal(paceAt(300),3);console.log('PASS triple spring height, minute pickup, five-second flight and reset');

const layout=new Game(812);layout.camera=260;layout.generate();
const optional=layout.platforms.filter(p=>p.route==='optional');
assert(optional.length>1,'Wider arena should retain optional platforms');
assert(optional.some(p=>Math.abs(p.baseX)>5.4),'Some choices must sit near the edges');
assert(optional.some(p=>p.width<1.3*PLATFORM_SCALE),'Some optional platforms must be small');
const motion=new Set(layout.platforms.filter(p=>p.type==='moving').map(p=>p.moveSpeed));
assert(motion.has(.62)&&motion.has(1)&&motion.has(1.48),'Moving platforms need slow, medium and fast tiers');
console.log('PASS wider multi-platform layout, edge choices, small platforms and three motion speeds');

assert(Math.abs(JUMP**2/12.6**2-1.3)<1e-10,'Normal jump apex is exactly 30% higher');
assert(Math.abs(SPRING_JUMP**2/28**2-1.3)<1e-10,'Spring apex is also 30% higher');
assert.equal(new Game(1).platforms[0].width,2.8*1.5,'Landing width must match larger visual');
assert.equal(ITEM_SCALE,1.5);
for(const [baseWidth,value] of [[1.1,2],[2.45,1]]){
 const g=new Game(5);g.platforms=[];g.nextY=100;
 g.add(0,0,baseWidth,'solid',true);g.y=.4;g.vy=0;
 assert.equal(g.platforms[0].reward,value);
 const events=g.step(0);assert.equal(g.bananas,value);
 assert.equal(events.find(e=>e.type==='coin').value,value);
 g.step(0);assert.equal(g.bananas,value,'A banana is only collected once');
}
let densityCount=0;
for(let seed=0;seed<300;seed++){
 const g=new Game(seed);g.camera=210;g.generate();
 densityCount+=g.platforms.filter(p=>p.y>=20&&p.y<200).length;
 for(const p of g.platforms)assert(Math.abs(p.baseX)+p.width/2+(p.type==='moving'?p.moveRange:0)<=WIDTH/2,'Full platform travel stays inside vines');
}
// Previous generator: 24,638 platforms over these same 300 seeds and altitude band.
const averagePerRow=densityCount/(300*45);
assert(averagePerRow>=1.45&&averagePerRow<=1.55,'Target half of the previous three-platform row density: '+averagePerRow);
console.log('PASS 30% higher arcs, 50% larger dimensions, one-shot double rewards, platform rate halved to '+averagePerRow.toFixed(2)+' per row');
