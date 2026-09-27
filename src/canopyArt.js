import * as THREE from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const paletteTint=new THREE.Color();
const forestTint=new THREE.Color(0x27483b);

function makeLayerTexture(seed,near=false){
  const canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  let state=seed>>>0;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);

  const haze=ctx.createLinearGradient(0,0,0,1024);
  haze.addColorStop(0,'rgba(197,226,207,.20)');
  haze.addColorStop(.52,'rgba(104,151,126,.07)');
  haze.addColorStop(1,'rgba(24,58,47,.18)');
  ctx.fillStyle=haze;ctx.fillRect(0,0,1024,1024);

  // Keep the middle quiet so the player and landing choices stay readable.
  for(const side of [-1,1]){
    const edge=side<0?0:1024;
    for(let cluster=0;cluster<(near?40:30);cluster++){
      const x=edge+side*(55+random()*285);
      const y=random()*1024;
      const base=(near?50:38)+random()*(near?95:72);
      ctx.globalAlpha=(near?.36:.23)+random()*.14;
      ctx.fillStyle=cluster%3===0?'#325f48':cluster%3===1?'#477559':'#234d3c';
      for(let leaf=0;leaf<7;leaf++){
        const angle=random()*Math.PI*2,distance=random()*base*.72;
        const rx=base*(.28+random()*.42),ry=rx*(.27+random()*.28);
        ctx.beginPath();
        ctx.ellipse(x+Math.cos(angle)*distance,y+Math.sin(angle)*distance,rx,ry,random()*Math.PI,0,Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Distant cliff/waterfall cues live outside the gameplay corridor.
  ctx.globalAlpha=near?.08:.13;
  for(const side of [-1,1]){
    const x=512+side*(300+random()*65);
    const cliff=ctx.createLinearGradient(x-side*85,0,x+side*85,0);
    cliff.addColorStop(0,'rgba(30,65,53,0)');
    cliff.addColorStop(.5,'rgba(43,75,63,.7)');
    cliff.addColorStop(1,'rgba(25,48,43,0)');
    ctx.fillStyle=cliff;ctx.fillRect(x-95,0,190,1024);
    ctx.fillStyle='rgba(179,224,211,.48)';
    ctx.fillRect(x-side*18,80+random()*190,5+random()*5,540+random()*180);
  }
  ctx.globalAlpha=1;

  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  return texture;
}

export function createCanopyArt(scene){
  const group=new THREE.Group();
  group.name='canopy-art-layers';
  group.renderOrder=-40;
  scene.add(group);

  const specs=[
    {seed:1307,z:-31,width:42,height:31,opacity:.25,near:false},
    {seed:2719,z:-27,width:36,height:29,opacity:.29,near:false},
    {seed:4201,z:-23,width:31,height:27,opacity:.32,near:true}
  ];
  const layers=specs.map((spec,index)=>{
    const map=makeLayerTexture(spec.seed,spec.near);
    const material=new THREE.MeshBasicMaterial({
      map,transparent:true,depthWrite:false,depthTest:true,fog:false,
      opacity:spec.opacity,toneMapped:false,color:0xffffff
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(spec.width,spec.height),material);
    mesh.position.z=spec.z;mesh.renderOrder=-40+index;
    group.add(mesh);
    return {mesh,map,baseOpacity:spec.opacity,index};
  });

  let quality='high',visible=true,lastCameraY=0;

  function setQuality(profile={}){
    quality=typeof profile==='string'?profile:(profile.profile||'high');
    const anisotropy=Math.max(1,Math.round(profile.maxAnisotropy||2));
    for(const layer of layers){
      layer.map.anisotropy=anisotropy;
      layer.map.needsUpdate=true;
    }
  }

  function update(cameraY,time,palette,night=0,enabled=true){
    lastCameraY=Number(cameraY)||0;
    group.visible=visible&&enabled;
    if(!group.visible)return;
    paletteTint.copy(palette||forestTint).lerp(forestTint,.55+clamp(night,0,1)*.12);
    const reduced=document.body?.dataset?.reducedMotion==='true';
    const motion=reduced?.2:1;
    const qualityBoost=quality==='ultra'?1.06:quality==='low'?.88:1;
    for(const layer of layers){
      const depth=layer.index+1;
      layer.mesh.position.y=lastCameraY+1.4-Math.sin(lastCameraY*(.007+depth*.0015))*depth*.72;
      layer.mesh.position.x=Math.sin(time*(.024+depth*.007)+depth*1.8)*depth*.24*motion;
      layer.mesh.material.color.copy(paletteTint);
      layer.mesh.material.opacity=layer.baseOpacity*qualityBoost*(1-clamp(night,0,1)*.08);
    }
  }

  return {
    update,
    setQuality,
    setVisible(value){visible=!!value;group.visible=visible;},
    reset(){lastCameraY=0;},
    dispose(){
      scene.remove(group);
      for(const layer of layers){
        layer.mesh.geometry.dispose();
        layer.mesh.material.dispose();
        layer.map.dispose();
      }
    }
  };
}
