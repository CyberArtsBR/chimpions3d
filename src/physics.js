export const WIDTH=14.4, GRAVITY=18, JUMP=12.6*Math.sqrt(1.3), SPEED=6.2, VIEW_HEIGHT=12.4, STEP=1/60;
export const PLATFORM_SCALE=1.5*.75*.75, PLATFORM_LENGTH=PLATFORM_SCALE*1.3, ITEM_SCALE=1.5;
export const SPRING_JUMP=28*Math.sqrt(1.3), JET_DURATION=10, JET_SPEED=24;
export const VINE_INSET=.24;
export const RULESET='2026-09-expedition-v3';
export const WRAP_SPAN=WIDTH-2*VINE_INSET;
const wrapX=x=>((x+WRAP_SPAN/2)%WRAP_SPAN+WRAP_SPAN)%WRAP_SPAN-WRAP_SPAN/2;
const wrappedDistance=(a,b)=>Math.abs(wrapX(a-b));
export const paceAt=time=>.92+2.08*Math.min(Math.max(time,0)/300,1);
const PLATFORM_TRAVEL=1.65, PLATFORM_HEIGHT_BAND=2.2, PLATFORM_GAP=.8;
export const platformPhaseAt=time=>{
  // Continuous, bounded acceleration affects branches only, never player physics.
  const t=Math.max(0,time),ramp=Math.min(t,300);
  return .65*(t+.6*(ramp*ramp/600+Math.max(0,t-300)));
};
export const movingX=(platform,time)=>platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange??PLATFORM_TRAVEL);
export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.seed=seed>>>0;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
    this.jetpack=null;this.jetRemaining=0;this.nextJetAt=30;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;this.nextWidth=2.8*PLATFORM_LENGTH;
    this.add(0,0,2.8,'solid',false);this.generate();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  canPlace(x,y,width,type){
    const extent=width/2+(type==='moving'?PLATFORM_TRAVEL:0);
    if(Math.abs(x)+extent>WIDTH/2-VINE_INSET-.35)return false;
    // Reserve the entire swept silhouette, not just positions at spawn time.
    // A broad height band also covers moss, twigs and nearby staggered rows.
    return this.platforms.every(p=>p.broken||Math.abs(p.y-y)>=PLATFORM_HEIGHT_BAND||
      Math.abs(p.baseX-x)>=extent+p.width/2+(p.type==='moving'?p.moveRange:0)+PLATFORM_GAP);
  }
  add(x,y,width,type,coin=true,route='safe'){
    const size=Math.max(0,Math.min(1,(width-.95)/1.5));
    width*=PLATFORM_LENGTH;
    // Equal travel amplitude: larger branches have a strictly higher peak speed.
    const moveRange=PLATFORM_TRAVEL,moveSpeed=1.25*(.62+.86*size);
    if(!this.canPlace(x,y,width,type))return false;

    this.platforms.push({id:this.nextId++,x,baseX:x,y,width,type,coin,route,reward:width<=1.3*PLATFORM_LENGTH?2:1,fragile:type==='cracked',broken:false,phase:this.random()*6.28,
      moveSpeed,moveRange});
    const platform=this.platforms.at(-1);if(type==='moving')platform.x=movingX(platform,this.time);
    return true;
  }
  generate(){
    while(this.nextY<this.camera+10){
      const difficulty=Math.min(this.nextY/240,1);
      const rise=3.65+this.random()*.2+difficulty*.2;
      const y=this.nextY+rise,width=2.45-difficulty*.65;
      const limit=WIDTH/2-VINE_INSET-.35-width*PLATFORM_LENGTH/2;
      // Descending flight time, with room to reverse full sideways momentum,
      // leave the far edge of the previous branch and still aim at the center.
      const flight=(JUMP+Math.sqrt(JUMP*JUMP-2*GRAVITY*rise))/GRAVITY;
      const reach=Math.min(1.9+difficulty*.9,
        SPEED*(flight-STEP)-SPEED*SPEED/24-this.nextWidth/2-.5);
      const candidates=[];
      for(let x=-limit;x<=limit+.001;x+=.2){
        const distance=Math.abs(x-this.nextX);
        if(distance>=1.1&&distance<=reach&&this.canPlace(x,y,width*PLATFORM_LENGTH,'solid'))candidates.push(x);
      }
      // Only advance the route after its solid support has actually been placed.
      const x=candidates.length?candidates[Math.floor(this.random()*candidates.length)]:
        Math.max(-limit,Math.min(limit,this.nextX));
      if(!this.add(x,y,width,'solid',true,'safe'))break;
      this.nextX=x;this.nextY=y;this.nextWidth=width*PLATFORM_LENGTH;
      const extras=2+(this.random()<.51?1:0);
      for(let i=0;i<extras;i++){
        const roll=this.random();
        const type=y<12?'solid':roll<.2+difficulty*.35?'moving':
          roll<.7+difficulty*.1?'cracked':roll<.88?'solid':'spring';
        const optionalWidth=1.35+this.random()*.55-difficulty*.4;
        const optionalY=y-1.1-this.random()*.35;
        const extent=optionalWidth*PLATFORM_LENGTH/2+(type==='moving'?PLATFORM_TRAVEL:0);
        const edge=WIDTH/2-VINE_INSET-.35-extent,places=[];
        for(let px=-edge;px<=edge+.001;px+=.15){
          if(this.canPlace(px,optionalY,optionalWidth*PLATFORM_LENGTH,type))places.push(px);
        }
        if(!places.length)continue;
        const px=this.random()<.5?places[0]:places.at(-1);
        if(this.add(px,optionalY,optionalWidth,type,true,type==='spring'?'reward':'risk')){
          this.platforms.at(-1).reward=2;
        }
      }
    }
  }
  spawnJetpack(){
    // Sample open air across the court, accepting positions within a normal jump
    // from an available branch. No fixed edge or platform-center attachment.
    const supports=this.platforms.filter(p=>!p.broken&&p.y>this.camera-4&&p.y<this.camera+4);
    const span=2*(WIDTH/2-VINE_INSET);
    for(let attempt=0;attempt<64&&supports.length;attempt++){
      const support=supports[Math.floor(this.random()*supports.length)];
      const y=support.y+1.7+this.random()*2.6,x=(this.random()-.5)*(span-1.2);
      const rise=y-support.y,flight=(JUMP+Math.sqrt(JUMP*JUMP-2*GRAVITY*rise))/GRAVITY;
      const direct=Math.abs(x-support.x),distance=Math.min(direct,span-direct);
      if(y>this.camera+5.3||y<this.camera-2||distance>Math.max(1,flight*SPEED*.65))continue;
      if(this.platforms.some(p=>!p.broken&&Math.abs(p.y-y)<.85&&Math.abs(p.x-x)<p.width/2+.6))continue;
      this.jetpack={x,y,expires:this.time+20};return;
    }
    const support=supports[0];
    this.jetpack={x:Math.max(-span/2+.6,Math.min(span/2-.6,(support?.x??this.x)+(this.random()<.5?-1:1))),y:(support?.y??this.y)+2.5,expires:this.time+20};
  }
  step(input,dt=STEP){
    if(this.dead)return [];
    const events=[];const realDt=dt;this.time+=dt;
    // Active play time stays real: theme changes remain every 30 seconds.
    this.bounceAge+=dt;
    this.previousCamera=this.camera;
    const target=input*SPEED, amount=24*dt;
    this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));
    const oldX=this.x, oldY=this.y;
    const travel=this.vx*dt;
    const vineX=WIDTH/2-VINE_INSET, nextX=oldX+travel;
    if(nextX>vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'right',x:this.x,y:this.y});}
    else if(nextX<-vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'left',x:this.x,y:this.y});}
    else this.x=nextX;
    if(this.jetRemaining>0){
      const flight=Math.min(realDt,this.jetRemaining);this.y+=JET_SPEED*flight;this.jetRemaining=Math.max(0,this.jetRemaining-realDt);this.vy=JET_SPEED;
      if(this.jetRemaining===0){this.vy=JUMP;events.push({type:'jet-end'});}
    }else{this.y+=this.vy*dt-.5*GRAVITY*dt*dt;this.vy-=GRAVITY*dt;}
    if(this.time>=this.nextJetAt){
      this.nextJetAt=(Math.floor(this.time/30)+1)*30;
      this.spawnJetpack();events.push({type:'jet-spawn'});
    }
    if(this.jetpack){
      const j=this.jetpack;const dx=wrappedDistance(this.x,j.x);
      if(dx<.65*ITEM_SCALE&&j.y>=Math.min(oldY,this.y)+.15&&j.y<=Math.max(oldY,this.y)+1.45){this.jetpack=null;this.jetRemaining=JET_DURATION;events.push({type:'jet',x:this.x,y:this.y});}
      else if(this.time>j.expires||j.y<this.camera-VIEW_HEIGHT/2)this.jetpack=null;
    }
    let landing=null, earliest=2;
    for(const p of this.platforms){
      const previousX=p.x;
      if(p.type==='moving')p.x=movingX(p,this.time);
      if(p.broken)continue;
      if(this.vy<0 && oldY>=p.y && this.y<=p.y){
        const t=(oldY-p.y)/(oldY-this.y), x=oldX+travel*t;
        const px=previousX+(p.x-previousX)*t;
        const distance=wrappedDistance(x,px);
        if(distance<p.width/2+0.24 && t<earliest){earliest=t;landing=p;}
      }
      const dx=wrappedDistance(this.x,p.x);
      if(p.coin && dx<0.65*ITEM_SCALE && Math.abs(this.y+0.65-(p.y+1))<0.85+.25*(ITEM_SCALE-1)){
        p.coin=false;const value=p.reward||1;this.bananas+=value;events.push({type:'coin',x:p.x,y:p.y+1,value});
      }
    }
    if(landing){
      this.y=landing.y;this.vy=landing.type==='spring'?SPRING_JUMP:JUMP;
      this.bounceAge=0;this.bounces++;
      if(landing.type==='cracked'||landing.fragile)landing.broken=true;
      events.push({type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring',fragile:landing.type==='cracked',platformId:landing.id});
    }
    this.height=Math.max(this.height,this.y);
    const cameraTarget=Math.max(this.camera,this.height-VIEW_HEIGHT*.085+Math.max(0,this.vy)*.018);
    this.camera+=Math.max(0,cameraTarget-this.camera)*(1-Math.exp(-8*dt));
    if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death'});}
    this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
    this.generate();return events;
  }
}
