import {normalizeDashSeed,nextDashRandom} from './dashSeed.js';
import {dashSpeedForTime,dashStageForTime} from './dashDifficulty.js';
import {DASH_PHYSICS,gravityForDashJump,releaseDashJump} from './dashPhysics.js';
import {planDashPattern,dashTransitionReport} from './dashPatterns.js';

export const DASH_GAMEPLAY_VERSION='dash-aaa-1';

export function generateDashPlan({seed=1,time=0,count=20,startX=1200,currentScroll=0}={}){
  const normalized=normalizeDashSeed(seed);
  const holder={seedState:normalized};
  const patterns=[];
  let spawnX=startX,previousDifficulty=1,previousAction=null;
  for(let i=0;i<count;i++){
    const planned=planDashPattern(holder,{time,spawnX,currentScroll,previousDifficulty,previousAction});
    const jitter=.18+nextDashRandom(holder)*.24;
    spawnX=planned.nextSpawn+planned.snapshot.speed*jitter;
    previousDifficulty=planned.pattern.difficulty;
    previousAction=planned.obstacles.at(-1)?.action||previousAction;
    patterns.push(planned);
    const travel=Math.max(0,spawnX-currentScroll-150);
    time+=travel/Math.max(1,dashSpeedForTime(time))*0.08;
  }
  return{seed:normalized,seedState:holder.seedState,patterns};
}

export function validateDashPlan(plan){
  const failures=[];
  for(const entry of plan.patterns){
    for(let i=1;i<entry.obstacles.length;i++){
      const previous=entry.obstacles[i-1],next=entry.obstacles[i];
      const gap=next.x-(previous.x+previous.w);
      const speed=next.transitionSpeed||entry.snapshot.speed;
      const report=dashTransitionReport(previous,next,{gapDistance:gap,speed,chainLength:entry.obstacles.length,requested:entry.pattern.items[i][1]});
      if(gap<0||!report.ok)failures.push({
        seed:plan.seed,stage:entry.snapshot.stage,speed,pattern:entry.pattern.id,obstacle:next.id,
        previousAction:previous.action,requiredAction:next.action,gap,
        availableReactionTime:report.available,minimumReactionTime:report.required,
        kind:gap<0?'overlap':'reaction-window'
      });
    }
  }
  return failures;
}

export function dashTimeline(seconds=300,step=30){
  const out=[];
  for(let time=0;time<=seconds;time+=step)out.push({time,stage:dashStageForTime(time),speed:dashSpeedForTime(time)});
  return out;
}


function replayBox(state,scroll){
  const p=DASH_PHYSICS;
  const sliding=state.y===0&&(state.slideHeld||state.slideTime>0||state.slideMin>0);
  return{x:scroll+p.playerX-p.colliderInsetX,y:state.y+p.colliderBottom,w:p.colliderWidth,h:sliding?p.slidingHeight:p.standingHeight};
}

function replayHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function replayObstacleBoxes(obstacle){
  return obstacle.boxes.map(b=>({x:obstacle.x+b[0],y:b[1],w:b[2],h:b[3]}));
}

function startReplayJump(state,held=true){
  const p=DASH_PHYSICS;
  if(state.y===0||state.coyote>0){
    state.slideHeld=false;state.slideTime=0;state.slideMin=0;
    state.vy=p.jumpImpulse;state.jumpHeld=held;state.jumpAge=0;state.jumpBuffer=0;state.jumpBufferHeld=false;state.coyote=0;state.grounded=false;
  }else{
    state.jumpBuffer=p.jumpBuffer;state.jumpBufferHeld=held;
  }
}

function replayStepPlayer(state,dt){
  const p=DASH_PHYSICS;
  state.jumpBuffer=Math.max(0,state.jumpBuffer-dt);
  state.slideMin=Math.max(0,state.slideMin-dt);
  state.slideTime=Math.max(0,state.slideTime-dt);
  if(state.y===0){
    if(!state.vy)state.coyote=p.coyoteTime;
    if(state.slideHeld||state.slideMin>0)state.slideTime=Math.max(state.slideTime,dt);
  }else state.coyote=Math.max(0,state.coyote-dt);
  if(!state.vy&&!state.y){
    if(state.jumpBuffer>0)startReplayJump(state,state.jumpBufferHeld);
    return;
  }
  const gravity=gravityForDashJump(state);
  state.jumpAge+=dt;state.y+=state.vy*dt-gravity*dt*dt/2;state.vy-=gravity*dt;
  if(state.y<=0){
    state.y=0;state.vy=0;state.jumpHeld=false;state.grounded=true;
    if(state.jumpBuffer>0)startReplayJump(state,state.jumpBufferHeld);
  }else state.grounded=false;
}

function replayHash(value){
  let h=2166136261;
  for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}

export function simulateDashReplay({seed=1,inputTimeline=[],duration=12,rulesVersion=DASH_GAMEPLAY_VERSION}={}){
  const p=DASH_PHYSICS;
  const plan=generateDashPlan({seed,time:0,count:Math.max(24,Math.ceil(duration*2.5)),startX:900,currentScroll:0});
  const obstacles=plan.patterns.flatMap(entry=>entry.obstacles.map(o=>({...o,patternId:entry.pattern.id}))).sort((a,b)=>a.x-b.x);
  const events=[...inputTimeline].map((event,index)=>({...event,index})).sort((a,b)=>a.time-b.time||a.index-b.index);
  const state={y:0,vy:0,jumpHeld:false,jumpAge:0,jumpBuffer:0,jumpBufferHeld:false,coyote:p.coyoteTime,slideHeld:false,slideTime:0,slideMin:0,grounded:true};
  let time=0,scroll=0,eventIndex=0,passed=0,collision=null;
  while(time<duration&&!collision){
    while(eventIndex<events.length&&events[eventIndex].time<=time+1e-9){
      const event=events[eventIndex++];
      if(event.action==='jump'){
        if(event.down)startReplayJump(state,true);
        else releaseDashJump(state);
      }else if(event.action==='slide'){
        state.slideHeld=!!event.down;
        if(event.down&&state.y===0){state.slideMin=Math.max(state.slideMin,p.minSlideTime);state.slideTime=Math.max(state.slideTime,p.minSlideTime);}
      }
    }
    replayStepPlayer(state,p.step);
    time+=p.step;
    scroll+=dashSpeedForTime(time)*p.step;
    const player=replayBox(state,scroll);
    for(const obstacle of obstacles){
      if(obstacle.x+obstacle.w<player.x){passed++;obstacle.x=-Infinity;continue;}
      if(obstacle.x>player.x+player.w)break;
      if(replayObstacleBoxes(obstacle).some(box=>replayHit(player,box))){
        collision={time,obstacleId:obstacle.id,patternId:obstacle.patternId,action:obstacle.action};
        break;
      }
    }
  }
  const planDigest=replayHash(obstacles.filter(o=>Number.isFinite(o.x)).slice(0,40).map(o=>`${o.patternId}:${o.id}:${o.x.toFixed(3)}`).join('|'));
  const result={
    rulesVersion,seed:plan.seed,time:Number(time.toFixed(6)),stage:dashStageForTime(time),
    speed:Number(dashSpeedForTime(time).toFixed(6)),distance:Number((scroll/100).toFixed(6)),
    y:Number(state.y.toFixed(6)),vy:Number(state.vy.toFixed(6)),grounded:state.grounded,
    sliding:state.y===0&&(state.slideHeld||state.slideTime>0||state.slideMin>0),
    passed,collision,planDigest
  };
  return{...result,signature:replayHash(JSON.stringify(result))};
}
