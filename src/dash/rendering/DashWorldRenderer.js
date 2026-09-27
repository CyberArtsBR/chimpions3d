import * as THREE from 'three';
import './dashWorld.css';
import {DASH_BIOMES,biomeForStage} from '../biomes/biomeProfiles.js';
import {DASH_QUALITY_PRESETS,getDashQualityPreset,resolveDashQuality} from './quality.js';
import {DashVFX} from '../vfx/DashVFX.js';
import {DashEnvironment} from './DashEnvironment.js';
import {createBiomePresentationState,blendBiomePresentation} from './DashBiomePresentation.js';

export {DASH_BIOMES,resolveDashQuality,DASH_QUALITY_PRESETS};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const wrap=(v,span)=>{const half=span/2;return((v+half)%span+span)%span-half;};
const TMP_COLOR_A=new THREE.Color(),TMP_COLOR_B=new THREE.Color();
const TMP_OUTPUT_TOP=new THREE.Color(),TMP_OUTPUT_BOTTOM=new THREE.Color(),TMP_OUTPUT_FOG=new THREE.Color();
const TMP_MATRIX=new THREE.Matrix4(),TMP_POS=new THREE.Vector3(),TMP_QUAT=new THREE.Quaternion(),TMP_SCALE=new THREE.Vector3();
const Z_AXIS=new THREE.Vector3(0,0,1);

function seeded(seed=1){let s=seed>>>0||1;return()=>{s=(Math.imul(s^s>>>15,1|s)+0x6d2b79f5)|0;return((s^s>>>14)>>>0)/4294967296;};}
function lerpColor(out,a,b,t){return out.copy(TMP_COLOR_A.setHex(a)).lerp(TMP_COLOR_B.setHex(b),t);}
function canvasTexture(size,paint){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');paint(ctx,size);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;return map;
}
function makeGroundTexture(){
  const r=seeded(7123),map=canvasTexture(256,(ctx,s)=>{
    ctx.fillStyle='#765a35';ctx.fillRect(0,0,s,s);
    for(let i=0;i<520;i++){
      const x=r()*s,y=r()*s,rad=.6+r()*2.7,light=r()>.6;
      ctx.fillStyle=light?'rgba(191,157,91,.20)':'rgba(35,39,24,.22)';ctx.beginPath();ctx.ellipse(x,y,rad,rad*(.35+r()*.7),r()*Math.PI,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle='rgba(51,45,25,.24)';ctx.lineWidth=2;
    for(let i=0;i<18;i++){const y=r()*s;ctx.beginPath();ctx.moveTo(-20,y);ctx.bezierCurveTo(s*.25,y+20-r()*40,s*.65,y-18+r()*36,s+20,y+r()*18);ctx.stroke();}
  });
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(6,1.4);return map;
}
function makeSoftTexture(){
  return canvasTexture(128,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,.82)');g.addColorStop(.42,'rgba(255,255,255,.34)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);});
}
function makeShadowTexture(){
  return canvasTexture(128,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,2,s/2,s/2,s/2);g.addColorStop(0,'rgba(0,12,8,.72)');g.addColorStop(.45,'rgba(0,12,8,.35)');g.addColorStop(1,'rgba(0,12,8,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);});
}
function makeLeafGeometry(){
  const shape=new THREE.Shape();shape.moveTo(0,.55);shape.quadraticCurveTo(.5,.18,0,-.58);shape.quadraticCurveTo(-.5,.18,0,.55);const g=new THREE.ShapeGeometry(shape,4);g.computeVertexNormals();return g;
}
function makeBananaGeometry(){
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.28,.12,0),new THREE.Vector3(0,-.18,0),new THREE.Vector3(.28,.13,0));
  return new THREE.TubeGeometry(curve,10,.075,6,false);
}
function applyMatrix(instanced,index,x,y,z,sx,sy,sz,rotation=0){
  TMP_POS.set(x,y,z);TMP_QUAT.setFromAxisAngle(Z_AXIS,rotation);TMP_SCALE.set(sx,sy,sz);TMP_MATRIX.compose(TMP_POS,TMP_QUAT,TMP_SCALE);instanced.setMatrixAt(index,TMP_MATRIX);
}

export function createDashWorldRenderer(options){return new DashWorldRenderer(options);}

