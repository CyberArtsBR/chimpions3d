import * as THREE from 'three';

const EVENT_STYLE={
  takeoff:{color:0xb7d77a,count:8,life:.42,power:1.5},
  land:{color:0xc8a86b,count:14,life:.58,power:2.1},
  slide:{color:0xb99662,count:8,life:.45,power:1.3},
  banana:{color:0xffdf57,count:10,life:.46,power:1.8},
  goldenBanana:{color:0xfff09a,count:22,life:.68,power:2.6},
  perfectJump:{color:0xaef58a,count:14,life:.52,power:2.2},
  perfectSlide:{color:0x8fe5d2,count:14,life:.52,power:2.2},
  nearMiss:{color:0xffb46d,count:10,life:.46,power:2.3},
  flow:{color:0xa4f2b7,count:16,life:.65,power:2.2},
  multiplier:{color:0xf5ef82,count:18,life:.7,power:2.4},
  stage:{color:0xd9f29a,count:30,life:1,power:3},
  death:{color:0xff6e58,count:32,life:.9,power:3.4},
  record:{color:0xffe57a,count:44,life:1.2,power:3.7}
};

export class DashVFX{
  constructor(scene,quality){
    this.scene=scene;this.quality=quality;this.capacity=192;this.active=[];this.pool=[];this.seed=0x6d2b79f5;this.ambientAccumulator=0;this.reducedMotion=false;
    this.positions=new Float32Array(this.capacity*3);this.colors=new Float32Array(this.capacity*3);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.material=new THREE.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending});
    this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;this.points.renderOrder=18;scene.add(this.points);
    this.streakPositions=new Float32Array(36*2*3);this.streakGeometry=new THREE.BufferGeometry();
    this.streakGeometry.setAttribute('position',new THREE.BufferAttribute(this.streakPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.streakMaterial=new THREE.LineBasicMaterial({color:0xd8f1d5,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    this.streaks=new THREE.LineSegments(this.streakGeometry,this.streakMaterial);this.streaks.frustumCulled=false;this.streaks.renderOrder=17;scene.add(this.streaks);
    this.setQuality(quality);
  }
  random(){this.seed=(Math.imul(this.seed^this.seed>>>15,1|this.seed)+0x6d2b79f5)|0;return((this.seed^this.seed>>>14)>>>0)/4294967296;}
  setQuality(quality){this.quality=quality;this.maxParticles=Math.min(this.capacity,quality.particleCount||64);this.maxStreaks=Math.min(36,quality.streakCount||8);this.material.size=quality.name==='ULTRA'?.085:quality.name==='LOW'?.065:.075;}
  setReducedMotion(value){
    this.reducedMotion=!!value;
    if(this.reducedMotion){this.ambientAccumulator=0;this.streakMaterial.opacity=0;this.streaks.visible=false;}
    return this.reducedMotion;
  }
  acquire(){return this.pool.pop()||{x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,color:new THREE.Color()};}
  emit(type,{x=0,y=0,z=.7,direction=1,intensity=1,color=null}={}){
    const style=EVENT_STYLE[type]||EVENT_STYLE.flow,motionScale=this.reducedMotion?.3:1,count=Math.max(1,Math.round(style.count*intensity*motionScale*(this.quality.name==='LOW'?.55:this.quality.name==='BALANCED'?.78:1)));
    const tint=new THREE.Color(color??style.color);
    for(let i=0;i<count&&this.active.length<this.maxParticles;i++){
      const p=this.acquire(),a=this.random()*Math.PI*2,rad=this.random()*.16,power=style.power*(.45+this.random()*.75)*intensity;
      p.x=x+Math.cos(a)*rad;p.y=y+Math.sin(a)*rad;p.z=z+(this.random()-.5)*.16;
      p.vx=(Math.cos(a)*power+direction*(type==='slide'?-1.5:0))*.55;p.vy=Math.abs(Math.sin(a))*power+(type==='land'?.35:.65);p.vz=(this.random()-.5)*.35;
      p.age=0;p.life=style.life*(.72+this.random()*.55);p.color.copy(tint).offsetHSL((this.random()-.5)*.025,(this.random()-.5)*.06,(this.random()-.5)*.08);this.active.push(p);
    }
  }
  reset(){for(const p of this.active)this.pool.push(p);this.active.length=0;this.points.visible=false;this.streakMaterial.opacity=0;this.ambientAccumulator=0;}
  update(dt,{time=0,speedRatio=1,playerX=0,groundY=-4,state='menu',pollen=1,storm=0,viewW=20,viewH=12}={}){
    const activeState=state==='running'||state==='over';
    if(activeState&&!this.reducedMotion&&this.active.length<this.maxParticles){
      this.ambientAccumulator+=dt*(1.2+pollen*2.4+Math.max(0,speedRatio-1)*1.4);
      while(this.ambientAccumulator>=1){
        this.ambientAccumulator-=1;const p=this.acquire();
        p.x=playerX+(this.random()-.25)*viewW*.9;p.y=groundY+.7+this.random()*viewH*.72;p.z=-1-this.random()*5;
        p.vx=-.25-speedRatio*(.2+this.random()*.35);p.vy=(this.random()-.5)*.08;p.vz=0;p.age=0;p.life=2.2+this.random()*2.4;
        p.color.set(storm>0.5?0xb8d1d3:0xd7ed9e);this.active.push(p);
      }
    }
    let write=0;
    for(let i=this.active.length-1;i>=0;i--){
      const p=this.active[i];p.age+=dt;
      if(p.age>=p.life){this.pool.push(p);this.active.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*.75;
      const fade=1-p.age/p.life,brightness=.65+.35*fade;
      this.positions[write*3]=p.x;this.positions[write*3+1]=p.y;this.positions[write*3+2]=p.z;
      this.colors[write*3]=p.color.r*brightness;this.colors[write*3+1]=p.color.g*brightness;this.colors[write*3+2]=p.color.b*brightness;write++;
      if(write>=this.maxParticles)break;
    }
    for(let i=write;i<this.capacity;i++)this.positions[i*3+1]=-999;
    this.geometry.setDrawRange(0,write);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;this.points.visible=write>0;

    const speed=Math.max(0,speedRatio-1.05),count=activeState&&!this.reducedMotion?Math.min(this.maxStreaks,Math.round(speed*10)):0;
    this.streakMaterial.opacity=Math.min(.17,speed*.055);
    for(let i=0;i<count;i++){
      const phase=(time*(1.8+speedRatio*.7)+i*.618)%1,x=viewW*.6-phase*viewW*1.4,y=groundY+viewH*(.26+.68*((i*.371)%1)),len=.34+speed*.28;
      const o=i*6;this.streakPositions[o]=x;this.streakPositions[o+1]=y;this.streakPositions[o+2]=2.7;
      this.streakPositions[o+3]=x-len;this.streakPositions[o+4]=y+.02;this.streakPositions[o+5]=2.7;
    }
    this.streakGeometry.setDrawRange(0,count*2);this.streakGeometry.attributes.position.needsUpdate=true;this.streaks.visible=count>0&&this.streakMaterial.opacity>.001;
  }
  stats(){return{reducedMotion:this.reducedMotion,activeParticles:this.active.length,pooledParticles:this.pool.length,maxParticles:this.maxParticles,maxStreaks:this.maxStreaks,streaksVisible:this.streaks.visible};}
  dispose(){this.scene.remove(this.points,this.streaks);this.geometry.dispose();this.material.dispose();this.streakGeometry.dispose();this.streakMaterial.dispose();}
}
