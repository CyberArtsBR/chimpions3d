import * as THREE from 'three';
import {PLATFORM_SCALE} from './physics.js';

// Final visual pass for the master brief. It intentionally avoids gameplay changes,
// ambient insects/particles and the removed low-poly center trunk.
const profileWood=new THREE.MeshStandardMaterial({color:0x9a7658,roughness:.92});
const profileDark=new THREE.MeshStandardMaterial({color:0x4a3426,roughness:1});
const movingGlow=new THREE.MeshStandardMaterial({color:0x70e0e8,emissive:0x176c76,emissiveIntensity:.7,roughness:.42});
const specialGold=new THREE.MeshStandardMaterial({color:0xe8bd58,emissive:0x6b4308,emissiveIntensity:.32,roughness:.45,metalness:.1});
const twigGeo=new THREE.CylinderGeometry(.07,.095,.75,10,1);
const markerGeo=new THREE.TorusGeometry(.13,.035,6,18);
const crackGeo=new THREE.BoxGeometry(.055,.48,.06);
const specialBandGeo=new THREE.TorusGeometry(.25,.035,7,22);

function decorateBranch(group){
 if(!group?.userData?.platformWidth||group.userData.finalVisualPolish)return;
 group.userData.finalVisualPolish=true;
 const width=group.userData.platformWidth,type=group.userData.platformType||'solid',variant=group.userData.variant||0;
 const accents=new THREE.Group();accents.name='final-platform-accents';group.add(accents);

 // Four genuinely different silhouettes without touching the landing plane.
 const twigCount=type==='cracked'||group.userData.fragile?1:1+variant;
 for(let i=0;i<twigCount;i++){
  const twig=new THREE.Mesh(twigGeo,profileWood);const side=i%2?1:-1;
  twig.position.set(side*width*(.19+.08*(i%3)),-.48*PLATFORM_SCALE,-.08+(i%2)*.12);
  twig.rotation.z=side*(.45+.14*variant+.12*i);twig.scale.setScalar(PLATFORM_SCALE*(.82+.05*variant));
  twig.castShadow=true;accents.add(twig);
 }

 if(type==='moving'){
  // Three readable moving-platform variants: paired beacons, triple beacons, offset beacon rail.
  const count=2+(variant%2);
  for(let i=0;i<count;i++){
   const ring=new THREE.Mesh(markerGeo,movingGlow);ring.rotation.y=Math.PI/2;
   ring.position.set((i-(count-1)/2)*Math.min(.65,width*.24),-.43*PLATFORM_SCALE,.28+(variant%2)*.06);
   ring.scale.setScalar(PLATFORM_SCALE*(1+.08*variant));accents.add(ring);
  }
 }
 if(type==='cracked'||group.userData.fragile){
  // Distinct crack signatures remain below the collision surface.
  const count=3+(variant%2);
  for(let i=0;i<count;i++){
   const crack=new THREE.Mesh(crackGeo,profileDark);crack.position.set((i-(count-1)/2)*width*.12,-.19*PLATFORM_SCALE,.41*PLATFORM_SCALE);
   crack.rotation.z=(i%2?-.55:.55)+(variant-1.5)*.08;crack.scale.y=.8+.12*((i+variant)%3);accents.add(crack);
  }
 }
 if(type==='spring'){
  const base=new THREE.Mesh(markerGeo,specialGold);base.rotation.x=Math.PI/2;base.position.set(0,-.05,.18);base.scale.setScalar(1.35+variant*.08);accents.add(base);
 }

 // Rare premium branch: deterministic, purely visual and collision-neutral.
 // Small variant-3 solid branches receive restrained golden growth rings.
 const rare=type==='solid'&&variant===3&&width<1.85;
 if(rare){
  group.userData.rareSpecial=true;
  for(const x of [-.28,0,.28]){
   const band=new THREE.Mesh(specialBandGeo,specialGold);band.rotation.y=Math.PI/2;band.position.set(x*width,-.23*PLATFORM_SCALE,.01);band.scale.setScalar(.72*PLATFORM_SCALE);accents.add(band);
  }
 }
 // Minor accents are optional detail on constrained devices; the core branch stays unchanged.
 accents.traverse(o=>{if(o.isMesh&&o.material!==specialGold)o.userData.desktopDetail=true;});
}