class DashWorldRenderer{
  constructor({scene,camera,renderer,hemisphere,keyLight,rimLight,pixelsToWorld=1/40}){
    this.scene=scene;this.camera=camera;this.renderer=renderer;this.hemisphere=hemisphere;this.keyLight=keyLight;this.rimLight=rimLight;this.unit=pixelsToWorld;
    this.viewW=20;this.viewH=12;this.groundY=-4;this.scroll=0;this.stage=1;this.time=0;this.environmentRoot=new THREE.Group();this.environmentRoot.name='dash-gpu-environment';scene.add(this.environmentRoot);
    this.gameplayRoot=new THREE.Group();this.gameplayRoot.name='dash-gpu-gameplay';scene.add(this.gameplayRoot);
    this.random=seeded(0x43a991);this.profile=DASH_BIOMES[0];this.biomePresentation=createBiomePresentationState();this.qualityName='BALANCED';this.quality=getDashQualityPreset(this.qualityName);
    this.hazardMap=new Map();this.hazardPools=new Map();this.hazardMaterials=[];this.disposables=[];this.liveHazards=new Set();
    this.biomeBlend={from:this.profile,to:this.profile,t:1};this.biomeFeatures={canopyDensity:1,foreground:1,waterfall:0,ruins:0,moon:0,storm:0,pollen:1,accent:0xffffff};
    this.safeMode=false;this.contextLost=false;this.lastRenderError='';this.lastQualityState={tier:this.qualityName,shadowEnabled:this.quality.shadows};this.fallbackBackground=new THREE.Color(0x173b31);
    this.visibility={highVisibility:false,rimStrength:1,hazardContrast:1,collectibleVisibility:1};this.highVisibility=false;this.reducedMotion=false;this.screenShake=true;this.shakeAmount=0;
    this.buildMaterials();this.buildEnvironment();this.environmentArt=new DashEnvironment({root:this.environmentRoot,materials:this.mat,quality:this.quality,register:value=>this.disposables.push(value)});this.buildGameplay();this.vfx=new DashVFX(scene,this.quality);this.setVisibility({});
    this.applyQualityState(this.lastQualityState);this.installEvents();document.documentElement.classList.add('dash-gpu-world');
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  }
  buildMaterials(){
    const std=(params={})=>{const m=new THREE.MeshStandardMaterial(params);this.disposables.push(m);return m;};
    const basic=(params={})=>{const m=new THREE.MeshBasicMaterial(params);this.disposables.push(m);return m;};
    this.mat={
      ground:std({color:0x6c5736,roughness:.96,metalness:0,map:makeGroundTexture()}),
      moss:std({color:0x4f7938,roughness:.95}),bark:std({color:0x60462d,roughness:.92}),barkDark:std({color:0x34291f,roughness:1}),
      thorn:std({color:0x355e32,roughness:.9}),stone:std({color:0x687160,roughness:.93}),wet:std({color:0x315d58,roughness:.28,metalness:.05}),
      mushroom:std({color:0xc75d48,roughness:.72}),cream:std({color:0xd7caa1,roughness:.88}),goldStone:std({color:0x9a7b42,roughness:.82}),
      barkHero:std({color:0x5d432b,roughness:.9,metalness:0}),foliageHero:std({color:0x2b6843,roughness:.88,metalness:0}),
      stoneDry:std({color:0x6f735f,roughness:.98,metalness:0}),stoneWet:std({color:0x355f5a,roughness:.26,metalness:0}),
      ruinGold:std({color:0xae8a4b,roughness:.68,metalness:.06}),vine:std({color:0x356d43,roughness:.92,metalness:0}),
      floraGlow:std({color:0x9fe0b1,roughness:.58,metalness:0,emissive:0x17392f,emissiveIntensity:.2}),
      hazardWood:std({color:0x6f4b2e,roughness:.84,emissive:0x241308,emissiveIntensity:.04}),
      hazardWoodDark:std({color:0x3f2b1f,roughness:.95,emissive:0x160b05,emissiveIntensity:.03}),
      hazardPlant:std({color:0x3d7138,roughness:.84,emissive:0x102608,emissiveIntensity:.035}),
      hazardCap:std({color:0xd9684e,roughness:.64,emissive:0x46150e,emissiveIntensity:.08}),
      hazardWet:std({color:0x2e716d,roughness:.2,metalness:.06,emissive:0x0d3432,emissiveIntensity:.08}),
      hazardRim:std({color:0xe1cf8f,roughness:.7,emissive:0x806622,emissiveIntensity:.18}),
      hazardSlide:std({color:0xaed9ad,roughness:.68,emissive:0x2e6a45,emissiveIntensity:.22}),
      hazardRisk:std({color:0xc8ad55,roughness:.63,emissive:0x6e5514,emissiveIntensity:.24}),
      banana:std({color:0xffdf4b,roughness:.3,metalness:.04,emissive:0x6b4300,emissiveIntensity:.42}),
      golden:std({color:0xffdf66,roughness:.18,metalness:.56,emissive:0xb96f00,emissiveIntensity:1.05}),
      far:std({color:0x1e5139,roughness:1}),mid:std({color:0x2e6544,roughness:1}),trunk:std({color:0x3f3929,roughness:1}),foreground:std({color:0x214b32,roughness:.95}),
      waterfall:basic({color:0xb4f5f3,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}),
      shaft:basic({color:0xfff1ba,transparent:true,opacity:.08,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),
      moon:basic({color:0xdce6ff,transparent:true,opacity:.9,depthWrite:false}),
      glow:basic({map:makeSoftTexture(),color:0xffe890,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}),
      shadow:basic({map:makeShadowTexture(),transparent:true,opacity:.7,depthWrite:false,color:0x0b1a13}),
      hazardOutline:basic({color:0xfff2a8,wireframe:true,transparent:true,opacity:.86,depthTest:false,depthWrite:false})
    };
    this.mat.bananaGlow=this.mat.glow.clone();this.mat.bananaGlow.color.setHex(0xffd84a);this.mat.bananaGlow.opacity=.13;
    this.mat.goldenGlow=this.mat.glow.clone();this.mat.goldenGlow.color.setHex(0xffdf6a);this.mat.goldenGlow.opacity=.38;
    this.mat.goldenGlint=this.mat.glow.clone();this.mat.goldenGlint.color.setHex(0xffffff);this.mat.goldenGlint.opacity=.62;
    this.mat.hazardCue=this.mat.glow.clone();this.mat.hazardCue.color.setHex(0xffe27b);this.mat.hazardCue.opacity=.28;
    this.disposables.push(this.mat.bananaGlow,this.mat.goldenGlow,this.mat.goldenGlint,this.mat.hazardCue);
    this.hazardMaterials=[this.mat.hazardWood,this.mat.hazardWoodDark,this.mat.hazardPlant,this.mat.hazardCap,this.mat.hazardWet,this.mat.hazardRim,this.mat.hazardSlide,this.mat.hazardRisk];
    this.disposables.push(this.mat.ground.map,this.mat.glow.map,this.mat.shadow.map);
  }
  buildEnvironment(){
    this.skyMaterial=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,toneMapped:false,uniforms:{top:{value:new THREE.Color(0x75d5ad)},bottom:{value:new THREE.Color(0x174b3c)},sun:{value:new THREE.Color(0xffe5a4)},sunStrength:{value:.28}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform float sunStrength;void main(){float h=smoothstep(0.0,1.0,vUv.y);vec3 c=mix(bottom,top,h);float d=distance(vUv,vec2(.76,.82));c+=sun*pow(max(0.0,1.0-d*3.2),3.0)*sunStrength;gl_FragColor=vec4(c,1.0);}'});this.disposables.push(this.skyMaterial);
    this.sky=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.skyMaterial);this.sky.position.z=-19;this.sky.frustumCulled=false;this.sky.renderOrder=-30;this.environmentRoot.add(this.sky);this.disposables.push(this.sky.geometry);

    const max={far:64,mid:48,detail:64,foreground:28,ruins:18};
    this.farCanopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),this.mat.far,max.far);this.farCanopy.position.z=-12;this.environmentRoot.add(this.farCanopy);this.disposables.push(this.farCanopy.geometry);
    this.cliffs=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1.8,7),this.mat.stone,18);this.cliffs.position.z=-15;this.environmentRoot.add(this.cliffs);this.disposables.push(this.cliffs.geometry);
    this.midTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.33,.58,1,7),this.mat.trunk,max.mid);this.midTrunks.position.z=-6.2;this.environmentRoot.add(this.midTrunks);this.disposables.push(this.midTrunks.geometry);
    this.midCanopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),this.mat.mid,max.mid);this.midCanopy.position.z=-6;this.environmentRoot.add(this.midCanopy);this.disposables.push(this.midCanopy.geometry);
    this.groundStones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5,1),this.mat.stone,max.detail);this.groundStones.position.z=-.45;this.environmentRoot.add(this.groundStones);this.disposables.push(this.groundStones.geometry);
    this.grass=new THREE.InstancedMesh(makeLeafGeometry(),this.mat.moss,max.detail);this.grass.position.z=-.18;this.environmentRoot.add(this.grass);this.disposables.push(this.grass.geometry);
    this.foregroundLeaves=new THREE.InstancedMesh(makeLeafGeometry(),this.mat.foreground,max.foreground);this.foregroundLeaves.position.z=2.6;this.foregroundLeaves.renderOrder=16;this.environmentRoot.add(this.foregroundLeaves);this.disposables.push(this.foregroundLeaves.geometry);
    this.ruins=new THREE.InstancedMesh(new THREE.BoxGeometry(.6,2.4,.55),this.mat.goldStone,max.ruins);this.ruins.position.z=-5.2;this.environmentRoot.add(this.ruins);this.disposables.push(this.ruins.geometry);
    for(const mesh of[this.farCanopy,this.cliffs,this.midTrunks,this.midCanopy,this.groundStones,this.grass,this.foregroundLeaves,this.ruins]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;}

    this.envSeeds={};
    for(const [key,count] of Object.entries(max))this.envSeeds[key]=Array.from({length:count},(_,i)=>({x:(i/(count-1||1)-.5)+((this.random()-.5)/count)*2,y:this.random(),s:.72+this.random()*.72,r:(this.random()-.5)*.45}));
    this.envSeeds.cliffs=Array.from({length:18},(_,i)=>({x:i/17-.5,y:this.random(),s:.75+this.random()*.8,r:(this.random()-.5)*.18}));

    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mat.ground);this.ground.position.z=-.55;this.ground.receiveShadow=true;this.environmentRoot.add(this.ground);this.disposables.push(this.ground.geometry);
    this.groundLip=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mat.moss);this.groundLip.position.z=-.3;this.groundLip.receiveShadow=true;this.environmentRoot.add(this.groundLip);this.disposables.push(this.groundLip.geometry);

    this.waterfalls=Array.from({length:4},(_,i)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mat.waterfall);mesh.position.z=-8+i*.08;mesh.visible=false;this.environmentRoot.add(mesh);this.disposables.push(mesh.geometry);return mesh;});
    this.shafts=Array.from({length:5},(_,i)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mat.shaft);mesh.position.z=-3.4-i*.05;mesh.rotation.z=-.28;mesh.visible=false;this.environmentRoot.add(mesh);this.disposables.push(mesh.geometry);return mesh;});
    this.moon=new THREE.Mesh(new THREE.CircleGeometry(1,32),this.mat.moon);this.moon.position.z=-14;this.moon.visible=false;this.environmentRoot.add(this.moon);this.disposables.push(this.moon.geometry);
    this.mistMaterial=this.mat.glow.clone();this.mistMaterial.color.set(0xc8efe1);this.mistMaterial.opacity=.12;this.disposables.push(this.mistMaterial);
    this.mist=Array.from({length:3},(_,i)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mistMaterial);mesh.position.z=-2.8-i*.25;mesh.renderOrder=-2;this.environmentRoot.add(mesh);this.disposables.push(mesh.geometry);return mesh;});
  }
  buildGameplay(){
    this.bananaGeometry=makeBananaGeometry();this.collectibleGlowGeometry=new THREE.PlaneGeometry(1,1);this.disposables.push(this.bananaGeometry,this.collectibleGlowGeometry);
    this.bananaMesh=new THREE.InstancedMesh(this.bananaGeometry,this.mat.banana,96);this.goldenMesh=new THREE.InstancedMesh(this.bananaGeometry,this.mat.golden,24);
    this.bananaGlow=new THREE.InstancedMesh(this.collectibleGlowGeometry,this.mat.bananaGlow,96);this.goldenGlow=new THREE.InstancedMesh(this.collectibleGlowGeometry,this.mat.goldenGlow,24);this.goldenGlint=new THREE.InstancedMesh(this.collectibleGlowGeometry,this.mat.goldenGlint,24);
    for(const mesh of[this.bananaMesh,this.goldenMesh,this.bananaGlow,this.goldenGlow,this.goldenGlint]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;this.gameplayRoot.add(mesh);}this.bananaMesh.castShadow=false;this.goldenMesh.castShadow=false;
    this.contactShadowMaterial=this.mat.shadow.clone();this.disposables.push(this.contactShadowMaterial);this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.contactShadowMaterial);this.contactShadow.position.z=-.04;this.contactShadow.renderOrder=2;this.gameplayRoot.add(this.contactShadow);this.disposables.push(this.contactShadow.geometry);
    this.unitGeo={
      cylinder:new THREE.CylinderGeometry(.5,.5,1,9),cone:new THREE.ConeGeometry(.5,1,7),sphere:new THREE.IcosahedronGeometry(.5,1),box:new THREE.BoxGeometry(1,1,.5),leaf:makeLeafGeometry(),circle:new THREE.CircleGeometry(.5,24)
    };Object.values(this.unitGeo).forEach(g=>this.disposables.push(g));
  }
  installEvents(){
    this.eventListener=e=>this.consumeGameplayEvent(e.detail||{});globalThis.addEventListener?.('chimpions-dash-event',this.eventListener);
    const api={
      get quality(){return this._owner.qualityName;},
      setQuality:name=>{
        const controller=globalThis.chimpionsDashPerformance;
        if(!controller?.setQuality)throw new Error('Dash quality controller is not ready.');
        return controller.setQuality(name);
      },
      setVisibility:options=>this.setVisibility(options),
      setAccessibility:options=>this.setAccessibility(options),
      setHazardState:(obstacle,state)=>this.setHazardPresentationState(obstacle,state),
      stats:()=>this.stats(),_owner:this
    };globalThis.chimpionsDashGraphics=api;
  }
  setVisibility(options={}){
    this.visibility={...this.visibility,...options};const high=!!this.visibility.highVisibility,contrast=clamp(Number(this.visibility.hazardContrast)||1,.7,2),rim=clamp(Number(this.visibility.rimStrength)||1,0,2.5),collect=clamp(Number(this.visibility.collectibleVisibility)||1,.65,2);
    this.mat.hazardWood.color.setHex(high?0x825736:0x6f4b2e);this.mat.hazardWood.emissiveIntensity=.04*contrast;
    this.mat.hazardWoodDark.color.setHex(high?0x4b3121:0x3f2b1f);this.mat.hazardWoodDark.emissiveIntensity=.03*contrast;
    this.mat.hazardPlant.color.setHex(high?0x4a873f:0x3d7138);this.mat.hazardPlant.emissiveIntensity=.035*contrast;
    this.mat.hazardCap.color.setHex(high?0xeb7455:0xd9684e);this.mat.hazardCap.emissiveIntensity=.08*contrast;
    this.mat.hazardWet.color.setHex(high?0x388c86:0x2e716d);this.mat.hazardWet.emissiveIntensity=.08*contrast;
    this.mat.hazardRim.emissiveIntensity=.18*rim*(high?1.55:1);this.mat.hazardSlide.emissiveIntensity=.22*rim*(high?1.5:1);this.mat.hazardRisk.emissiveIntensity=.24*rim*(high?1.5:1);
    this.mat.banana.emissiveIntensity=.42*collect*(high?1.25:1);this.mat.golden.emissiveIntensity=1.05*collect*(high?1.18:1);
    this.mat.bananaGlow.opacity=.13*collect*(high?1.35:1);this.mat.goldenGlow.opacity=.38*collect*(high?1.2:1);this.mat.goldenGlint.opacity=.62*collect;
    const applyOutline=group=>{const outline=group?.getObjectByName?.('dash-high-visibility-outline');if(outline)outline.visible=high;};
    for(const entry of this.hazardMap.values())applyOutline(entry.group);
    for(const pool of this.hazardPools.values())for(const group of pool)applyOutline(group);
    return{...this.visibility};
  }
  setAccessibility({highVisibility=this.highVisibility,reducedMotion=this.reducedMotion,screenShake=this.screenShake}={}){
    this.highVisibility=!!highVisibility;this.reducedMotion=!!reducedMotion;this.screenShake=!!screenShake;
    this.setVisibility({highVisibility:this.highVisibility,rimStrength:this.highVisibility?1.55:1,hazardContrast:this.highVisibility?1.35:1,collectibleVisibility:this.highVisibility?1.28:1});
    this.vfx?.setReducedMotion(this.reducedMotion);
    if(!this.screenShake||this.reducedMotion){this.shakeAmount=0;this.camera.position.x=0;this.camera.position.y=0;}
    return{highVisibility:this.highVisibility,reducedMotion:this.reducedMotion,screenShake:this.screenShake};
  }
  applyQualityState(state={}){
    const name=String(state.tier||'BALANCED').toUpperCase();
    if(!DASH_QUALITY_PRESETS[name])throw new Error('Dash quality must resolve to LOW, BALANCED, HIGH, or ULTRA.');
    const base=getDashQualityPreset(name),vegetation=clamp(Number(state.vegetationDensity??1),.25,1),particles=clamp(Number(state.particleDensity??1),.2,1),foreground=clamp(Number(state.foregroundDensity??1),0,1),shafts=clamp(Number(state.lightShaftDensity??1),0,1);
    const reducedMotion=!!state.accessibility?.reducedMotion;
    this.qualityName=name;
    this.quality={
      ...base,
      shadows:state.shadowEnabled==null?base.shadows:!!state.shadowEnabled,
      farCount:Math.max(8,Math.round(base.farCount*vegetation)),
      midCount:Math.max(6,Math.round(base.midCount*vegetation)),
      detailCount:Math.max(8,Math.round(base.detailCount*vegetation)),
      heroCount:Math.max(3,Math.round((base.heroCount||8)*vegetation)),
      structureCount:Math.max(2,Math.round((base.structureCount||5)*vegetation)),
      sceneryDetail:Math.max(3,Math.round((base.sceneryDetail||8)*vegetation)),
      foregroundCount:Math.max(0,Math.round(base.foregroundCount*foreground)),
      particleCount:Math.max(12,Math.round(base.particleCount*particles)),
      streakCount:reducedMotion?0:Math.max(0,Math.round(base.streakCount*particles)),
      lightShafts:Math.max(0,Math.round(base.lightShafts*shafts)),
      mistCount:reducedMotion?0:Math.max(0,Math.round(base.mistCount*foreground))
    };
    this.lastQualityState={...state,tier:name};
    this.vfx?.setQuality(this.quality);this.vfx?.setReducedMotion(reducedMotion);this.environmentArt?.setQuality(this.quality);
    for(const entry of this.hazardMap.values())entry.group.traverse(o=>{if(o.isMesh)o.castShadow=this.quality.shadows;});
    return this.quality;
  }
  resize({viewW=this.viewW,viewH=this.viewH,groundY=this.groundY}={}){
    this.viewW=viewW;this.viewH=viewH;this.groundY=groundY;
    this.sky.scale.set(viewW*1.18,viewH*1.16,1);this.sky.position.y=0;
    const depth=Math.max(2.3,viewH*.22);this.ground.scale.set(viewW*1.15,depth,1);this.ground.position.set(0,groundY-depth*.5,-.55);
    this.groundLip.scale.set(viewW*1.15,.22,1);this.groundLip.position.set(0,groundY-.06,-.3);
    this.moon.position.set(viewW*.32,viewH*.27,-14);this.moon.scale.setScalar(Math.max(.65,viewH*.075));
    this.environmentArt?.resize({viewW,viewH,groundY});
    this.keyLight.shadow.camera.left=-viewW*.56;this.keyLight.shadow.camera.right=viewW*.56;this.keyLight.shadow.camera.top=viewH*.55;this.keyLight.shadow.camera.bottom=-viewH*.55;this.keyLight.shadow.camera.updateProjectionMatrix();
  }
  interpolateBiome(stage,time){
    const out=this.biomeBlend,current=biomeForStage(stage).profile;
    if(stage<=1||this.reducedMotion){out.from=current;out.to=current;out.t=1;return out;}
    const previous=biomeForStage(stage-1).profile,within=((time%30)+30)%30;
    out.from=previous;out.to=current;out.t=smooth(clamp(within/3.2,0,1));return out;
  }
  applyBiome(stage,time){
    const {from,to,t}=this.interpolateBiome(stage,time);this.profile=to;
    const top=lerpColor(TMP_COLOR_C,from.skyTop,to.skyTop,t),bottom=lerpColor(TMP_COLOR_D,from.skyBottom,to.skyBottom,t),fog=lerpColor(TMP_COLOR_E,from.fog,to.fog,t);
    this.skyMaterial.uniforms.top.value.copy(top);this.skyMaterial.uniforms.bottom.value.copy(bottom);lerpColor(this.skyMaterial.uniforms.sun.value,from.sun,to.sun,t);this.skyMaterial.uniforms.sunStrength.value=.12+.2*(1-(from.storm+(to.storm-from.storm)*t));
    this.scene.fog??=new THREE.FogExp2(fog,.02);this.scene.fog.color.copy(fog);this.scene.fog.density=(from.fogDensity+(to.fogDensity-from.fogDensity)*t)*(this.highVisibility?.72:1);
    lerpColor(this.mat.ground.color,from.dirt,to.dirt,t);lerpColor(this.mat.moss.color,from.ground,to.ground,t);lerpColor(this.mat.far.color,from.canopy,to.canopy,t);lerpColor(this.mat.mid.color,from.mid,to.mid,t);lerpColor(this.mat.foreground.color,from.canopy,to.canopy,t);lerpColor(this.mat.goldStone.color,0x74725a,to.accent,t*.35);
    lerpColor(this.mat.barkHero.color,from.bark,to.bark,t);lerpColor(this.mat.foliageHero.color,from.mid,to.mid,t);lerpColor(this.mat.stoneDry.color,from.stone,to.stone,t);lerpColor(this.mat.stoneWet.color,from.wetStone,to.wetStone,t);lerpColor(this.mat.ruinGold.color,from.stone,to.accent,t*.72);lerpColor(this.mat.vine.color,from.ground,to.mid,t);lerpColor(this.mat.floraGlow.color,from.flora,to.flora,t);
    this.mat.floraGlow.emissive.copy(this.mat.floraGlow.color).multiplyScalar(.22);
    lerpColor(this.hemisphere.color,from.ambient,to.ambient,t);this.hemisphere.groundColor.copy(bottom).multiplyScalar(.55);this.hemisphere.intensity=1.65+(1-(from.storm+(to.storm-from.storm)*t))*.55;
    lerpColor(this.keyLight.color,from.sun,to.sun,t);this.keyLight.intensity=2.3+(1-(from.storm+(to.storm-from.storm)*t))*.85;lerpColor(this.rimLight.color,from.rim,to.rim,t);this.rimLight.intensity=1.05+(to.moon*.35);
    this.renderer.toneMappingExposure=from.exposure+(to.exposure-from.exposure)*t+(this.highVisibility?.06:0);
    const features=blendBiomePresentation(this.biomePresentation,from,to,t);
    features.canopyDensity=from.canopyDensity+(to.canopyDensity-from.canopyDensity)*t;features.foreground=from.foreground+(to.foreground-from.foreground)*t;
    features.waterfall=from.waterfall+(to.waterfall-from.waterfall)*t;features.ruins=from.ruins+(to.ruins-from.ruins)*t;features.moon=from.moon+(to.moon-from.moon)*t;
    features.storm=from.storm+(to.storm-from.storm)*t;features.pollen=from.pollen+(to.pollen-from.pollen)*t;features.accent=to.accent;
    return features;
  }
  updateEnvironment(scroll,time,speedRatio,features){
    const span=this.viewW*1.45,scrollWorld=scroll*this.unit;
    const farCount=Math.min(this.farCanopy.instanceMatrix.count,Math.round(this.quality.farCount*features.canopyDensity));this.farCanopy.count=farCount;
    for(let i=0;i<farCount;i++){const d=this.envSeeds.far[i],x=wrap(d.x*span-scrollWorld*.045,span),y=this.groundY+2.7+d.y*this.viewH*.36,s=1.25+d.s*1.8;applyMatrix(this.farCanopy,i,x,y,0,s*1.45,s*.9,1,d.r);}
    this.farCanopy.instanceMatrix.needsUpdate=true;
    const cliffCount=Math.min(10,Math.max(3,Math.round(this.quality.farCount*.16)));this.cliffs.count=cliffCount;
    for(let i=0;i<cliffCount;i++){const d=this.envSeeds.cliffs[i],x=wrap(d.x*span-scrollWorld*.022,span),y=this.groundY+1.15+d.y*1.1,s=2.1+d.s*2.5;applyMatrix(this.cliffs,i,x,y,0,s*1.05,s*1.6,1,d.r);}
    this.cliffs.instanceMatrix.needsUpdate=true;

    const midCount=Math.min(this.midTrunks.instanceMatrix.count,Math.round(this.quality.midCount*features.canopyDensity));this.midTrunks.count=this.midCanopy.count=midCount;
    for(let i=0;i<midCount;i++){const d=this.envSeeds.mid[i],x=wrap(d.x*span-scrollWorld*.12,span),h=2.4+d.s*3.3,y=this.groundY+h*.45;applyMatrix(this.midTrunks,i,x,y,0,.5+d.s*.35,h,1,d.r*.22);applyMatrix(this.midCanopy,i,x+(d.r*.4),this.groundY+h*.92,0,1.05+d.s*.9,.75+d.s*.6,1,d.r);}
    this.midTrunks.instanceMatrix.needsUpdate=true;this.midCanopy.instanceMatrix.needsUpdate=true;

    const detailCount=Math.min(this.groundStones.instanceMatrix.count,this.quality.detailCount);this.groundStones.count=this.grass.count=detailCount;
    for(let i=0;i<detailCount;i++){const d=this.envSeeds.detail[i],x=wrap(d.x*span-scrollWorld,span),stoneS=.12+d.s*.2;applyMatrix(this.groundStones,i,x,this.groundY-.05-d.y*.17,0,stoneS*(1.2+d.y),stoneS*.5,stoneS,d.r);applyMatrix(this.grass,i,x+.12,this.groundY+.03,0,.12+d.s*.1,.18+d.s*.18,1,d.r*.7);}
    this.groundStones.instanceMatrix.needsUpdate=true;this.grass.instanceMatrix.needsUpdate=true;

    const foregroundSpeedFade=clamp(1-(speedRatio-1)*.18,.55,1),fgCount=(this.reducedMotion||this.highVisibility)?0:Math.min(this.foregroundLeaves.instanceMatrix.count,Math.round(this.quality.foregroundCount*features.foreground*foregroundSpeedFade));this.foregroundLeaves.count=fgCount;
    for(let i=0;i<fgCount;i++){const d=this.envSeeds.foreground[i],x=wrap(d.x*span-scrollWorld*(1.28+speedRatio*.05),span),top=i%3!==0,y=top?this.groundY+3.8+d.y*this.viewH*.43:this.groundY-.12-d.y*.5,s=.42+d.s*.48;applyMatrix(this.foregroundLeaves,i,x,y,0,s,s*1.65,1,d.r+Math.sin(time*1.7+i)*.08);}
    this.foregroundLeaves.instanceMatrix.needsUpdate=true;

    const ruinCount=Math.min(this.ruins.instanceMatrix.count,Math.round(this.quality.midCount*.12*features.ruins));this.ruins.count=ruinCount;
    for(let i=0;i<ruinCount;i++){const d=this.envSeeds.ruins[i],x=wrap(d.x*span-scrollWorld*.095,span),h=1.5+d.s*2.4;applyMatrix(this.ruins,i,x,this.groundY+h*.46,-.02,.6+d.s*.45,h,1,d.r*.12);}
    this.ruins.instanceMatrix.needsUpdate=true;

    this.mat.ground.map.offset.x=-(scrollWorld*.06)%1;this.mat.ground.map.offset.y=Math.sin(time*.03)*.025;
    const waterfallOpacity=.06+.22*features.waterfall;this.mat.waterfall.opacity=waterfallOpacity;
    this.waterfalls.forEach((mesh,i)=>{mesh.visible=features.waterfall>.08&&i<Math.ceil(features.waterfall*3);const x=((i-1.5)*this.viewW*.2)+(this.reducedMotion?0:Math.sin(time*.18+i)*.08);mesh.position.set(x,this.groundY+this.viewH*.36,-8+i*.08);mesh.scale.set(.35+.2*(i%2),this.viewH*.62,1);});
    const shaftCount=Math.min(this.shafts.length,this.quality.lightShafts);this.shafts.forEach((mesh,i)=>{mesh.visible=i<shaftCount&&features.storm<.75&&!this.reducedMotion;mesh.position.set((i-(shaftCount-1)/2)*this.viewW*.18+Math.sin(time*.08+i)*.18,this.groundY+this.viewH*.48,-3.4-i*.05);mesh.scale.set(.7+(.25*(i%2)),this.viewH*.7,1);mesh.material.opacity=.035+.04*(1-features.storm);});
    this.moon.visible=features.moon>.12;this.mat.moon.opacity=.4+.5*features.moon;if(!this.reducedMotion)this.moon.rotation.z=time*.008;
    this.mistMaterial.opacity=.045+.16*features.waterfall+.05*features.storm;this.mist.forEach((mesh,i)=>{mesh.visible=i<this.quality.mistCount;if(!mesh.visible)return;mesh.position.set(this.reducedMotion?(i-1)*this.viewW*.36:wrap((i-1)*this.viewW*.36-time*(.03+i*.012),this.viewW*1.4),this.groundY+.75+i*.52,-2.8-i*.25);mesh.scale.set(this.viewW*.58,1.4+i*.3,1);});
    this.environmentArt.update({scrollWorld,time:this.reducedMotion?0:time,speedRatio,features});
  }
  createMesh(geometry,material,parent,{x=0,y=0,z=0,sx=1,sy=1,sz=1,rz=0,cast=true}={}){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;m.castShadow=cast&&this.quality.shadows;m.receiveShadow=false;parent.add(m);return m;}
  buildHazard(type){
    const g=new THREE.Group(),u=this.unitGeo,boxes=type.boxes?.length?type.boxes:[[0,0,type.w,type.h]];
    const left=Math.min(...boxes.map(b=>b[0])),right=Math.max(...boxes.map(b=>b[0]+b[2]));
    const bottom=Math.min(...boxes.map(b=>b[1])),top=Math.max(...boxes.map(b=>b[1]+b[3]));
    const baseY=Number(type.visualY||0),solidW=Math.max(.24,(right-left)*this.unit),solidBottom=(bottom-baseY)*this.unit,solidTop=(top-baseY)*this.unit,solidH=Math.max(.18,solidTop-solidBottom);
    const nominalW=Math.max(.8,type.w*this.unit),xOffset=((left+right)*.5-type.w*.5)*this.unit;
    const wood=(x,y,width,height,angle=0,mat=this.mat.hazardWood)=>this.createMesh(u.cylinder,mat,g,{x,y,z:.08,sx:height,sy:width,sz:height,rz:Math.PI/2+angle});
    const leaf=(x,y,sx,sy,angle=0,mat=this.mat.hazardPlant)=>this.createMesh(u.leaf,mat,g,{x,y,z:.12,sx,sy,sz:1,rz:angle,cast:false});
    const trim=(x,y,width,mat=this.mat.hazardRim)=>this.createMesh(u.box,mat,g,{x,y,z:.18,sx:width,sy:.065,sz:.18,cast:false});
    switch(type.id){
      case'log':
        wood(xOffset,solidBottom+solidH*.43,solidW*.98,solidH*.74);
        this.createMesh(u.sphere,this.mat.hazardWoodDark,g,{x:xOffset-solidW*.31,y:solidBottom+solidH*.48,z:.14,sx:solidH*.28,sy:solidH*.2,sz:solidH*.28});
        trim(xOffset,solidTop-.04,solidW*.7);
        break;
      case'mushroom':{
        const xs=[-.29,0,.27];for(let i=0;i<xs.length;i++){const x=xOffset+xs[i]*solidW,stemH=solidH*(.46+.08*(i%2));this.createMesh(u.cylinder,this.mat.cream,g,{x,y:solidBottom+stemH*.5,z:.08,sx:.15,sy:stemH,sz:.15});this.createMesh(u.sphere,this.mat.hazardCap,g,{x,y:solidBottom+solidH*(.62+.08*(i%2)),z:.12,sx:solidW*.23,sy:solidH*.16,sz:solidW*.23});}break;
      }
      case'thorns':{
        const count=6;for(let i=0;i<count;i++){const x=xOffset+(i/(count-1)-.5)*solidW*.9,hh=solidH*(.58+.38*((i*5)%4)/3);this.createMesh(u.cone,this.mat.hazardPlant,g,{x,y:solidBottom+hh*.5,z:.1,sx:solidW/count*.82,sy:hh,sz:.28,rz:(i-(count-1)/2)*.045});}break;
      }
      case'spike':{
        const heights=[.68,.86,1,.82,.62];for(let i=0;i<heights.length;i++){const hh=solidH*heights[i],x=xOffset+(i-2)*solidW*.17;this.createMesh(u.cone,this.mat.hazardRim,g,{x,y:solidBottom+hh*.5,z:.12,sx:solidW*.17,sy:hh,sz:.3,rz:(i-2)*.035});}break;
      }
      case'spike-patch':{
        const count=9;for(let i=0;i<count;i++){const hh=solidH*(.58+.4*((i*7)%5)/4),x=xOffset+(i/(count-1)-.5)*solidW*.94;this.createMesh(u.cone,i%3===1?this.mat.hazardRim:this.mat.hazardPlant,g,{x,y:solidBottom+hh*.5,z:.1,sx:solidW/count*.76,sy:hh,sz:.28,rz:(i%2?-.035:.035)});}trim(xOffset,solidBottom+.045,solidW*.94,this.mat.hazardWoodDark);break;
      }
      case'stump':
        this.createMesh(u.cylinder,this.mat.hazardWood,g,{x:xOffset,y:solidBottom+solidH*.47,z:.08,sx:solidW*.72,sy:solidH*.92,sz:solidW*.72});
        this.createMesh(u.circle,this.mat.hazardRim,g,{x:xOffset,y:solidTop-.07,z:.19,sx:solidW*.31,sy:solidW*.09,sz:1,cast:false});
        break;
      case'log-pile':
        wood(xOffset,solidBottom+solidH*.24,solidW*.98,solidH*.4);
        wood(xOffset-solidW*.17,solidBottom+solidH*.61,solidW*.62,solidH*.38,.035);
        wood(xOffset+solidW*.2,solidBottom+solidH*.58,solidW*.53,solidH*.32,-.045);
        trim(xOffset,solidBottom+.04,solidW*.9,this.mat.hazardWoodDark);
        break;
      case'puddle':
        this.createMesh(u.circle,this.mat.hazardWet,g,{x:xOffset,y:solidBottom+solidH*.42,z:.05,sx:solidW*.98,sy:solidH*.78,sz:1,cast:false});
        this.createMesh(u.circle,this.mat.hazardSlide,g,{x:xOffset,y:solidBottom+solidH*.42,z:.055,sx:solidW*.78,sy:solidH*.2,sz:1,cast:false});
        break;
      case'branch':
        wood(xOffset,solidBottom+solidH*.62,solidW*.98,solidH*.42);
        trim(xOffset,solidBottom+.045,solidW*.92,this.mat.hazardSlide);
        for(const x of[-.32,.24])leaf(xOffset+x*solidW,solidBottom+solidH*.72,.28,.4,x<0?-.45:.42);
        break;
      case'vine':
        wood(xOffset,solidBottom+solidH*.82,solidW*.94,solidH*.18);
        for(const f of[-.34,-.1,.16,.35]){const hh=solidH*(.6+.18*(Math.abs(f)>.2));this.createMesh(u.cylinder,this.mat.hazardPlant,g,{x:xOffset+f*solidW,y:solidTop-hh*.5,z:.09,sx:.055,sy:hh,sz:.055,cast:false});}
        trim(xOffset,solidBottom+.045,solidW*.88,this.mat.hazardSlide);
        break;
      case'canopy':
        wood(xOffset,solidBottom+solidH*.62,solidW*.96,solidH*.28,-.06);
        for(let i=0;i<7;i++)leaf(xOffset+(i/6-.5)*solidW*.86,solidBottom+solidH*(.58+.2*(i%2)),.27,.38,(i-3)*.18);
        trim(xOffset,solidBottom+.045,solidW*.9,this.mat.hazardRisk);
        break;
      default:this.createMesh(u.box,this.mat.stone,g,{x:xOffset,y:solidBottom+solidH*.5,z:.08,sx:solidW,sy:solidH,sz:.5});
    }
    if(!['overhead','flex'].includes(type.family))this.createMesh(u.circle,this.mat.shadow,g,{x:xOffset,y:.025,z:-.02,sx:Math.min(nominalW,solidW)*.88,sy:.16,sz:1,cast:false});
    const outline=this.createMesh(u.box,this.mat.hazardOutline,g,{x:xOffset,y:solidBottom+solidH*.5,z:.42,sx:solidW*1.08,sy:solidH*1.08,sz:.7,cast:false});outline.name='dash-high-visibility-outline';outline.visible=this.highVisibility;outline.renderOrder=22;
    const cue=this.createMesh(u.circle,this.mat.hazardCue,g,{x:xOffset,y:solidBottom+.035,z:.205,sx:solidW*.92,sy:.1,sz:1,cast:false});cue.visible=false;cue.userData.baseScaleX=cue.scale.x;
    g.userData.type=type.id;g.userData.family=type.family;g.userData.state='idle';g.userData.cue=cue;g.userData.collision={left,right,bottom,top};
    return g;
  }
  setHazardPresentationState(obstacle,state='idle'){
    const entry=this.hazardMap.get(obstacle);if(!entry)return false;
    const next=['idle','telegraph','active','recover'].includes(state)?state:'idle',cue=entry.group.userData.cue;
    entry.group.userData.state=next;if(cue)cue.visible=next==='telegraph'||next==='active';return true;
  }
  acquireHazard(type){const pool=this.hazardPools.get(type.id)||[];let group=pool.pop();if(!group)group=this.buildHazard(type);this.hazardPools.set(type.id,pool);const outline=group.getObjectByName?.('dash-high-visibility-outline');if(outline)outline.visible=this.highVisibility;group.visible=true;this.gameplayRoot.add(group);return{group,typeId:type.id};}
  releaseHazard(entry){entry.group.visible=false;entry.group.userData.state='idle';if(entry.group.userData.cue)entry.group.userData.cue.visible=false;this.gameplayRoot.remove(entry.group);const pool=this.hazardPools.get(entry.typeId)||[];if(pool.length<10)pool.push(entry.group);this.hazardPools.set(entry.typeId,pool);}
  syncHazards(obstacles,scroll){
    const live=this.liveHazards;live.clear();for(const obstacle of obstacles)live.add(obstacle);
    for(const [obstacle,entry] of this.hazardMap)if(!live.has(obstacle)){this.releaseHazard(entry);this.hazardMap.delete(obstacle);}
    for(const o of obstacles){let entry=this.hazardMap.get(o);if(!entry){entry=this.acquireHazard(o);this.hazardMap.set(o,entry);}const x=-this.viewW/2+(o.x-scroll)*this.unit,y=this.groundY+(o.visualY||0)*this.unit;entry.group.position.set(x,y,.1);entry.group.visible=x>-this.viewW*.7&&x<this.viewW*.72;}
  }
  syncBananas(bananas,scroll,time){
    let regular=0,golden=0;
    for(let i=0;i<bananas.length;i++){
      const b=bananas[i];if(b.collected)continue;const x=-this.viewW/2+(b.x-scroll)*this.unit;if(x<-this.viewW*.62||x>this.viewW*.65)continue;
      const bob=this.reducedMotion?0:.045*Math.sin(time*5+i*.7),y=this.groundY+b.y*this.unit+bob;
      if(b.golden){
        if(golden>=this.goldenMesh.instanceMatrix.count)continue;
        const pulse=this.reducedMotion?1:1+.07*Math.sin(time*6.4+i*.9),scale=.76*pulse,rot=this.reducedMotion?0:time*4.5+i*.73+.18*Math.sin(time*2.8+i);
        applyMatrix(this.goldenMesh,golden,x,y,.34,scale,scale,scale,rot);
        applyMatrix(this.goldenGlow,golden,x,y,.12,.92*pulse,.92*pulse,1,0);
        applyMatrix(this.goldenGlint,golden,x,y,.15,1.08*pulse,.095,1,time*2.35+i*.41);golden++;
      }else{
        if(regular>=this.bananaMesh.instanceMatrix.count)continue;
        const pulse=this.reducedMotion?1:1+.025*Math.sin(time*5.2+i),scale=.64*pulse,rot=this.reducedMotion?0:time*3.25+i*.73;
        applyMatrix(this.bananaMesh,regular,x,y,.32,scale,scale,scale,rot);
        applyMatrix(this.bananaGlow,regular,x,y,.11,.5*pulse,.5*pulse,1,0);regular++;
      }
    }
    this.bananaMesh.count=regular;this.bananaGlow.count=regular;this.goldenMesh.count=golden;this.goldenGlow.count=golden;this.goldenGlint.count=golden;
    for(const mesh of[this.bananaMesh,this.bananaGlow,this.goldenMesh,this.goldenGlow,this.goldenGlint])mesh.instanceMatrix.needsUpdate=true;
  }
  emit(type,payload={}){
    if(this.screenShake&&!this.reducedMotion&&['land','nearMiss','stage','death','record'].includes(type)){
      const amount=(type==='death'||type==='record') ? .18 : type==='stage' ? .11 : .065;
      this.shakeAmount=Math.max(this.shakeAmount,amount);
    }
    this.vfx.emit(type,payload);
  }
  consumeGameplayEvent(detail={}){
    const type=detail.type||detail.name;if(!type)return;
    const aliases={'golden-banana':'goldenBanana','perfect-jump':'perfectJump','perfect-slide':'perfectSlide','near-miss':'nearMiss','stage-change':'stage','perfect-chain':'multiplier','risk-line':'nearMiss'};
    this.emit(aliases[type]||type,detail);
  }
  reset(){this.vfx.reset();this.shakeAmount=0;this.camera.position.x=0;this.camera.position.y=0;}
  update({dt=0,time=0,scroll=0,stage=1,speed=1,baseSpeed=1,obstacles=[],bananas=[],playerX=0,playerY=0,sliding=false,state='menu',flow=0}={}){
    this.time=time;this.scroll=scroll;this.stage=stage;const speedRatio=Math.max(.2,speed/Math.max(1,baseSpeed));
    const features=this.safeMode?this.biomeFeatures:this.applyBiome(stage,time);
    if(!this.safeMode)this.updateEnvironment(scroll,time,speedRatio,features);
    this.syncHazards(obstacles,scroll);this.syncBananas(bananas,scroll,time);
    const jumpWorld=Math.max(0,playerY),shadowScale=clamp(1-jumpWorld/4.2,.46,1),shadowOpacity=clamp(.72-jumpWorld*.12,.16,.72);this.contactShadow.position.set(playerX,this.groundY+.02,-.04);this.contactShadow.scale.set(2.35*shadowScale,.5*shadowScale,1);this.contactShadowMaterial.opacity=shadowOpacity;
    if(!this.safeMode)this.vfx.update(dt,{time,speedRatio,playerX,groundY:this.groundY,state,pollen:features.pollen,storm:features.storm,viewW:this.viewW,viewH:this.viewH,flow});
    if(this.screenShake&&!this.reducedMotion&&this.shakeAmount>0){this.camera.position.x=Math.sin(time*67)*this.shakeAmount;this.camera.position.y=Math.cos(time*53)*this.shakeAmount*.65;this.shakeAmount=Math.max(0,this.shakeAmount-dt*1.8);}else{this.camera.position.x=0;this.camera.position.y=0;}
    this.foregroundLeaves.visible=!this.safeMode&&!(this.reducedMotion||this.highVisibility)&&(state!=='menu'||this.qualityName!=='LOW');
    const collect=clamp(Number(this.visibility.collectibleVisibility)||1,.65,2),pulse=this.reducedMotion?0:Math.sin(time*5.3);
    this.mat.goldenGlow.opacity=((this.highVisibility?.48:.34)+.08*pulse)*collect;
    this.mat.goldenGlint.opacity=.52*collect+(this.reducedMotion?0:.12*Math.sin(time*7.1));
    this.mat.golden.emissiveIntensity=(this.highVisibility?1.45:1)+(this.reducedMotion?0:.28*Math.sin(time*4.7));
    this.mat.banana.emissiveIntensity=(this.highVisibility?.72:.42)*collect;
    this.renderer.domElement.style.setProperty('--dash-speed-grade',String(clamp((speedRatio-1)*.08,0,.12)));
    if(!this.safeMode&&flow>=80&&state==='running'&&Math.floor(time*2)!==this._lastFlowPulse){this._lastFlowPulse=Math.floor(time*2);this.vfx.emit('flow',{x:playerX,y:this.groundY+.75,intensity:.35});}
  }
  enterSafeMode(error){
    if(this.safeMode)return;
    this.safeMode=true;this.lastRenderError=String(error?.message||error||'Dash render failure');
    this.environmentRoot.visible=false;this.vfx.reset();this.vfx.points.visible=false;this.vfx.ringLines.visible=false;this.vfx.streaks.visible=false;
    this.scene.background=this.fallbackBackground;
    const low=getDashQualityPreset('LOW');this.quality={...low,shadows:false,particleCount:12,streakCount:0,lightShafts:0,mistCount:0};this.vfx.setQuality(this.quality);
    for(const entry of this.hazardMap.values())entry.group.traverse(o=>{if(o.isMesh)o.castShadow=false;});
    globalThis.dispatchEvent?.(new CustomEvent('chimpions-dash-render-fallback',{detail:{message:this.lastRenderError}}));
  }
  setContextLost(value=true){this.contextLost=!!value;}
  restoreContextState(){
    this.contextLost=false;this.safeMode=false;this.lastRenderError='';this.environmentRoot.visible=true;
    if(this.scene.background===this.fallbackBackground)this.scene.background=null;
    this.renderer.resetState?.();
    this.scene.traverse(object=>{
      if(object.isInstancedMesh)object.instanceMatrix.needsUpdate=true;
      const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
      for(const material of materials){material.needsUpdate=true;for(const value of Object.values(material))if(value?.isTexture)value.needsUpdate=true;}
    });
    this.applyQualityState(this.lastQualityState);this.resize({viewW:this.viewW,viewH:this.viewH,groundY:this.groundY});
  }
  render(){
    if(this.contextLost)return false;
    try{this.renderer.render(this.scene,this.camera);return true;}
    catch(error){
      console.error('Dash direct render failed; entering safe presentation mode.',error);this.enterSafeMode(error);
      try{this.renderer.render(this.scene,this.camera);return true;}
      catch(fallbackError){this.lastRenderError=String(fallbackError?.message||fallbackError);console.error('Dash safe direct render failed.',fallbackError);return false;}
    }
  }
  stats(){
    const highlightedHazards=[...this.hazardMap.values()].filter(entry=>entry.group.getObjectByName?.('dash-high-visibility-outline')?.visible).length;
    return{quality:this.qualityName,pixelRatio:this.renderer.getPixelRatio(),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,
      hazards:this.hazardMap.size,highlightedHazards,bananaInstances:this.bananaMesh.count+this.goldenMesh.count,collectibleGlowInstances:this.bananaGlow.count+this.goldenGlow.count+this.goldenGlint.count,
      visibility:{...this.visibility},environmentInstances:this.farCanopy.count+this.midTrunks.count+this.midCanopy.count+this.groundStones.count+this.grass.count+this.foregroundLeaves.count+this.ruins.count+(this.environmentArt?.instanceCount?.()||0),
      accessibility:{highVisibility:this.highVisibility,reducedMotion:this.reducedMotion,screenShake:this.screenShake},shakeAmount:this.shakeAmount,vfx:this.vfx.stats(),
      safeMode:this.safeMode,contextLost:this.contextLost,lastRenderError:this.lastRenderError};
  }
  dispose(){
    globalThis.removeEventListener?.('chimpions-dash-event',this.eventListener);document.documentElement.classList.remove('dash-gpu-world');this.vfx.dispose();
    for(const entry of this.hazardMap.values())this.releaseHazard(entry);this.hazardMap.clear();this.hazardPools.clear();this.liveHazards.clear();this.scene.remove(this.environmentRoot,this.gameplayRoot);
    for(const value of this.disposables)try{value?.dispose?.();}catch{}
    if(globalThis.chimpionsDashGraphics?._owner===this)delete globalThis.chimpionsDashGraphics;
  }
}
