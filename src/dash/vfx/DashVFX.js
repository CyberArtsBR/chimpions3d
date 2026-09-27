import * as THREE from 'three';

const EVENT_STYLE={
  takeoff:{color:0xb7d77a,count:7,life:.4,power:1.45,ring:true,ringLife:.28,ringStart:.08,ringEnd:.46,flatten:.34},
  footContact:{color:0xbda579,count:3,life:.28,power:.72,ring:false},
  land:{color:0xc8a86b,count:12,life:.5,power:1.95,ring:true,ringLife:.38,ringStart:.12,ringEnd:.68,flatten:.28},
  slide:{color:0xb99662,count:8,life:.42,power:1.28,ring:true,ringLife:.3,ringStart:.08,ringEnd:.5,flatten:.22},
  banana:{color:0xffdf57,count:9,life:.42,power:1.7,ring:true,ringLife:.26,ringStart:.06,ringEnd:.34,flatten:1},
  goldenBanana:{color:0xfff09a,count:18,life:.62,power:2.45,ring:true,ringLife:.52,ringStart:.08,ringEnd:.72,flatten:1},
  perfectJump:{color:0xaef58a,count:12,life:.48,power:2.05,ring:true,ringLife:.42,ringStart:.12,ringEnd:.76,flatten:.72},
  perfectSlide:{color:0x8fe5d2,count:12,life:.48,power:2.05,ring:true,ringLife:.42,ringStart:.12,ringEnd:.7,flatten:.34},
  nearMiss:{color:0xffb46d,count:9,life:.38,power:2.25,ring:true,ringLife:.25,ringStart:.04,ringEnd:.42,flatten:.55},
  flow:{color:0xa4f2b7,count:10,life:.5,power:1.8,ring:false},
  multiplier:{color:0xf5ef82,count:15,life:.62,power:2.3,ring:true,ringLife:.5,ringStart:.15,ringEnd:.82,flatten:.82},
  stage:{color:0xd9f29a,count:24,life:.82,power:2.7,ring:true,ringLife:.72,ringStart:.2,ringEnd:1.35,flatten:.82},
  death:{color:0xff6e58,count:24,life:.62,power:3,ring:true,ringLife:.42,ringStart:.08,ringEnd:.88,flatten:.7},
  record:{color:0xffe57a,count:34,life:.95,power:3.35,ring:true,ringLife:.9,ringStart:.18,ringEnd:1.45,flatten:1}
};

