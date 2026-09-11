export const WIDTH=8.6, GRAVITY=18, JUMP=12.6, SPEED=4.4, VIEW_HEIGHT=13.76, STEP=1/60;
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
      this.nextY+=2.6+this.random()*.45+difficulty*.4;
      // Exactly one branch per row, with an intentional lateral transfer.
      const candidates=[-2.65,-2,-1.3,0,1.3,2,2.65].filter(x=>{
        const distance=Math.abs(x-this.nextX);
        return distance>=1.65 && distance<=2.9;
      });
      this.nextX=candidates[Math.floor(this.random()*candidates.length)];
      let type='solid';
      if(this.nextY>18 && this.nextId%4===0){
        const roll=this.random();
        type=roll<.4?'moving':roll<.75?'cracked':'spring';
      }
      this.add(this.nextX,this.nextY,2.5-difficulty*.65,type);
    }
  }
  step(input,dt=STEP){
    if(this.dead)return [];
    const events=[];this.time+=dt;this.bounceAge+=dt;
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
      if(p.type==='moving')p.x=p.baseX+Math.sin(this.time*1.1+p.phase)*0.38;
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
