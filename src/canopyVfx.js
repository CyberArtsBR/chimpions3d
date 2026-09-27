import * as THREE from 'three';

const MAX_PARTICLES=96;
const hiddenY=-10000;
const colors={
  coin:new THREE.Color(0xffdf79),
  landing:new THREE.Color(0xcfe89d),
  splinter:new THREE.Color(0xb98252),
  hazard:new THREE.Color(0xff765f),
  jet:new THREE.Color(0x78efff),
  milestone:new THREE.Color(0xffe47a),
  vanish:new THREE.Color(0xb792ff)
};

export function createCanopyVfx(scene){
  const positions=new Float32Array(MAX_PARTICLES*3);
  const vertexColors=new Float32Array(MAX_PARTICLES*3);
  for(let i=0;i<MAX_PARTICLES;i++)positions[i*3+1]=hiddenY;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));
  const material=new THREE.PointsMaterial({
    size:.075,transparent:true,opacity:.9,depthWrite:false,vertexColors:true,
    sizeAttenuation:true
  });
  const points=new THREE.Points(geometry,material);
  points.frustumCulled=false;points.visible=false;scene.add(points);

  const pool=Array.from({length:MAX_PARTICLES},()=>({active:false,x:0,y:0,z:.62,vx:0,vy:0,life:0,maxLife:1}));
  let cursor=0,budget=MAX_PARTICLES;

  function emit(x,y,color,count,{spread=2.4,up=.9,life=.62,z=.62}={}){
    if(document.body?.dataset?.reducedMotion==='true')count=Math.ceil(count*.35);
    for(let n=0;n<Math.min(count,budget);n++){
      const item=pool[cursor++%budget],angle=(n*2.3999632297)+(cursor*.17),speed=.35+(n%5)*.17;
      item.active=true;item.x=x;item.y=y;item.z=z;
      item.vx=Math.cos(angle)*speed*spread;item.vy=up+Math.sin(angle)*.28+(n%4)*.16;
      item.life=0;item.maxLife=life+(n%3)*.08;
      item.color=color;
    }
  }

  function burst(event={}){
    const x=Number(event.x)||0,y=(Number(event.y)||0)+.12;
    const key=event.type==='coin'?'coin':
      event.type==='hazard'?'hazard':
      event.type==='jet'?'jet':
      event.type==='milestone'?'milestone':
      event.platformType==='vanish'?'vanish':
      event.platformType==='cracked'||event.fragile?'splinter':'landing';
    const count=key==='milestone'?18:key==='jet'?10:key==='coin'?10:key==='splinter'?12:8;
    emit(x,y,colors[key],count,{spread:key==='hazard'?3.2:2.2,up:event.spring?1.9:.85,life:key==='jet'?.42:.66});
  }

  function jetTrail(x,y){
    emit(Number(x)||0,(Number(y)||0)-.16,colors.jet,2,{spread:.75,up:-.15,life:.38,z:.58});
  }

  function update(dt){
    let any=false,write=0;
    const step=Math.min(.05,Math.max(0,Number(dt)||0));
    for(const item of pool){
      if(item.active){
        item.life+=step;
        if(item.life>=item.maxLife)item.active=false;
        else{
          item.x+=item.vx*step;item.y+=item.vy*step;item.vy-=2.8*step;
          const fade=1-item.life/item.maxLife;
          positions[write*3]=item.x;positions[write*3+1]=item.y;positions[write*3+2]=item.z;
          vertexColors[write*3]=item.color.r*fade;vertexColors[write*3+1]=item.color.g*fade;vertexColors[write*3+2]=item.color.b*fade;
          write++;any=true;
        }
      }
    }
    for(let i=write;i<MAX_PARTICLES;i++){positions[i*3]=0;positions[i*3+1]=hiddenY;positions[i*3+2]=0;}
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
    points.visible=any;
  }

  return {
    burst,jetTrail,update,
    setQuality(profile={}){
      const name=typeof profile==='string'?profile:profile.profile;
      budget=name==='low'?40:name==='balanced'?64:name==='high'?80:MAX_PARTICLES;
      material.size=name==='ultra'?.082:.075;
    },
    reset(){for(const item of pool)item.active=false;points.visible=false;},
    dispose(){scene.remove(points);geometry.dispose();material.dispose();}
  };
}