export class DashVFX{
  constructor(scene,quality){
    this.scene=scene;this.quality=quality;this.capacity=192;this.active=[];this.seed=0x6d2b79f5;this.ambientAccumulator=0;this.tint=new THREE.Color();this.reducedMotion=false;
    this.pool=Array.from({length:this.capacity},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,color:new THREE.Color()}));
    this.positions=new Float32Array(this.capacity*3);this.colors=new Float32Array(this.capacity*3);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.material=new THREE.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending});
    this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;this.points.renderOrder=18;scene.add(this.points);

    this.ringCapacity=10;this.ringSegments=16;this.rings=[];
    this.ringPool=Array.from({length:this.ringCapacity},()=>({x:0,y:0,z:0,age:0,life:.4,start:.1,end:.7,flatten:1,color:new THREE.Color()}));
    this.ringPositions=new Float32Array(this.ringCapacity*this.ringSegments*2*3);this.ringColors=new Float32Array(this.ringCapacity*this.ringSegments*2*3);
    this.ringGeometry=new THREE.BufferGeometry();
    this.ringGeometry.setAttribute('position',new THREE.BufferAttribute(this.ringPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.ringGeometry.setAttribute('color',new THREE.BufferAttribute(this.ringColors,3).setUsage(THREE.DynamicDrawUsage));
    this.ringMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending});
    this.ringLines=new THREE.LineSegments(this.ringGeometry,this.ringMaterial);this.ringLines.frustumCulled=false;this.ringLines.renderOrder=18;scene.add(this.ringLines);

    this.streakPositions=new Float32Array(36*2*3);this.streakGeometry=new THREE.BufferGeometry();
    this.streakGeometry.setAttribute('position',new THREE.BufferAttribute(this.streakPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.streakMaterial=new THREE.LineBasicMaterial({color:0xd8f1d5,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    this.streaks=new THREE.LineSegments(this.streakGeometry,this.streakMaterial);this.streaks.frustumCulled=false;this.streaks.renderOrder=17;scene.add(this.streaks);
    this.setQuality(quality);
  }
  random(){this.seed=(Math.imul(this.seed^this.seed>>>15,1|this.seed)+0x6d2b79f5)|0;return((this.seed^this.seed>>>14)>>>0)/4294967296;}
  setQuality(quality){
    this.quality=quality;this.maxParticles=Math.min(this.capacity,quality.particleCount||64);this.maxStreaks=Math.min(36,quality.streakCount||8);
    this.maxRings=quality.name==='LOW'?3:quality.name==='BALANCED'?5:quality.name==='HIGH'?8:10;this.activeRingSegments=quality.name==='LOW'?10:quality.name==='BALANCED'?12:this.ringSegments;
    this.material.size=quality.name==='ULTRA'?.085:quality.name==='LOW'?.065:.075;
  }
  setReducedMotion(value){
    this.reducedMotion=!!value;
    if(this.reducedMotion){this.ambientAccumulator=0;this.streakMaterial.opacity=0;this.streaks.visible=false;}
    return this.reducedMotion;
  }
  acquire(){return this.pool.pop()||null;}
  acquireRing(){return this.ringPool.pop()||null;}
  emit(type,{x=0,y=0,z=.7,direction=1,intensity=1,color=null}={}){
    const style=EVENT_STYLE[type]||EVENT_STYLE.flow,qualityScale=this.quality.name==='LOW'?.55:this.quality.name==='BALANCED'?.78:1,motionScale=this.reducedMotion?.3:1;
    const count=Math.max(1,Math.round(style.count*intensity*qualityScale*motionScale));this.tint.set(color??style.color);
    for(let i=0;i<count&&this.active.length<this.maxParticles;i++){
      const p=this.acquire();if(!p)break;
      const a=this.random()*Math.PI*2,rad=this.random()*.15,power=style.power*(.45+this.random()*.75)*intensity;
      p.x=x+Math.cos(a)*rad;p.y=y+Math.sin(a)*rad;p.z=z+(this.random()-.5)*.16;
      const lateral=type==='nearMiss'?direction*(1.4+this.random()*1.25):type==='slide'?-1.35*direction:type==='footContact'?-.42*direction:0;
      p.vx=Math.cos(a)*power*.55+lateral;p.vy=(type==='nearMiss'?.25:Math.abs(Math.sin(a))*power)+(type==='land'?.25:type==='footContact'?.12:.58);p.vz=(this.random()-.5)*.35;
      p.age=0;p.life=style.life*(.72+this.random()*.5);p.color.copy(this.tint).offsetHSL((this.random()-.5)*.025,(this.random()-.5)*.06,(this.random()-.5)*.08);this.active.push(p);
    }
    if(style.ring&&!this.reducedMotion&&this.rings.length<this.maxRings){
      const ring=this.acquireRing();if(ring){ring.x=x;ring.y=y;ring.z=z-.02;ring.age=0;ring.life=style.ringLife;ring.start=style.ringStart;ring.end=style.ringEnd*intensity;ring.flatten=style.flatten;ring.color.copy(this.tint);this.rings.push(ring);}
    }
  }
  reset(){
    while(this.active.length)this.pool.push(this.active.pop());while(this.rings.length)this.ringPool.push(this.rings.pop());
    this.points.visible=false;this.ringLines.visible=false;this.streakMaterial.opacity=0;this.ambientAccumulator=0;
  }
  update(dt,{time=0,speedRatio=1,playerX=0,groundY=-4,state='menu',pollen=1,storm=0,viewW=20,viewH=12,flow=0}={}){
    const activeState=state==='running'||state==='over',flowPower=Math.max(0,Math.min(1,flow/100));
    if(activeState&&!this.reducedMotion&&this.active.length<this.maxParticles){
      this.ambientAccumulator+=dt*(1.05+pollen*2.1+Math.max(0,speedRatio-1)*1.2+flowPower*.65);
      while(this.ambientAccumulator>=1){
        this.ambientAccumulator-=1;const p=this.acquire();if(!p)break;
        p.x=playerX+(this.random()-.25)*viewW*.9;p.y=groundY+.7+this.random()*viewH*.72;p.z=-1-this.random()*5;
        p.vx=-.25-speedRatio*(.2+this.random()*.35);p.vy=(this.random()-.5)*.08;p.vz=0;p.age=0;p.life=2.2+this.random()*2.4;
        p.color.set(storm>0.5?0xb8d1d3:flowPower>.75?0xc7f2ad:0xd7ed9e);this.active.push(p);
      }
    }

    let write=0;
    for(let i=this.active.length-1;i>=0;i--){
      const p=this.active[i];p.age+=dt;
      if(p.age>=p.life){this.pool.push(p);this.active.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*.75;
      const fade=1-p.age/p.life,brightness=.62+.38*fade;
      this.positions[write*3]=p.x;this.positions[write*3+1]=p.y;this.positions[write*3+2]=p.z;
      this.colors[write*3]=p.color.r*brightness;this.colors[write*3+1]=p.color.g*brightness;this.colors[write*3+2]=p.color.b*brightness;write++;
      if(write>=this.maxParticles)break;
    }
    for(let i=write;i<this.capacity;i++)this.positions[i*3+1]=-999;
    this.geometry.setDrawRange(0,write);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;this.points.visible=write>0;

    let ringWrite=0;
    for(let i=this.rings.length-1;i>=0;i--){
      const ring=this.rings[i];ring.age+=dt;
      if(ring.age>=ring.life){this.ringPool.push(ring);this.rings.splice(i,1);continue;}
      const t=ring.age/ring.life,radius=ring.start+(ring.end-ring.start)*(1-(1-t)*(1-t)),fade=(1-t)*(1-t);
      for(let seg=0;seg<this.activeRingSegments;seg++){
        const a0=seg/this.activeRingSegments*Math.PI*2,a1=(seg+1)/this.activeRingSegments*Math.PI*2,o=ringWrite*6;
        this.ringPositions[o]=ring.x+Math.cos(a0)*radius;this.ringPositions[o+1]=ring.y+Math.sin(a0)*radius*ring.flatten;this.ringPositions[o+2]=ring.z;
        this.ringPositions[o+3]=ring.x+Math.cos(a1)*radius;this.ringPositions[o+4]=ring.y+Math.sin(a1)*radius*ring.flatten;this.ringPositions[o+5]=ring.z;
        for(let v=0;v<2;v++){const c=o+v*3;this.ringColors[c]=ring.color.r*fade;this.ringColors[c+1]=ring.color.g*fade;this.ringColors[c+2]=ring.color.b*fade;}ringWrite++;
      }
    }
    this.ringGeometry.setDrawRange(0,ringWrite*2);this.ringGeometry.attributes.position.needsUpdate=true;this.ringGeometry.attributes.color.needsUpdate=true;this.ringLines.visible=ringWrite>0;

    const speed=Math.max(0,speedRatio-1.05),count=activeState&&!this.reducedMotion?Math.min(this.maxStreaks,Math.round(speed*9+flowPower*3)):0;
    this.streakMaterial.opacity=this.reducedMotion?0:Math.min(.2,speed*.052+flowPower*.028);
    for(let i=0;i<count;i++){
      const phase=(time*(1.8+speedRatio*.7)+i*.618)%1,x=viewW*.6-phase*viewW*1.4,y=groundY+viewH*(.26+.68*((i*.371)%1)),len=.34+speed*.26+flowPower*.08;
      const o=i*6;this.streakPositions[o]=x;this.streakPositions[o+1]=y;this.streakPositions[o+2]=2.7;
      this.streakPositions[o+3]=x-len;this.streakPositions[o+4]=y+.02;this.streakPositions[o+5]=2.7;
    }
    this.streakGeometry.setDrawRange(0,count*2);this.streakGeometry.attributes.position.needsUpdate=true;this.streaks.visible=count>0&&this.streakMaterial.opacity>.001;
  }
  stats(){return{reducedMotion:this.reducedMotion,activeParticles:this.active.length,pooledParticles:this.pool.length,activeRings:this.rings.length,maxParticles:this.maxParticles,maxStreaks:this.maxStreaks,streaksVisible:this.streaks.visible};}
  dispose(){
    this.scene.remove(this.points,this.ringLines,this.streaks);this.geometry.dispose();this.material.dispose();this.ringGeometry.dispose();this.ringMaterial.dispose();this.streakGeometry.dispose();this.streakMaterial.dispose();
  }
}
