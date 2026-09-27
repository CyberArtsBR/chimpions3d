import * as THREE from 'three';
import './dashWorld.css';
import {DASH_BIOMES,biomeForStage} from '../biomes/biomeProfiles.js';
import {DASH_QUALITY_PRESETS,getDashQualityPreset,resolveDashQuality,storeDashQuality} from './quality.js';
import {DashVFX} from '../vfx/DashVFX.js';

export {DASH_BIOMES,resolveDashQuality,DASH_QUALITY_PRESETS};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const wrap=(v,span)=>{const half=span/2;return((v+half)%span+span)%span-half;};
const TMP_COLOR_A=new THREE.Color(),TMP_COLOR_B=new THREE.Color();
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
    this.viewW=20;this.viewH=12;this.groundY=-4;this.scroll=0;this.stage=1;this.time=0;this.highVisibility=false;this.reducedMotion=false;this.screenShake=true;this.shakeAmount=0;this.environmentRoot=new THREE.Group();this.environmentRoot.name='dash-gpu-environment';scene.add(this.environmentRoot);
    this.gameplayRoot=new THREE.Group();this.gameplayRoot.name='dash-gpu-gameplay';scene.add(this.gameplayRoot);
    this.random=seeded(0x43a991);this.profile=DASH_BIOMES[0];this.qualityName=resolveDashQuality();this.quality=getDashQualityPreset(this.qualityName);
    this.hazardMap=new Map();this.hazardPools=new Map();this.hazardMaterials=[];this.disposables=[];
    this.buildMaterials();this.buildEnvironment();this.buildGameplay();this.vfx=new DashVFX(scene,this.quality);
    this.applyQuality(this.qualityName,false);this.installEvents();document.documentElement.classList.add('dash-gpu-world');
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
      banana:std({color:0xffd942,roughness:.34,metalness:.05,emissive:0x392800,emissiveIntensity:.2}),
      golden:std({color:0xffdb66,roughness:.2,metalness:.52,emissive:0x8a5200,emissiveIntensity:.9}),
      far:std({color:0x1e5139,roughness:1}),mid:std({color:0x2e6544,roughness:1}),trunk:std({color:0x3f3929,roughness:1}),foreground:std({color:0x214b32,roughness:.95}),
      waterfall:basic({color:0xb4f5f3,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}),
      shaft:basic({color:0xfff1ba,transparent:true,opacity:.08,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),
      moon:basic({color:0xdce6ff,transparent:true,opacity:.9,depthWrite:false}),
      glow:basic({map:makeSoftTexture(),color:0xffe890,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}),
      shadow:basic({map:makeShadowTexture(),transparent:true,opacity:.7,depthWrite:false,color:0x0b1a13}),
      hazardOutline:basic({color:0xfff2a8,wireframe:true,transparent:true,opacity:.86,depthTest:false,depthWrite:false})
    };
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
    this.bananaGeometry=makeBananaGeometry();this.disposables.push(this.bananaGeometry);
    this.bananaMesh=new THREE.InstancedMesh(this.bananaGeometry,this.mat.banana,96);this.goldenMesh=new THREE.InstancedMesh(this.bananaGeometry,this.mat.golden,24);this.goldenGlow=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),this.mat.glow,24);this.disposables.push(this.goldenGlow.geometry);
    for(const mesh of[this.bananaMesh,this.goldenMesh,this.goldenGlow]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;this.gameplayRoot.add(mesh);}this.bananaMesh.castShadow=false;this.goldenMesh.castShadow=false;
    this.contactShadowMaterial=this.mat.shadow.clone();this.disposables.push(this.contactShadowMaterial);this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.contactShadowMaterial);this.contactShadow.position.z=-.04;this.contactShadow.renderOrder=2;this.gameplayRoot.add(this.contactShadow);this.disposables.push(this.contactShadow.geometry);
    this.unitGeo={
      cylinder:new THREE.CylinderGeometry(.5,.5,1,9),cone:new THREE.ConeGeometry(.5,1,7),sphere:new THREE.IcosahedronGeometry(.5,1),box:new THREE.BoxGeometry(1,1,.5),leaf:makeLeafGeometry(),circle:new THREE.CircleGeometry(.5,24)
    };Object.values(this.unitGeo).forEach(g=>this.disposables.push(g));
  }
  installEvents(){
    this.eventListener=e=>this.consumeGameplayEvent(e.detail||{});globalThis.addEventListener?.('chimpions-dash-event',this.eventListener);
    const api={
      get quality(){return this._owner.qualityName;},
      setQuality:name=>this.setQuality(name),
      setAccessibility:settings=>this.setAccessibility(settings),
      stats:()=>this.stats(),_owner:this
    };globalThis.chimpionsDashGraphics=api;
  }
  setQuality(name){const key=String(name||'').toUpperCase();if(!DASH_QUALITY_PRESETS[key])throw new Error('Dash quality must be LOW, BALANCED, HIGH, or ULTRA.');storeDashQuality(key);this.applyQuality(key,true);return key;}
  setAccessibility({highVisibility=this.highVisibility,reducedMotion=this.reducedMotion,screenShake=this.screenShake}={}){
    this.highVisibility=!!highVisibility;this.reducedMotion=!!reducedMotion;this.screenShake=!!screenShake;this.vfx?.setReducedMotion(this.reducedMotion);
    const applyGroup=group=>{const outline=group?.getObjectByName?.('dash-high-visibility-outline');if(outline)outline.visible=this.highVisibility;};
    for(const entry of this.hazardMap.values())applyGroup(entry.group);for(const pool of this.hazardPools.values())for(const group of pool)applyGroup(group);
    this.mat.banana.emissiveIntensity=this.highVisibility?1.05:.2;
    if(!this.screenShake||this.reducedMotion){this.shakeAmount=0;this.camera.position.x=0;this.camera.position.y=0;}
    return{highVisibility:this.highVisibility,reducedMotion:this.reducedMotion,screenShake:this.screenShake};
  }
  applyQuality(name,persisted){
    this.qualityName=name;this.quality=getDashQualityPreset(name);this.pixelRatioCap=this.quality.pixelRatio;this.vfx?.setQuality(this.quality);
    this.renderer.shadowMap.enabled=this.quality.shadows;this.keyLight.castShadow=this.quality.shadows;const map=this.quality.shadowMap;this.keyLight.shadow.mapSize.set(map,map);if(this.keyLight.shadow.map){this.keyLight.shadow.map.dispose();this.keyLight.shadow.map=null;}
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,this.pixelRatioCap));
    for(const entry of this.hazardMap.values())entry.group.traverse(o=>{if(o.isMesh)o.castShadow=this.quality.shadows;});
    if(persisted)this.resize({viewW:this.viewW,viewH:this.viewH,groundY:this.groundY});
  }
  resize({viewW=this.viewW,viewH=this.viewH,groundY=this.groundY}={}){
    this.viewW=viewW;this.viewH=viewH;this.groundY=groundY;
    this.sky.scale.set(viewW*1.18,viewH*1.16,1);this.sky.position.y=0;
    const depth=Math.max(2.3,viewH*.22);this.ground.scale.set(viewW*1.15,depth,1);this.ground.position.set(0,groundY-depth*.5,-.55);
    this.groundLip.scale.set(viewW*1.15,.22,1);this.groundLip.position.set(0,groundY-.06,-.3);
    this.moon.position.set(viewW*.32,viewH*.27,-14);this.moon.scale.setScalar(Math.max(.65,viewH*.075));
    this.keyLight.shadow.camera.left=-viewW*.56;this.keyLight.shadow.camera.right=viewW*.56;this.keyLight.shadow.camera.top=viewH*.55;this.keyLight.shadow.camera.bottom=-viewH*.55;this.keyLight.shadow.camera.updateProjectionMatrix();
  }
  interpolateBiome(stage,time){
    const current=biomeForStage(stage).profile;if(stage<=1)return{from:current,to:current,t:1};const previous=biomeForStage(stage-1).profile,within=((time%30)+30)%30,t=smooth(clamp(within/3.2,0,1));return{from:previous,to:current,t};
  }
  applyBiome(stage,time){
    const {from,to,t}=this.interpolateBiome(stage,time);this.profile=to;
    const top=lerpColor(new THREE.Color(),from.skyTop,to.skyTop,t),bottom=lerpColor(new THREE.Color(),from.skyBottom,to.skyBottom,t),fog=lerpColor(new THREE.Color(),from.fog,to.fog,t);
    this.skyMaterial.uniforms.top.value.copy(top);this.skyMaterial.uniforms.bottom.value.copy(bottom);lerpColor(this.skyMaterial.uniforms.sun.value,from.sun,to.sun,t);this.skyMaterial.uniforms.sunStrength.value=.12+.2*(1-(from.storm+(to.storm-from.storm)*t));
    this.scene.fog??=new THREE.FogExp2(fog,.02);this.scene.fog.color.copy(fog);this.scene.fog.density=from.fogDensity+(to.fogDensity-from.fogDensity)*t;
    lerpColor(this.mat.ground.color,from.dirt,to.dirt,t);lerpColor(this.mat.moss.color,from.ground,to.ground,t);lerpColor(this.mat.far.color,from.canopy,to.canopy,t);lerpColor(this.mat.mid.color,from.mid,to.mid,t);lerpColor(this.mat.foreground.color,from.canopy,to.canopy,t);lerpColor(this.mat.goldStone.color,0x74725a,to.accent,t*.35);
    lerpColor(this.hemisphere.color,from.ambient,to.ambient,t);this.hemisphere.groundColor.copy(bottom).multiplyScalar(.55);this.hemisphere.intensity=1.65+(1-(from.storm+(to.storm-from.storm)*t))*.55;
    lerpColor(this.keyLight.color,from.sun,to.sun,t);this.keyLight.intensity=2.3+(1-(from.storm+(to.storm-from.storm)*t))*.85;lerpColor(this.rimLight.color,from.rim,to.rim,t);this.rimLight.intensity=1.05+(to.moon*.35);
    this.renderer.toneMappingExposure=from.exposure+(to.exposure-from.exposure)*t;
    return{
      canopyDensity:from.canopyDensity+(to.canopyDensity-from.canopyDensity)*t,foreground:from.foreground+(to.foreground-from.foreground)*t,
      waterfall:from.waterfall+(to.waterfall-from.waterfall)*t,ruins:from.ruins+(to.ruins-from.ruins)*t,moon:from.moon+(to.moon-from.moon)*t,
      storm:from.storm+(to.storm-from.storm)*t,pollen:from.pollen+(to.pollen-from.pollen)*t,accent:to.accent
    };
  }
  updateEnvironment(scroll,time,speedRatio,features){
    const span=this.viewW*1.45,scrollWorld=scroll*this.unit;
    const farCount=Math.min(this.farCanopy.instanceMatrix.count,Math.round(this.quality.farCount*features.canopyDensity));this.farCanopy.count=farCount;
    for(let i=0;i<farCount;i++){const d=this.envSeeds.far[i],x=wrap(d.x*span-scrollWorld*.045,span),y=this.groundY+2.7+d.y*this.viewH*.36,s=1.25+d.s*1.8;applyMatrix(this.farCanopy,i,x,y,0,s*1.45,s*.9,1,d.r);}
    this.farCanopy.instanceMatrix.needsUpdate=true;
    const cliffCount=Math.min(18,Math.max(7,Math.round(this.quality.farCount*.32)));this.cliffs.count=cliffCount;
    for(let i=0;i<cliffCount;i++){const d=this.envSeeds.cliffs[i],x=wrap(d.x*span-scrollWorld*.022,span),y=this.groundY+1.15+d.y*1.1,s=2.1+d.s*2.5;applyMatrix(this.cliffs,i,x,y,0,s*1.05,s*1.6,1,d.r);}
    this.cliffs.instanceMatrix.needsUpdate=true;

    const midCount=Math.min(this.midTrunks.instanceMatrix.count,Math.round(this.quality.midCount*features.canopyDensity));this.midTrunks.count=this.midCanopy.count=midCount;
    for(let i=0;i<midCount;i++){const d=this.envSeeds.mid[i],x=wrap(d.x*span-scrollWorld*.12,span),h=2.4+d.s*3.3,y=this.groundY+h*.45;applyMatrix(this.midTrunks,i,x,y,0,.5+d.s*.35,h,1,d.r*.22);applyMatrix(this.midCanopy,i,x+(d.r*.4),this.groundY+h*.92,0,1.05+d.s*.9,.75+d.s*.6,1,d.r);}
    this.midTrunks.instanceMatrix.needsUpdate=true;this.midCanopy.instanceMatrix.needsUpdate=true;

    const detailCount=Math.min(this.groundStones.instanceMatrix.count,this.quality.detailCount);this.groundStones.count=this.grass.count=detailCount;
    for(let i=0;i<detailCount;i++){const d=this.envSeeds.detail[i],x=wrap(d.x*span-scrollWorld,span),stoneS=.12+d.s*.2;applyMatrix(this.groundStones,i,x,this.groundY-.05-d.y*.17,0,stoneS*(1.2+d.y),stoneS*.5,stoneS,d.r);applyMatrix(this.grass,i,x+.12,this.groundY+.03,0,.12+d.s*.1,.18+d.s*.18,1,d.r*.7);}
    this.groundStones.instanceMatrix.needsUpdate=true;this.grass.instanceMatrix.needsUpdate=true;

    const fgCount=Math.min(this.foregroundLeaves.instanceMatrix.count,Math.round(this.quality.foregroundCount*features.foreground));this.foregroundLeaves.count=fgCount;
    for(let i=0;i<fgCount;i++){const d=this.envSeeds.foreground[i],x=wrap(d.x*span-scrollWorld*(1.28+speedRatio*.05),span),top=i%3!==0,y=top?this.groundY+3.8+d.y*this.viewH*.43:this.groundY-.12-d.y*.5,s=.42+d.s*.48;applyMatrix(this.foregroundLeaves,i,x,y,0,s,s*1.65,1,d.r+Math.sin(time*1.7+i)*.08);}
    this.foregroundLeaves.instanceMatrix.needsUpdate=true;

    const ruinCount=Math.min(this.ruins.instanceMatrix.count,Math.round(this.quality.midCount*.28*features.ruins));this.ruins.count=ruinCount;
    for(let i=0;i<ruinCount;i++){const d=this.envSeeds.ruins[i],x=wrap(d.x*span-scrollWorld*.095,span),h=1.5+d.s*2.4;applyMatrix(this.ruins,i,x,this.groundY+h*.46,-.02,.6+d.s*.45,h,1,d.r*.12);}
    this.ruins.instanceMatrix.needsUpdate=true;

    this.mat.ground.map.offset.x=-(scrollWorld*.06)%1;this.mat.ground.map.offset.y=Math.sin(time*.03)*.025;
    const waterfallOpacity=.06+.22*features.waterfall;this.mat.waterfall.opacity=waterfallOpacity;
    this.waterfalls.forEach((mesh,i)=>{mesh.visible=features.waterfall>.08&&i<Math.ceil(features.waterfall*3);const x=((i-1.5)*this.viewW*.2)+Math.sin(time*.18+i)*.08;mesh.position.set(x,this.groundY+this.viewH*.36,-8+i*.08);mesh.scale.set(.35+.2*(i%2),this.viewH*.62,1);});
    const shaftCount=Math.min(this.shafts.length,this.quality.lightShafts);this.shafts.forEach((mesh,i)=>{mesh.visible=i<shaftCount&&features.storm<.75;mesh.position.set((i-(shaftCount-1)/2)*this.viewW*.18+Math.sin(time*.08+i)*.18,this.groundY+this.viewH*.48,-3.4-i*.05);mesh.scale.set(.7+(.25*(i%2)),this.viewH*.7,1);mesh.material.opacity=.035+.04*(1-features.storm);});
    this.moon.visible=features.moon>.12;this.mat.moon.opacity=.4+.5*features.moon;this.moon.rotation.z=time*.008;
    this.mistMaterial.opacity=.045+.16*features.waterfall+.05*features.storm;this.mist.forEach((mesh,i)=>{mesh.position.set(wrap((i-1)*this.viewW*.36-time*(.03+i*.012),this.viewW*1.4),this.groundY+.75+i*.52,-2.8-i*.25);mesh.scale.set(this.viewW*.58,1.4+i*.3,1);});
  }
  createMesh(geometry,material,parent,{x=0,y=0,z=0,sx=1,sy=1,sz=1,rz=0,cast=true}={}){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;m.castShadow=cast&&this.quality.shadows;m.receiveShadow=false;parent.add(m);return m;}
  buildHazard(type){
    const g=new THREE.Group(),w=Math.max(.8,type.w*this.unit),h=Math.max(.4,(type.visualHeight||type.h)*this.unit),u=this.unitGeo;
    const wood=(x,y,width,height,angle=0)=>this.createMesh(u.cylinder,this.mat.bark,g,{x,y,z:.08,sx:height,sy:width,sz:height,rz:Math.PI/2+angle});
    const leaf=(x,y,sx,sy,angle=0,mat=this.mat.moss)=>this.createMesh(u.leaf,mat,g,{x,y,z:.11,sx,sy,sz:1,rz:angle,cast:false});
    switch(type.id){
      case'log': wood(0,h*.45,w*.92,h*.72);this.createMesh(u.sphere,this.mat.barkDark,g,{x:-w*.28,y:h*.52,z:.12,sx:.18,sy:.13,sz:.18});break;
      case'mushroom':
        for(const x of[-w*.25,0,w*.22]){this.createMesh(u.cylinder,this.mat.cream,g,{x,y:h*.25,z:.08,sx:.18,sy:h*.46,sz:.18});this.createMesh(u.sphere,this.mat.mushroom,g,{x,y:h*.58,z:.1,sx:.48,sy:.22,sz:.48});}break;
      case'thorns':case'spike':case'spike-patch':{
        const count=type.id==='spike-patch'?8:type.id==='spike'?5:6;for(let i=0;i<count;i++){const x=(i/(count-1)-.5)*w*.86,hh=h*(.55+.4*((i*7)%5)/4);this.createMesh(u.cone,this.mat.thorn,g,{x,y:hh*.5,z:.1,sx:w/count*.8,sy:hh,sz:.3,rz:(i-(count-1)/2)*.045});}break;
      }
      case'stump':this.createMesh(u.cylinder,this.mat.bark,g,{x:0,y:h*.46,z:.08,sx:w*.72,sy:h*.9,sz:w*.72});this.createMesh(u.circle,this.mat.cream,g,{x:0,y:h*.9,z:.18,sx:w*.35,sy:w*.12,sz:1,cast:false});break;
      case'log-pile':wood(0,h*.26,w*.95,h*.42);wood(-w*.16,h*.62,w*.62,h*.4,.03);wood(w*.2,h*.58,w*.55,h*.34,-.05);break;
      case'puddle':this.createMesh(u.circle,this.mat.wet,g,{x:0,y:h*.18,z:.04,sx:w*.92,sy:h*.54,sz:1,cast:false});break;
      case'branch':wood(0,h*.72,w*.98,h*.25);for(const x of[-w*.35,w*.2])leaf(x,h*.53,.32,.58,x<0?-.5:.45);break;
      case'vine':wood(0,h*.86,w*.9,h*.14);for(const x of[-w*.3,-w*.08,w*.16,w*.34]){this.createMesh(u.cylinder,this.mat.moss,g,{x,y:h*.55,z:.08,sx:.07,sy:h*.52,sz:.07,rz:0,cast:false});leaf(x,h*.33,.2,.42,x*2);}break;
      case'canopy':wood(0,h*.7,w*.95,h*.18,-.08);for(let i=0;i<7;i++)leaf((i/6-.5)*w*.86,h*(.52+.12*(i%2)),.28,.5,(i-3)*.22);break;
      default:this.createMesh(u.box,this.mat.stone,g,{x:0,y:h*.5,z:.08,sx:w,sy:h,sz:.5});
    }
    const outline=this.createMesh(u.box,this.mat.hazardOutline,g,{x:0,y:h*.5,z:.42,sx:w*1.08,sy:h*1.08,sz:.7,cast:false});outline.name='dash-high-visibility-outline';outline.visible=this.highVisibility;outline.renderOrder=22;
    const shadow=this.createMesh(u.circle,this.mat.shadow,g,{x:0,y:.03,z:-.02,sx:w*.85,sy:.18,sz:1,cast:false});shadow.material=this.mat.shadow;g.userData.type=type.id;return g;
  }
  acquireHazard(type){const pool=this.hazardPools.get(type.id)||[];let group=pool.pop();if(!group)group=this.buildHazard(type);this.hazardPools.set(type.id,pool);group.visible=true;this.gameplayRoot.add(group);return{group,typeId:type.id};}
  releaseHazard(entry){entry.group.visible=false;this.gameplayRoot.remove(entry.group);const pool=this.hazardPools.get(entry.typeId)||[];if(pool.length<10)pool.push(entry.group);this.hazardPools.set(entry.typeId,pool);}
  syncHazards(obstacles,scroll){
    const live=new Set(obstacles);
    for(const [obstacle,entry] of this.hazardMap)if(!live.has(obstacle)){this.releaseHazard(entry);this.hazardMap.delete(obstacle);}
    for(const o of obstacles){let entry=this.hazardMap.get(o);if(!entry){entry=this.acquireHazard(o);this.hazardMap.set(o,entry);}const x=-this.viewW/2+(o.x-scroll)*this.unit,y=this.groundY+(o.visualY||0)*this.unit;entry.group.position.set(x,y,.1);entry.group.visible=x>-this.viewW*.7&&x<this.viewW*.72;}
  }
  syncBananas(bananas,scroll,time){
    let regular=0,golden=0;
    for(let i=0;i<bananas.length;i++){
      const b=bananas[i];if(b.collected)continue;const x=-this.viewW/2+(b.x-scroll)*this.unit;if(x<-this.viewW*.62||x>this.viewW*.65)continue;const y=this.groundY+b.y*this.unit+.04*Math.sin(time*5+i*.7),rot=time*3.2+i*.73;
      if(b.golden){if(golden>=this.goldenMesh.instanceMatrix.count)continue;const scale=.72;applyMatrix(this.goldenMesh,golden,x,y,.34,scale,scale,scale,rot);applyMatrix(this.goldenGlow,golden,x,y,.12,.72,.72,1,0);golden++;}
      else{if(regular>=this.bananaMesh.instanceMatrix.count)continue;const scale=.62;applyMatrix(this.bananaMesh,regular,x,y,.32,scale,scale,scale,rot);regular++;}
    }
    this.bananaMesh.count=regular;this.goldenMesh.count=golden;this.goldenGlow.count=golden;this.bananaMesh.instanceMatrix.needsUpdate=true;this.goldenMesh.instanceMatrix.needsUpdate=true;this.goldenGlow.instanceMatrix.needsUpdate=true;
  }
  emit(type,payload={}){if(this.screenShake&&!this.reducedMotion&&['land','nearMiss','stage','death','record'].includes(type))this.shakeAmount=Math.max(this.shakeAmount,type==='death'||type==='record'?.18:type==='stage'?.11:.065);this.vfx.emit(type,payload);}
  consumeGameplayEvent(detail={}){
    const type=detail.type||detail.name;if(!type)return;const aliases={'golden-banana':'goldenBanana','perfect-jump':'perfectJump','perfect-slide':'perfectSlide','near-miss':'nearMiss','stage-change':'stage'};this.emit(aliases[type]||type,detail);
  }
  reset(){this.vfx.reset();this.shakeAmount=0;this.camera.position.x=0;this.camera.position.y=0;}
  update({dt=0,time=0,scroll=0,stage=1,speed=1,baseSpeed=1,obstacles=[],bananas=[],playerX=0,playerY=0,sliding=false,state='menu',flow=0}={}){
    this.time=time;this.scroll=scroll;this.stage=stage;const speedRatio=Math.max(.2,speed/Math.max(1,baseSpeed)),features=this.applyBiome(stage,time);this.updateEnvironment(scroll,time,speedRatio,features);this.syncHazards(obstacles,scroll);this.syncBananas(bananas,scroll,time);
    const jumpWorld=Math.max(0,playerY),shadowScale=clamp(1-jumpWorld/4.2,.46,1),shadowOpacity=clamp(.72-jumpWorld*.12,.16,.72);this.contactShadow.position.set(playerX,this.groundY+.02,-.04);this.contactShadow.scale.set(2.35*shadowScale,.5*shadowScale,1);this.contactShadowMaterial.opacity=shadowOpacity;
    this.vfx.update(dt,{time,speedRatio,playerX,groundY:this.groundY,state,pollen:features.pollen,storm:features.storm,viewW:this.viewW,viewH:this.viewH});
    if(this.screenShake&&!this.reducedMotion&&this.shakeAmount>0){this.camera.position.x=Math.sin(time*67)*this.shakeAmount;this.camera.position.y=Math.cos(time*53)*this.shakeAmount*.65;this.shakeAmount=Math.max(0,this.shakeAmount-dt*1.8);}else{this.camera.position.x=0;this.camera.position.y=0;}
    this.foregroundLeaves.visible=state!=='menu'||this.qualityName!=='LOW';this.goldenGlow.material.opacity=(this.highVisibility?.5:.22)+.12*Math.sin(time*5.3);this.mat.golden.emissiveIntensity=(this.highVisibility?1.45:.75)+.35*Math.sin(time*4.7);
    this.renderer.domElement.style.setProperty('--dash-speed-grade',String(clamp((speedRatio-1)*.08,0,.12)));
    if(flow>=80&&state==='running'&&Math.floor(time*2)!==this._lastFlowPulse){this._lastFlowPulse=Math.floor(time*2);this.vfx.emit('flow',{x:playerX,y:this.groundY+.75,intensity:.35});}
  }
  render(){this.renderer.render(this.scene,this.camera);}
  stats(){const highlightedHazards=[...this.hazardMap.values()].filter(entry=>entry.group.getObjectByName('dash-high-visibility-outline')?.visible).length;return{quality:this.qualityName,pixelRatio:this.renderer.getPixelRatio(),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,hazards:this.hazardMap.size,highlightedHazards,bananaInstances:this.bananaMesh.count+this.goldenMesh.count,environmentInstances:this.farCanopy.count+this.midTrunks.count+this.midCanopy.count+this.groundStones.count+this.grass.count+this.foregroundLeaves.count+this.ruins.count,accessibility:{highVisibility:this.highVisibility,reducedMotion:this.reducedMotion,screenShake:this.screenShake},shakeAmount:this.shakeAmount,vfx:this.vfx.stats()};}
  dispose(){
    globalThis.removeEventListener?.('chimpions-dash-event',this.eventListener);document.documentElement.classList.remove('dash-gpu-world');this.vfx.dispose();
    for(const entry of this.hazardMap.values())this.releaseHazard(entry);this.hazardMap.clear();this.scene.remove(this.environmentRoot,this.gameplayRoot);
    for(const value of this.disposables)try{value?.dispose?.();}catch{}
  }
}
