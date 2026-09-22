export const WIDTH=14.4, GRAVITY=18, JUMP=12.6*Math.sqrt(1.3), SPEED=6.2, VIEW_HEIGHT=12.4, STEP=1/60;
export const PLATFORM_SCALE=1.5*.75*.75, PLATFORM_LENGTH=PLATFORM_SCALE*1.3, ITEM_SCALE=1.5, BANANA_HEIGHT=1.35;
export const SPRING_JUMP=28*Math.sqrt(1.3), JET_DURATION=10, JET_SPEED=24;
export const VINE_INSET=.24;
export const WIND_START=45, EVENT_INTERVAL=45, EVENT_DURATION=12;
export const RULESET='2026-09-expedition-v6-countdown-bananas';
export const WRAP_SPAN=WIDTH-2*VINE_INSET;

const wrapX=x=>((x+WRAP_SPAN/2)%WRAP_SPAN+WRAP_SPAN)%WRAP_SPAN-WRAP_SPAN/2;
const wrappedDistance=(a,b)=>Math.abs(wrapX(a-b));

// Progressive arcade pace: starts slightly below 1x and reaches 3x at five minutes.
export const paceAt=time=>.92+2.08*Math.min(Math.max(time,0)/300,1);

const PLATFORM_TRAVEL=1.65, PLATFORM_HEIGHT_BAND=2.2, PLATFORM_GAP=.8;
export const platformTravelFor=type=>type==='moving'?PLATFORM_TRAVEL:type==='leaf'?1.05:type==='swing'?1.35:0;

export const platformPhaseAt=time=>{
  const t=Math.max(0,time),ramp=Math.min(t,300);
  return .65*(t+.6*(ramp*ramp/600+Math.max(0,t-300)));
};

export const movingX=(platform,time)=>
  platform.baseX+Math.sin(platformPhaseAt(time)*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange??PLATFORM_TRAVEL);

export const platformX=(platform,time)=>{
  if(platform.type==='moving')return movingX(platform,time);
  if(platform.type==='leaf')return platform.baseX+Math.sin(platformPhaseAt(time)*.58*(platform.moveSpeed||1)+(platform.phase||0))*(platform.moveRange||1.05);
  if(platform.type==='swing')return platform.baseX+Math.sin(time*(.78+(platform.moveSpeed||1)*.18)+(platform.phase||0))*(platform.moveRange||1.35);
  return platform.baseX;
};

export const hazardX=(hazard,time)=>
  hazard.baseX+Math.sin(time*(1.25+(hazard.speed||1)*.22)+(hazard.phase||0))*(hazard.range||.28);

export const windAt=(time,runSeed,eventType='')=>{
  if(time<WIND_START)return 0;
  const ramp=Math.min(1,(time-WIND_START)/150);
  const strength=.3+.95*ramp;
  const eventBoost=eventType==='wind-surge'?1.65:1;
  return Math.sin(time*.42+(runSeed%4096)*.017)*strength*eventBoost;
};

const EVENT_TYPES=['wind-surge','banana-bloom','spring-fever'];