const originalAdd=THREE.Object3D.prototype.add;
if(!THREE.Object3D.prototype.__chimpBranchVisualPatch){
 THREE.Object3D.prototype.add=function(...objects){
  for(const object of objects)if(object?.userData?.platformWidth)decorateBranch(object);
  return originalAdd.apply(this,objects);
 };
 THREE.Object3D.prototype.__chimpBranchVisualPatch=true;
}

function canopyTexture(seed,near=false){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const c=canvas.getContext('2d');
 let state=seed>>>0;const r=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 c.clearRect(0,0,1024,1024);
 for(let cluster=0;cluster<(near?34:48);cluster++){
  const cx=r()*1024,cy=r()*1024,base=near?58+r()*95:42+r()*78;
  c.fillStyle=near?(cluster%3?'#254d3d':'#315943'):(cluster%3?'#345f4e':'#406b57');
  c.globalAlpha=near?.48:.34;
  for(let i=0;i<8;i++){
   const a=r()*Math.PI*2,d=r()*base*.75,rx=base*(.38+r()*.48),ry=rx*(.32+r()*.35);
   c.beginPath();c.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d,rx,ry,r()*Math.PI,0,Math.PI*2);c.fill();
  }
 }
 c.globalAlpha=1;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;return texture;
}

const rendererPrototype=THREE.WebGLRenderer.prototype;
if(!rendererPrototype.__chimpCanopyDepthPatched){
 const priorRender=rendererPrototype.render;
 let depthScene=null,depthGroup=null,layers=[];
 const mobile=()=>matchMedia('(pointer: coarse)').matches||innerWidth<=600;
 function ensureDepth(scene){
  if(depthScene===scene&&depthGroup)return;
  depthScene=scene;depthGroup=new THREE.Group();depthGroup.name='deterministic-canopy-depth';scene.add(depthGroup);layers=[];
  const specs=[
   {seed:821,z:-29,w:40,h:31,opacity:.24},
   {seed:1337,z:-25,w:34,h:28,opacity:.28},
   {seed:2081,z:-21,w:30,h:25,opacity:.30}
  ];
  for(const [i,s] of specs.entries()){
   const material=new THREE.MeshBasicMaterial({map:canopyTexture(s.seed,i===2),transparent:true,depthWrite:false,fog:false,opacity:s.opacity,toneMapped:false,color:0xb8cdb8});
   const plane=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),material);plane.position.z=s.z;plane.renderOrder=-30+i;depthGroup.add(plane);layers.push(plane);
  }
 }
 function updateDepth(camera){
  if(!depthGroup)return;const y=camera.position.y,biome=document.body?.dataset?.biome||'morning';
  const tint=biome==='moonlit'?0x6883a0:biome==='golden'?0xc09b62:biome==='emerald'?0x6e9b83:0x9ab68b;
  layers.forEach((layer,i)=>{
   layer.visible=!mobile()||i>0;
   layer.position.y=y+Math.sin(y*(.010+i*.004)+i*1.8)*(1.2+i*.45);
   layer.position.x=Math.sin(y*(.006+i*.003)+i)*(.7+i*.25);
   layer.material.color.setHex(tint);layer.material.opacity=(mobile()?.18:.24)+i*.025;
  });
 }
 rendererPrototype.render=function(scene,camera){ensureDepth(scene);updateDepth(camera);return priorRender.call(this,scene,camera);};
 rendererPrototype.__chimpCanopyDepthPatched=true;
}
