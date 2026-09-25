export const DASH_PHYSICS=Object.freeze({
  step:1/120,
  playerX:150,
  gravity:2200,
  jumpImpulse:600,
  lowHeight:70,
  holdTime:.22,
  jumpBuffer:.16,
  coyoteTime:.10,
  heldGravityScale:.35,
  fallGravityScale:1.14,
  minSlideTime:.24,
  standingHeight:78,
  slidingHeight:31,
  colliderWidth:32,
  colliderInsetX:16,
  colliderBottom:5
});

export function gravityForDashJump({jumpHeld,jumpAge,vy}){
  const p=DASH_PHYSICS;
  if(jumpHeld&&jumpAge<p.holdTime&&vy>0)return p.gravity*p.heldGravityScale;
  if(vy<0)return p.gravity*p.fallGravityScale;
  return p.gravity;
}

export function releaseDashJump(state){
  const p=DASH_PHYSICS;
  if(state.vy>0){
    const floorVelocity=Math.sqrt(Math.max(0,2*p.gravity*(p.lowHeight-state.y)));
    state.vy=Math.min(state.vy,Math.max(floorVelocity,state.vy*.48));
  }
  state.jumpHeld=false;
  if('jumpBufferHeld' in state)state.jumpBufferHeld=false;
  return state;
}

export function integrateDashJumpStep(state,dt=DASH_PHYSICS.step){
  const gravity=gravityForDashJump(state);
  state.jumpAge+=dt;
  state.y+=state.vy*dt-gravity*dt*dt/2;
  state.vy-=gravity*dt;
  if(state.y<=0&&state.vy<=0){
    state.y=0;
    state.vy=0;
    state.jumpHeld=false;
    state.grounded=true;
  }else state.grounded=false;
  return state;
}

export function simulateDashJumpArc({holdSeconds=0,dt=DASH_PHYSICS.step,maxSeconds=3}={}){
  const p=DASH_PHYSICS;
  const state={y:0,vy:p.jumpImpulse,jumpHeld:true,jumpAge:0,grounded:false,jumpBufferHeld:false};
  let released=false,time=0,apex=0,apexTime=0;
  const samples=[{time:0,y:0,vy:state.vy}];
  if(holdSeconds<=0){releaseDashJump(state);released=true;}
  while(time<maxSeconds){
    if(!released&&time>=holdSeconds){releaseDashJump(state);released=true;}
    integrateDashJumpStep(state,dt);
    time+=dt;
    if(state.y>apex){apex=state.y;apexTime=time;}
    samples.push({time,y:state.y,vy:state.vy});
    if(state.grounded&&time>dt)break;
  }
  return{holdSeconds,apex,apexTime,airTime:time,samples};
}

export function dashJumpArcProfiles(){
  const p=DASH_PHYSICS;
  return{
    tap:simulateDashJumpArc({holdSeconds:0}),
    standard:simulateDashJumpArc({holdSeconds:p.holdTime*.5}),
    full:simulateDashJumpArc({holdSeconds:p.holdTime})
  };
}

export function heightAtDashArcTime(profile,time){
  if(time<=0)return 0;
  const samples=profile.samples;
  for(let i=1;i<samples.length;i++){
    const b=samples[i];
    if(b.time>=time){
      const a=samples[i-1];
      const span=b.time-a.time||1;
      const t=(time-a.time)/span;
      return a.y+(b.y-a.y)*t;
    }
  }
  return 0;
}


export function sweptDashContact(a0,a1,b){
  let enter=0,exit=1;
  const constraints=[
    [a0.x+a0.w-b.x,a1.x+a1.w-b.x],
    [b.x+b.w-a0.x,b.x+b.w-a1.x],
    [a0.y+a0.h-b.y,a1.y+a1.h-b.y],
    [b.y+b.h-a0.y,b.y+b.h-a1.y]
  ];
  for(const [from,to] of constraints){
    if(from<=0&&to<=0)return Infinity;
    if(from<=0)enter=Math.max(enter,-from/(to-from));
    else if(to<=0)exit=Math.min(exit,from/(from-to));
  }
  return enter<exit?enter:Infinity;
}
