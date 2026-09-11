export const WIDTH=10, GRAVITY=32, JUMP=14, SPEED=6, STEP=1/60;
export class Game {
  constructor(seed=1){this.reset(seed);}
  reset(seed=1){
    this.seed=seed>>>0;this.x=0;this.y=0;this.vx=0;this.vy=JUMP;
    this.time=0;this.height=0;this.camera=6;this.previousCamera=6;
    this.bounceAge=0;this.bounces=0;this.bananas=0;this.dead=false;
    this.platforms=[];this.nextId=0;this.nextY=0;this.nextX=0;
    this.add(0,0,3.6,'solid',false);this.generate();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  add(x,y,width,type,coin=true){this.platforms.push({id:this.nextId++,x,baseX:x,y,width,type,coin,broken:false,phase:this.random()*6.28});}
  generate(){
    while(this.nextY<this.camera+12){
      this.nextY+=1.25+this.random()*0.6;
      this.nextX=Math.max(-3.5,Math.min(3.5,this.nextX+(this.random()*2-1)*1.65));
      this.add(this.nextX,this.nextY,this.height<12?2.7:2.3,'solid');
      if(this.nextY>10 && this.random()<0.52){
        const x=this.nextX>0?this.nextX-3.3:this.nextX+3.3;
        const types=['moving','cracked','spring'];
        this.add(x,this.nextY+0.35,1.65,types[Math.floor(this.random()*3)]);
      }
    }
  }
  step(input,dt=STEP){
    if(this.dead)return [];
    const events=[];this.time+=dt;this.bounceAge+=dt;
    this.previousCamera=this.camera;
    const target=input*SPEED, amount=36*dt;
    this.vx+=Math.max(-amount,Math.min(amount,target-this.vx));
    const oldX=this.x, oldY=this.y;
    const travel=this.vx*dt;
    this.x=((oldX+travel+WIDTH/2)%WIDTH+WIDTH)%WIDTH-WIDTH/2;
    this.vy-=GRAVITY*dt;this.y+=this.vy*dt;
    let landing=null, earliest=2;
    for(const p of this.platforms){
      const previousX=p.x;
      if(p.type==='moving')p.x=p.baseX+Math.sin(this.time*1.6+p.phase)*0.55;
      if(p.broken)continue;
      if(this.vy<0 && oldY>=p.y && this.y<=p.y){
        const t=(oldY-p.y)/(oldY-this.y), x=oldX+travel*t;
        const px=previousX+(p.x-previousX)*t;
        const distance=Math.abs(((x-px+15)%WIDTH+WIDTH)%WIDTH-5);
        if(distance<p.width/2+0.24 && t<earliest){earliest=t;landing=p;}
      }
      const dx=Math.abs(((this.x-p.x+15)%WIDTH+WIDTH)%WIDTH-5);
      if(p.coin && dx<0.65 && Math.abs(this.y+0.65-(p.y+0.85))<0.85){
        p.coin=false;this.bananas++;events.push({type:'coin',x:p.x,y:p.y+1});
      }
    }
    if(landing){
      this.y=landing.y;this.vy=landing.type==='spring'?18:JUMP;
      this.bounceAge=0;this.bounces++;
      if(landing.type==='cracked')landing.broken=true;
      events.push({type:'bounce',x:this.x,y:this.y,spring:landing.type==='spring'});
    }
    this.height=Math.max(this.height,this.y);
    this.camera=Math.max(this.camera,this.height-0.8);
    if(this.y+1.45<this.camera-8){this.dead=true;events.push({type:'death'});}
    this.platforms=this.platforms.filter(p=>p.y>this.camera-11);
    this.generate();return events;
  }
}