export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.runSeed=seed>>>0;this.seed=this.runSeed;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
    this.jetpack=null;this.jetRemaining=0;this.nextJetAt=30;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.wind=0;this.windScale=1;this.event=null;this.eventIndex=0;this.nextEventAt=EVENT_INTERVAL;
    this.lastMilestone=0;this.hazardCooldown=0;this.hazards=[];this.nextHazardId=0;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;this.nextWidth=2.8*PLATFORM_LENGTH;
    this.add(0,0,2.8,'solid',false);this.generate();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  canPlace(x,y,width,type){
    const extent=width/2+platformTravelFor(type);
    if(Math.abs(x)+extent>WIDTH/2-VINE_INSET-.35)return false;
    return this.platforms.every(p=>p.broken||Math.abs(p.y-y)>=PLATFORM_HEIGHT_BAND||
      Math.abs(p.baseX-x)>=extent+p.width/2+platformTravelFor(p.type)+PLATFORM_GAP);
  }
  add(x,y,width,type,coin=true,route='safe'){
    const size=Math.max(0,Math.min(1,(width-.95)/1.5));
    width*=PLATFORM_LENGTH;
    const moveRange=platformTravelFor(type),moveSpeed=1.25*(.62+.86*size);
    if(!this.canPlace(x,y,width,type))return false;
    this.platforms.push({
      id:this.nextId++,x,baseX:x,y,width,type,coin,route,
      reward:width<=1.3*PLATFORM_LENGTH?2:1,
      fragile:type==='cracked',broken:false,phase:this.random()*6.28,
      moveSpeed,moveRange,vanishAt:null
    });
    const platform=this.platforms.at(-1);
    if(moveRange)platform.x=platformX(platform,this.time);
    return true;
  }
  addHazardNear(platform,safeX,safeWidth){
    if(this.hazards.some(h=>Math.abs(h.y-platform.y)<1.5))return false;
    const away=platform.baseX>=safeX?1:-1,limit=WIDTH/2-VINE_INSET-.62;
    let x=platform.baseX+away*(platform.width/2+.52);
    x=Math.max(-limit,Math.min(limit,x));
    if(wrappedDistance(x,safeX)<safeWidth/2+.85)return false;
    this.hazards.push({
      id:this.nextHazardId++,type:'thorn-pod',x,baseX:x,y:platform.y+.72,
      radius:.42,range:.22+this.random()*.18,speed:.7+this.random()*.7,phase:this.random()*6.28
    });
    return true;
  }
  generate(){
    while(this.nextY<this.camera+10){
      const difficulty=Math.min(this.nextY/240,1);
      const rise=3.65+this.random()*.2+difficulty*.2;
      const y=this.nextY+rise,width=2.45-difficulty*.65;
      const limit=WIDTH/2-VINE_INSET-.35-width*PLATFORM_LENGTH/2;
      const flight=(JUMP+Math.sqrt(JUMP*JUMP-2*GRAVITY*rise))/GRAVITY;
      const reach=Math.min(1.9+difficulty*.9,
        SPEED*(flight-STEP)-SPEED*SPEED/24-this.nextWidth/2-.5);
      const candidates=[];
      for(let x=-limit;x<=limit+.001;x+=.2){
        const distance=Math.abs(x-this.nextX);
        if(distance>=1.1&&distance<=reach&&this.canPlace(x,y,width*PLATFORM_LENGTH,'solid'))candidates.push(x);
      }
      const x=candidates.length?candidates[Math.floor(this.random()*candidates.length)]:
        Math.max(-limit,Math.min(limit,this.nextX));
      const safeBanana=this.random()<.58;
      if(!this.add(x,y,width,'solid',safeBanana,'safe'))break;
      this.nextX=x;this.nextY=y;this.nextWidth=width*PLATFORM_LENGTH;

      const extras=1+(this.random()<.81?1:0);
      for(let i=0;i<extras;i++){
        const roll=this.random();
        let type='solid';
        if(y>=14){
          if(roll<.16+difficulty*.06)type='moving';
          else if(roll<.32+difficulty*.08)type='cracked';
          else if(roll<.44+difficulty*.08)type='spring';
          else if(roll<.58+difficulty*.08)type='leaf';
          else if(roll<.72+difficulty*.08)type='vanish';
          else if(roll<.84+difficulty*.08)type='swing';
        }
        const optionalWidth=1.35+this.random()*.55-difficulty*.4;
        const optionalY=y-1.1-this.random()*.35;
        const extent=optionalWidth*PLATFORM_LENGTH/2+platformTravelFor(type);
        const edge=WIDTH/2-VINE_INSET-.35-extent,places=[];
        for(let px=-edge;px<=edge+.001;px+=.15){
          if(this.canPlace(px,optionalY,optionalWidth*PLATFORM_LENGTH,type))places.push(px);
        }
        if(!places.length)continue;
        const px=this.random()<.5?places[0]:places.at(-1);
        const rewardType=['spring','leaf','vanish','swing'].includes(type);
        const optionalBanana=this.random()<(rewardType ? .72 : .48);
        if(this.add(px,optionalY,optionalWidth,type,optionalBanana,rewardType?'reward':'risk')){
          const placed=this.platforms.at(-1);
          if(rewardType)placed.reward=2;
          if(y>24&&this.random()<.10+difficulty*.14)this.addHazardNear(placed,x,width*PLATFORM_LENGTH);
        }
      }
    }
  }
  spawnJetpack(){
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
  updateCanopyEvent(events){
    if(this.event&&this.time>=this.event.ends){
      const ended=this.event.type;this.event=null;events.push({type:'event-end',eventType:ended});
    }
    if(!this.event&&this.time>=this.nextEventAt){
      const type=EVENT_TYPES[(this.runSeed+this.eventIndex*5)%EVENT_TYPES.length];
      this.event={type,started:this.time,ends:this.time+EVENT_DURATION};
      this.eventIndex++;this.nextEventAt+=EVENT_INTERVAL;
      events.push({type:'event-start',eventType:type,duration:EVENT_DURATION});
    }
  }
  step(input,dt=STEP){
    if(this.dead)return [];
    const events=[],realDt=dt;this.time+=realDt;this.updateCanopyEvent(events);
    this.wind=windAt(this.time,this.runSeed,this.event?.type||'')*this.windScale;
    this.hazardCooldown=Math.max(0,this.hazardCooldown-realDt);

    dt*=paceAt(this.time);this.bounceAge+=dt;
    this.previousCamera=this.camera;
    const target=input*SPEED+this.wind,amount=24*dt;
    this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));

    const oldX=this.x,oldY=this.y,travel=this.vx*dt;
    const vineX=WIDTH/2-VINE_INSET,nextX=oldX+travel;
    if(nextX>vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'right',x:this.x,y:this.y});}
    else if(nextX<-vineX){this.x=wrapX(nextX);events.push({type:'wrap',side:'left',x:this.x,y:this.y});}
    else this.x=nextX;

    if(this.jetRemaining>0){
      const flight=Math.min(realDt,this.jetRemaining);this.y+=JET_SPEED*flight;this.jetRemaining=Math.max(0,this.jetRemaining-realDt);this.vy=JET_SPEED/paceAt(this.time);
      if(this.jetRemaining===0){this.vy=JUMP;events.push({type:'jet-end'});}
    }else{
      this.y+=this.vy*dt-.5*GRAVITY*dt*dt;this.vy-=GRAVITY*dt;
    }

    if(this.time>=this.nextJetAt){
      this.nextJetAt=(Math.floor(this.time/30)+1)*30;
      this.spawnJetpack();events.push({type:'jet-spawn'});
    }
    if(this.jetpack){
      const j=this.jetpack,dx=wrappedDistance(this.x,j.x);
      if(dx<.65*ITEM_SCALE&&j.y>=Math.min(oldY,this.y)+.15&&j.y<=Math.max(oldY,this.y)+1.45){
        this.jetpack=null;this.jetRemaining=JET_DURATION;events.push({type:'jet',x:this.x,y:this.y});
      }else if(this.time>j.expires||j.y<this.camera-VIEW_HEIGHT/2)this.jetpack=null;
    }

    for(const p of this.platforms){
      if(p.type==='vanish'&&p.vanishAt!=null&&!p.broken&&this.time>=p.vanishAt){
        p.broken=true;events.push({type:'vanish',x:p.x,y:p.y,platformId:p.id});
      }
    }

    let landing=null,earliest=2;
    for(const p of this.platforms){
      const previousX=p.x;
      if(platformTravelFor(p.type))p.x=platformX(p,this.time);
      if(p.broken)continue;
      if(this.vy<0&&oldY>=p.y&&this.y<=p.y){
        const t=(oldY-p.y)/(oldY-this.y),x=oldX+travel*t;
        const px=previousX+(p.x-previousX)*t,distance=wrappedDistance(x,px);
        if(distance<p.width/2+.24&&t<earliest){earliest=t;landing=p;}
      }
      const dx=wrappedDistance(this.x,p.x);
      if(p.coin&&dx<.65*ITEM_SCALE&&Math.abs(this.y+.65-(p.y+BANANA_HEIGHT))<.85+.25*(ITEM_SCALE-1)){
        p.coin=false;
        const bloom=this.event?.type==='banana-bloom'?1:0,value=(p.reward||1)+bloom;
        this.bananas+=value;events.push({type:'coin',x:p.x,y:p.y+BANANA_HEIGHT,value,bloom:!!bloom});
      }
    }

    for(const h of this.hazards){
      h.x=hazardX(h,this.time);
      if(this.hazardCooldown>0)continue;
      const dx=wrappedDistance(this.x,h.x);
      if(dx<h.radius+.28&&Math.abs(this.y+.45-h.y)<.62){
        const delta=wrapX(this.x-h.x),push=delta>=0?1:-1;
        this.vx=Math.max(-SPEED*1.25,Math.min(SPEED*1.25,this.vx+push*3.8));
        this.vy=Math.min(this.vy,-2.4);this.hazardCooldown=.9;
        events.push({type:'hazard',hazardType:h.type,x:h.x,y:h.y});break;
      }
    }

    if(landing){
      this.y=landing.y;
      const springBoost=this.event?.type==='spring-fever'?1.08:1;
      this.vy=landing.type==='spring'?SPRING_JUMP*springBoost:JUMP;
      this.bounceAge=0;this.bounces++;
      if(landing.type==='cracked'||landing.fragile)landing.broken=true;
      if(landing.type==='vanish'&&landing.vanishAt==null)landing.vanishAt=this.time+.55;
      events.push({
        type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring',
        fragile:landing.type==='cracked',platformType:landing.type,
        route:landing.route,platformId:landing.id
      });
    }

    this.height=Math.max(this.height,this.y);
    const milestone=Math.floor(this.height/50)*50;
    if(milestone>this.lastMilestone){
      this.lastMilestone=milestone;if(milestone>0)events.push({type:'milestone',meters:milestone,x:this.x,y:this.y});
    }

    const cameraTarget=Math.max(this.camera,this.height-VIEW_HEIGHT*.085+Math.max(0,this.vy)*.018);
    this.camera+=Math.max(0,cameraTarget-this.camera)*(1-Math.exp(-8*dt));
    if(this.y+1.45<this.camera-VIEW_HEIGHT/2){this.dead=true;events.push({type:'death'});}

    this.platforms=this.platforms.filter(p=>p.y>this.camera-10);
    this.hazards=this.hazards.filter(h=>h.y>this.camera-10);
    this.generate();return events;
  }
}
