import {Game,GRAVITY,STEP,FAST_FALL_MIN_BOUNCE_AGE,paceAt} from './physics.js';

export const FAST_FALL_TARGET_EXTRA_GRAVITY=32;
export const FAST_FALL_TARGET_MAX_SPEED=44;

const originalStep=Game.prototype.step;

// Production tuning layer: the base physics module still owns collision,
// landing and replay-safe Fast Fall semantics. This wrapper only raises the
// requested descent acceleration/cap while preserving the same input flag.
if(!Game.prototype.__jumpFastFall100Patched){
 Object.defineProperty(Game.prototype,'__jumpFastFall100Patched',{value:true});
 Game.prototype.step=function(input,dt=STEP){
  const fastFall=!!input?.fastFall&&this.jetRemaining<=0&&this.vy<0&&this.bounceAge>=FAST_FALL_MIN_BOUNCE_AGE;
  const preVy=this.vy,preHeight=this.height;
  const events=originalStep.call(this,input,dt);
  const landed=this.bounceAge===0;
  if(fastFall&&!landed&&this.jetRemaining<=0&&!this.dead&&this.vy<0){
   const scaledDt=dt*paceAt(preHeight);
   const targetVy=Math.max(preVy-(GRAVITY+FAST_FALL_TARGET_EXTRA_GRAVITY)*scaledDt,-FAST_FALL_TARGET_MAX_SPEED);
   this.vy=Math.min(this.vy,targetVy);
  }
  return events;
 };
}
