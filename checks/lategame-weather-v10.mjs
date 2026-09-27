import assert from 'node:assert/strict';
import {
  Game,
  STEP,
  PACE_SLOW_HEIGHT,
  POST_1000_PACE_CLOCK_SCALE,
  paceClockScaleAtHeight
} from '../src/physics.js';
import {RAIN_LEVEL_HEIGHT,rainLevelAt,rainProfileAt} from '../src/jumpWeather.js';

assert.equal(PACE_SLOW_HEIGHT,1000);
assert.equal(paceClockScaleAtHeight(999.99),1);
assert.equal(paceClockScaleAtHeight(1000),POST_1000_PACE_CLOCK_SCALE);
assert.equal(POST_1000_PACE_CLOCK_SCALE,.35);

const preGame=new Game(12345);
preGame.y=preGame.height=preGame.camera=999;preGame.previousCamera=999;preGame.nextY=999;preGame.nextX=0;preGame.platforms=[];
let before=preGame.paceClock;
preGame.step(0,STEP);
const preDelta=preGame.paceClock-before;
assert(Math.abs(preDelta-STEP)<1e-9,`Pre-1000 pace clock must advance 1:1, got ${preDelta}`);

const postGame=new Game(12345);
postGame.y=postGame.height=postGame.camera=1000;postGame.previousCamera=1000;postGame.nextY=1000;postGame.nextX=0;postGame.platforms=[];
before=postGame.paceClock;
postGame.step(0,STEP);
const postDelta=postGame.paceClock-before;
assert(Math.abs(postDelta-STEP*POST_1000_PACE_CLOCK_SCALE)<1e-9,`Post-1000 pace clock must advance at 35%, got ${postDelta}`);

assert.equal(RAIN_LEVEL_HEIGHT,220);
assert.equal(rainLevelAt(0),0);
assert.equal(rainLevelAt(219.99),0);
assert.equal(rainLevelAt(220),1);
assert.equal(rainProfileAt(100,1,1).active,false,'Level 0 should be dry');
assert.equal(rainProfileAt(250,1,1).active,true,'Level 1 should be a rain level');
assert(rainProfileAt(250,1,1).intensity>.9,'Emerald Mist rain should be strong');
assert.equal(rainProfileAt(500,1,1).active,false,'Level 2 should be dry');
assert.equal(rainProfileAt(900,3,1).active,true,'Level 4 should be a rain level');
assert(rainProfileAt(900,3,1).intensity>.6,'Moonlit Grove rain should remain visible');

console.log(JSON.stringify({
  status:'PASS',
  pace:{
    threshold:PACE_SLOW_HEIGHT,
    pre1000ClockScale:1,
    post1000ClockScale:POST_1000_PACE_CLOCK_SCALE,
    preDelta,
    postDelta
  },
  rain:{
    levelHeight:RAIN_LEVEL_HEIGHT,
    wetLevels:'1 and 4 of every 5 altitude bands',
    emerald250m:rainProfileAt(250,1,1),
    dry500m:rainProfileAt(500,1,1),
    moonlit900m:rainProfileAt(900,3,1)
  }
},null,2));
