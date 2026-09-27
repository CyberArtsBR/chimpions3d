import assert from 'node:assert/strict';
import {Game,GRAVITY,JUMP,WRAP_SPAN} from '../src/physics.js';

const wrappedDistance=(a,b)=>{
  let delta=b-a;
  delta=((delta+WRAP_SPAN/2)%WRAP_SPAN+WRAP_SPAN)%WRAP_SPAN-WRAP_SPAN/2;
  return Math.abs(delta);
};

const apex=JUMP*JUMP/(2*GRAVITY);
assert(apex>=6.65,`Regular jump apex must be clearly higher; got ${apex.toFixed(3)}`);

const distances=[],rises=[];
let emergencyNearVertical=0,total=0;
for(let seed=1;seed<=256;seed++){
  const game=new Game(seed);
  const route=game.platforms.filter(platform=>platform.required).sort((a,b)=>a.y-b.y);
  let previousX=0,previousY=0;
  for(const platform of route){
    const distance=wrappedDistance(previousX,platform.baseX);
    const rise=platform.y-previousY;
    distances.push(distance);rises.push(rise);total++;
    if(distance<.58)emergencyNearVertical++;
    assert(rise<apex-.5,`Seed ${seed} generated required rise ${rise.toFixed(2)} too close to apex ${apex.toFixed(2)}`);
    previousX=platform.baseX;previousY=platform.y;
  }
}

distances.sort((a,b)=>a-b);
const median=distances[Math.floor(distances.length/2)]||0;
const nearVerticalRate=total?emergencyNearVertical/total:1;
assert(median>=.95,`Median required lateral shift must stay meaningful; got ${median.toFixed(3)}`);
assert(nearVerticalRate<=.04,`Near-vertical emergency safe routes must stay rare; got ${(nearVerticalRate*100).toFixed(2)}%`);

console.log(JSON.stringify({
  status:'PASS',
  apex:Number(apex.toFixed(3)),
  transitions:total,
  medianRequiredLateralShift:Number(median.toFixed(3)),
  nearVerticalRate:Number(nearVerticalRate.toFixed(4)),
  riseRange:[Number(Math.min(...rises).toFixed(3)),Number(Math.max(...rises).toFixed(3))]
},null,2));
