export const WIDTH=11.2, GRAVITY=18, JUMP=12.6, SPEED=5.8, VIEW_HEIGHT=13.76, STEP=1/60;
export const paceAt=time=>1.16+.20*Math.min(Math.max(time,0)/180,1);
export const platformPhaseAt=time=>1.1*(time+.45*(time<=180?time*time/360:time-90));
export const movingX=(platform,time)=>platform.baseX+Math.sin(platformPhaseAt(time)+(platform.phase||0))*.48;
export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.seed=seed>>>0;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=5;this.previousCamera=5;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;
    this.add(0,0,2.8,'solid',false);this.generate();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  add(x,y,width,type,coin=true){this.platforms.push({id:this.nextId++,x,baseX:x,y,width,type,coin,broken:false,phase:this.random()*6.28});}
  generate(){
    while(this.nextY<this.camera+10){
      const difficulty=Math.min(this.nextY/180,1);
      this.nextY+=3.85+this.random()*.10+difficulty*.10;
      // Exactly one branch per row, with an intentional lateral transfer.
      const candidates=[-3.7,-2.5,-1.3,0,1.3,2.5,3.7].filter(x=>{
        const distance=Math.abs(x-this.nextX);
        return distance>=1.65 && distance<=2.9;
      });
      this.nextX=candidates[Math.floor(this.random()*candidates.length)];
      let type='solid';
      if(this.nextY>10){
        const roll=this.random();
        type=roll<.35+Math.min(this.time/180,1)*.2?'moving':roll<.7?'solid':roll<.88?'cracked':'spring';
      }
      this.add(this.nextX,this.nextY,2.5-difficulty*.65,type);
    }
  }
  step(input,dt=STEP){
    if(this.dead)return [];
    const events=[];this.time+=dt;
    // Active play time stays real: theme changes remain every 30 seconds.
    dt*=paceAt(this.time);this.bounceAge+=dt;
    this.previousCamera=this.camera;
    const target=input*SPEED, amount=24*dt;
    this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));
    const oldX=this.x, oldY=this.y;
    const travel=this.vx*dt;
    this.x=((oldX+travel+WIDTH/2)%WIDTH+WIDTH)%WIDTH-WIDTH/2;
    this.vy-=GRAVITY*dt;this.y+=this.vy*dt;
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
      if(p.coin && dx<0.65 && Math.abs(this.y+0.65-(p.y+0.85))<0.85){
        p.coin=false;this.bananas++;events.push({type:'coin',x:p.x,y:p.y+1});
      }
    }
    if(landing){
      this.y=landing.y;this.vy=landing.type==='spring'?15.5:JUMP;
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
