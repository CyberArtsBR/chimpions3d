export const WIDTH=14.4, GRAVITY=18, JUMP=12.6*Math.sqrt(1.3), SPEED=6.2, VIEW_HEIGHT=12.4, STEP=1/60;
export const PLATFORM_SCALE=1.5*.75*.75, ITEM_SCALE=1.5;
export const SPRING_JUMP=28*Math.sqrt(1.3), JET_DURATION=5, JET_SPEED=24;
export const VINE_INSET=.24;
export const paceAt=time=>.92+2.08*Math.min(Math.max(time,0)/300,1);
const PLATFORM_TRAVEL=1.65, PLATFORM_HEIGHT_BAND=2.2, PLATFORM_GAP=.8;
const basePlatformPhase=time=>1.1*(time+.45*(time<=180?time*time/360:time-90));
export const platformPhaseAt=time=>{
  // Integrate each level separately so a speed increase never teleports a branch.
  // The extra 1.2 multiplier raises the previous movement speed by 20%.
  const t=Math.max(0,time),level=Math.floor(t/30);let phase=0;
  for(let i=0;i<level;i++)phase+=(basePlatformPhase((i+1)*30)-basePlatformPhase(i*30))*1.2**i;
  return (phase+(basePlatformPhase(t)-basePlatformPhase(level*30))*1.2**level)*1.05;
};
export const movingX=(platform,time)=>platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange??PLATFORM_TRAVEL);
export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.seed=seed>>>0;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
    this.jetpack=null;this.jetRemaining=0;this.nextJetAt=30;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;
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
    width*=PLATFORM_SCALE;
    // Equal travel amplitude: larger branches have a strictly higher peak speed.
    const moveRange=PLATFORM_TRAVEL,moveSpeed=1.25*(.62+.86*size);
    if(!this.canPlace(x,y,width,type))return false;

    this.platforms.push({id:this.nextId++,x,baseX:x,y,width,type,coin,route,reward:width<=1.3*PLATFORM_SCALE?2:1,fragile:type!=='moving'&&paceAt(this.time)>=2.5,broken:false,phase:this.random()*6.28,
      moveSpeed,moveRange});
    const platform=this.platforms.at(-1);if(type==='moving')platform.x=movingX(platform,this.time);
    return true;
  }
  generate(){
    while(this.nextY<this.camera+10){
      const difficulty=Math.min(this.nextY/180,1);
      this.nextY+=3.85+this.random()*.10+difficulty*.10;
      // One reachable route plus lateral choices; keep their full motion envelopes apart.
      const width=2.45-difficulty*.65;
      const centerLimit=WIDTH/2-VINE_INSET-.35-width*PLATFORM_SCALE/2-PLATFORM_TRAVEL;
      const candidates=[-5.8,-4.5,-3.2,-1.8,0,1.8,3.2,4.5,5.8].filter(x=>Math.abs(x)<=centerLimit).filter(x=>{
        const distance=Math.abs(x-this.nextX);
        return distance>=1.65 && distance<=3.15;
      });
      this.nextX=candidates[Math.floor(this.random()*candidates.length)];
      let type='solid';
      if(this.nextY>10){
        const roll=this.random();
        type=roll<.35+Math.min(this.time/180,1)*.2?'moving':roll<.7?'solid':roll<.88?'cracked':'spring';
      }
      this.add(this.nextX,this.nextY,width,type,true,'safe');
      // Previous rows averaged 1.5 platforms. Aim for 2.7 (+80%) while
      // allowing the swept-envelope check to reject unsafe optional branches.
      const extras=1+(this.random()<.7?1:0);
      for(let i=0;i<extras;i++){
        const optionalType=this.nextY>12&&this.random()<.48?'moving':this.random()<.25?'cracked':'solid';
        const optionalWidth=.95+this.random()*1.05;
        const optionalY=this.nextY-1.1-this.random()*.35;
        const extent=optionalWidth*PLATFORM_SCALE/2+(optionalType==='moving'?PLATFORM_TRAVEL:0);
        const limit=WIDTH/2-VINE_INSET-.35-extent;
        const candidates=[];
        for(let x=-limit;x<=limit+.001;x+=.15){
          if(this.canPlace(x,optionalY,optionalWidth*PLATFORM_SCALE,optionalType))candidates.push(x);
        }
        if(!candidates.length)continue;
        // Prefer free outer lanes, retaining room for the next optional branch.
        const x=this.random()<.5?candidates[0]:candidates.at(-1);
        this.add(x,optionalY,optionalWidth,optionalType,true,'optional');
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
    dt*=paceAt(this.time);this.bounceAge+=dt;
    this.previousCamera=this.camera;
    const target=input*SPEED, amount=24*dt;
    this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));
    const oldX=this.x, oldY=this.y;
    const travel=this.vx*dt;
    const vineX=WIDTH/2-VINE_INSET, nextX=oldX+travel;
    if(nextX>vineX){this.x=-vineX;events.push({type:'wrap',side:'right',x:this.x,y:this.y});}
    else if(nextX<-vineX){this.x=vineX;events.push({type:'wrap',side:'left',x:this.x,y:this.y});}
    else this.x=nextX;
    if(this.jetRemaining>0){
      const flight=Math.min(realDt,this.jetRemaining);this.y+=JET_SPEED*flight;this.jetRemaining=Math.max(0,this.jetRemaining-realDt);this.vy=JET_SPEED/paceAt(this.time);
      if(this.jetRemaining===0){this.vy=JUMP;events.push({type:'jet-end'});}
    }else{this.y+=this.vy*dt-.5*GRAVITY*dt*dt;this.vy-=GRAVITY*dt;}
    if(this.time>=this.nextJetAt){
      this.nextJetAt=(Math.floor(this.time/30)+1)*30;
      this.spawnJetpack();events.push({type:'jet-spawn'});
    }
    if(this.jetpack){
      const j=this.jetpack;const dx=Math.abs(((this.x-j.x+WIDTH*1.5)%WIDTH+WIDTH)%WIDTH-WIDTH/2);
      if(dx<.65*ITEM_SCALE&&j.y>=Math.min(oldY,this.y)+.15&&j.y<=Math.max(oldY,this.y)+1.45){this.jetpack=null;this.jetRemaining=JET_DURATION;events.push({type:'jet',x:this.x,y:this.y});}
      else if(this.time>j.expires||j.y<this.camera-VIEW_HEIGHT/2)this.jetpack=null;
    }
    let landing=null, earliest=2;
    for(const p of this.platforms){
      if(paceAt(this.time)>=2.5&&p.type!=='moving')p.fragile=true;
      const previousX=p.x;
      if(p.type==='moving')p.x=movingX(p,this.time);
      if(p.broken)continue;
      if(this.vy<0 && oldY>=p.y && this.y<=p.y){
        const t=(oldY-p.y)/(oldY-this.y), x=oldX+travel*t;
        const px=previousX+(p.x-previousX)*t;
        const distance=Math.abs(((x-px+WIDTH*1.5)%WIDTH+WIDTH)%WIDTH-WIDTH/2);
        if(distance<p.width/2+0.24 && t<earliest){earliest=t;landing=p;}
      }
      const dx=Math.abs(((this.x-p.x+WIDTH*1.5)%WIDTH+WIDTH)%WIDTH-WIDTH/2);
      if(p.coin && dx<0.65*ITEM_SCALE && Math.abs(this.y+0.65-(p.y+1))<0.85+.25*(ITEM_SCALE-1)){
        p.coin=false;const value=p.reward||1;this.bananas+=value;events.push({type:'coin',x:p.x,y:p.y+1,value});
      }
    }
    if(landing){
      this.y=landing.y;this.vy=landing.type==='spring'?SPRING_JUMP:JUMP;
      this.bounceAge=0;this.bounces++;
      if(landing.type==='cracked'||landing.fragile)landing.broken=true;
      events.push({type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring'});
    }
    this.height=Math.max(this.height,this.y);
    this.camera=Math.max(this.camera,this.height-.8);
    if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death'});}
    this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
    this.generate();return events;
  }
}
