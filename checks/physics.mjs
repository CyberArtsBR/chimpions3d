import assert from 'node:assert/strict';
import {Game,STEP} from '../src/physics.js';
for(let seed=0;seed<200;seed++){
 const g=new Game(seed);
 let prev={x:0,y:0};
 for(const p of g.platforms.filter(p=>p.type==='solid'&&p.y>0)){
  assert(p.y-prev.y<=1.86);assert(Math.abs(p.x-prev.x)<=1.66);prev=p;
 }
}
const bounce=new Game(1);
for(let i=0;i<120;i++)bounce.step(0);
assert(bounce.bounces>0,'Auto bounce must occur');
const landing=new Game(1);landing.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type:'solid',coin:false,broken:false}];landing.nextY=100;landing.y=.05;landing.vy=-20;
landing.step(0);assert.equal(landing.y,0);assert.equal(landing.vy,14);
landing.y=-.1;landing.vy=10;landing.step(0);assert(landing.vy<10&&landing.vy>0,'Pass upward through platform');
const wrap=new Game(2);wrap.x=4.99;wrap.vx=6;wrap.step(1);assert(wrap.x< -4.8);assert(wrap.vx>0);
const a=new Game(44),b=new Game(44);
for(let i=0;i<300;i++){a.step(i%80<40?1:-1);b.step(i%80<40?1:-1);}
assert.deepEqual(a,b,'Seeded runs must be reproducible');
const fall=new Game(1);fall.y=-20;fall.step(0);assert(fall.dead);
fall.reset(1);assert(!fall.dead&&fall.time===0&&fall.height===0);
const spring=new Game(1);spring.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type:'spring',coin:false,broken:false}];spring.nextY=100;spring.y=.05;spring.vy=-20;spring.step(0);assert.equal(spring.vy,18);
const broken=new Game(1);broken.platforms=[{id:0,x:0,baseX:0,y:0,width:3,type:'cracked',coin:false,broken:false}];broken.nextY=100;broken.y=.05;broken.vy=-20;broken.step(0);assert(broken.platforms[0].broken);
console.log('PASS physics: route spacing, automatic bounce, one-way/swept landings, wrap, seeds, death/retry, spring and cracked branches');
