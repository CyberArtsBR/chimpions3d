import {Game,STEP,paceAt} from './physics.js';

const EXTRA_GRAVITY=32;
const MAX_SPEED=44;
const MIN_BOUNCE_AGE=.18;
const originalStep=Game.prototype.step;

// Targeted compatibility patch for the older Portals standalone ruleset.
// It adds the same 100%-faster Fast Fall feel as current main without pulling
// newer route-generation/mastery systems into the standalone branch.
if(!Game.prototype.__portalFastFallPatched){
 Object.defineProperty(Game.prototype,'__portalFastFallPatched',{value:true});
 Game.prototype.step=function(input,dt=STEP){
  const steer=input&&typeof input==='object'?Number(input.steer)||0:Number(input)||0;
  const fastFall=!!input?.fastFall&&this.jetRemaining<=0&&this.vy<0&&this.bounceAge>=MIN_BOUNCE_AGE;
  const scaledDt=dt*paceAt(this.height);

  // Split the extra acceleration around the legacy integrator so position and
  // velocity match a single step using base gravity + EXTRA_GRAVITY.
  if(fastFall)this.vy=Math.max(this.vy-EXTRA_GRAVITY*scaledDt*.5,-MAX_SPEED);
  const events=originalStep.call(this,steer,dt);
  const landed=this.bounceAge===0;
  if(fastFall&&!landed&&this.jetRemaining<=0&&!this.dead)
   this.vy=Math.max(this.vy-EXTRA_GRAVITY*scaledDt*.5,-MAX_SPEED);

  if(fastFall&&!this.__portalFastFallActive)
   events.unshift({type:'fast-fall',x:this.x,y:this.y});
  this.__portalFastFallActive=fastFall&&!landed&&this.jetRemaining<=0&&!this.dead;
  return events;
 };
}
