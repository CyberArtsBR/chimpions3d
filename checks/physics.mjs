import assert from 'node:assert/strict';
import {Game,STEP,WIDTH,JUMP,GRAVITY} from '../src/physics.js';
assert(JUMP*JUMP/(2*GRAVITY)>4.3);assert(2*JUMP/GRAVITY>=1.4);
let pairs=0;
for(let seed=0;seed<250;seed++){
 const g=new Game(seed);g.camera=200;g.generate();
 for(let i=1;i<g.platforms.length;i++){
  const prev=g.platforms[i-1],p=g.platforms[i],dy=p.y-prev.y;
  assert(dy>=2.59&&dy<=3.46,'Rows must remain widely spaced');
  assert(Math.abs(p.baseX-prev.baseX)>=1.64,'Avoid stacked branches');
  const test=new Game(seed);test.platforms=[{...p}];test.nextY=1000;
  test.y=prev.y;test.x=prev.x;test.vy=JUMP;test.height=prev.y;test.camera=Math.max(5,prev.y-.8);
  for(let tick=0;tick<100&&!test.bounces&&!test.dead;tick++){
   const target=p.baseX+(p.type==='moving'?Math.sin((test.time+STEP)*1.1+p.phase)*.38:0);
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
const wrap=new Game(2);wrap.x=WIDTH/2-.01;wrap.vx=4.4;wrap.step(1);assert(wrap.x< -WIDTH/2+.1);assert(wrap.vx>0);
const a=new Game(44),b=new Game(44);for(let i=0;i<300;i++){a.step(i%80<40?1:-1);b.step(i%80<40?1:-1);}assert.deepEqual(a,b);
const fall=new Game(1);fall.y=-20;fall.step(0);assert(fall.dead);fall.reset(1);assert(!fall.dead&&fall.time===0);
const spring=fixture('spring');spring.y=.05;spring.vy=-20;spring.step(0);assert.equal(spring.vy,15.5);
const broken=fixture('cracked');broken.y=.05;broken.vy=-20;broken.step(0);assert(broken.platforms[0].broken);
// Standing still must no longer climb the generated route indefinitely.
const idle=new Game(9);for(let i=0;i<600;i++)idle.step(0);assert(idle.height<10);
console.log('PASS physics: '+pairs+' generated transfers, larger gaps, slower/higher arcs, wrap, landing, spring, fragile branches, retry');
