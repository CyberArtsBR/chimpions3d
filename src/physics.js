export const WIDTH=14.4, GRAVITY=18, JUMP=12.6*Math.sqrt(1.3), SPEED=6.2, VIEW_HEIGHT=12.4, STEP=1/60;
export const PLATFORM_SCALE=1.5, ITEM_SCALE=1.5;
export const SPRING_JUMP=28*Math.sqrt(1.3), JET_DURATION=5, JET_SPEED=24;
export const VINE_INSET=.24;
export const paceAt=time=>.92+2.08*Math.min(Math.max(time,0)/150,1);
export const platformPhaseAt=time=>1.1*(time+.45*(time<=180?time*time/360:time-90));
export const movingX=(platform,time)=>platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange||.48);
export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.seed=seed>>>0;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
    this.jetpack=null;this.jetRemaining=0;this.nextJetAt=60;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;
    this.add(0,0,2.8,'solid',false);this.generate();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  add(x,y,width,type,coin=true,route='safe'){
    width*=PLATFORM_SCALE;
    const motionRoll=this.random();
    this.platforms.push({id:this.nextId++,x,baseX:x,y,width,type,coin,route,reward:width<=1.3*PLATFORM_SCALE?2:1,broken:false,phase:this.random()*6.28,
      moveSpeed:motionRoll<.34?.62:motionRoll<.72?1:1.48,moveRange:.38+this.random()*.34});
  }
  generate(){
    while(this.nextY<this.camera+10){
      const difficulty=Math.min(this.nextY/180,1);
      this.nextY+=3.85+this.random()*.10+difficulty*.10;
      // One reachable route plus lateral choices; keep their full motion envelopes apart.
      const width=2.45-difficulty*.65;
      const centerLimit=WIDTH/2-width*PLATFORM_SCALE/2-.85;
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
      const row=[this.platforms.at(-1)];
      const extras=2;
      for(let i=0;i<extras;i++){
        const optionalType=this.nextY>12&&this.random()<.48?'moving':this.random()<.25?'cracked':'solid';
        const optionalWidth=.95+this.random()*1.05;
        const extent=optionalWidth*PLATFORM_SCALE/2+(optionalType==='moving'?.72:0);
        const limit=WIDTH/2-.12-extent;
        const candidates=[];
        for(let x=-limit;x<=limit+.001;x+=.15){
          if(row.every(p=>Math.abs(x-p.baseX)>=extent+p.width/2+(p.type==='moving'?p.moveRange:0)+.18))candidates.push(x);
        }
        if(!candidates.length)continue;
        // Prefer free outer lanes, retaining room for the next optional branch.
        const x=this.random()<.5?candidates[0]:candidates.at(-1);
        this.add(x,this.nextY-.42+this.random()*.84,optionalWidth,optionalType,true,'optional');
        row.push(this.platforms.at(-1));
      }
    }
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
      this.nextJetAt=(Math.floor(this.time/60)+1)*60;
      const target=this.platforms.find(p=>!p.broken&&p.y>this.y+1.5);
      if(target){const side=target.baseX>=0?1:-1;this.jetpack={x:Math.max(-WIDTH/2+.4,Math.min(WIDTH/2-.4,target.baseX+side*(target.width/2+.35))),y:target.y+1.4,expires:this.time+20};events.push({type:'jet-spawn'});}
    }
    if(this.jetpack){
      const j=this.jetpack;const dx=Math.abs(((this.x-j.x+WIDTH*1.5)%WIDTH+WIDTH)%WIDTH-WIDTH/2);
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
      if(landing.type==='cracked')landing.broken=true;
      events.push({type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring'});
    }
    this.height=Math.max(this.height,this.y);
    this.camera=Math.max(this.camera,this.height-.8);
    if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death'});}
    this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
    this.generate();return events;
  }
}
