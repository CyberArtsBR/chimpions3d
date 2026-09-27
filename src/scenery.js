import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WIDTH, VINE_INSET, PLATFORM_SCALE, ITEM_SCALE, BANANA_HEIGHT} from './physics.js';
import {allowsDesktopDetail,applyVisualDetailBudget} from './mobileVisualBudget.js';
import {createTrackedLoadingManager,prefetchVisualAsset,versionedAssetUrl} from './assetRuntime.js';
import {createCanopyArt} from './canopyArt.js';
import {createCanopyVfx} from './canopyVfx.js';

export const TREE_SCROLL_PER_SCREEN=.32;
export const wrap01=value=>((value%1)+1)%1;
export function computeTreeScroll(cameraY,origin,viewHeight,speedFactor=1){
 return Math.max(0,cameraY-(origin??cameraY))/Math.max(.001,viewHeight)*TREE_SCROLL_PER_SCREEN*speedFactor;
}

function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function canvasTexture(w,h,draw){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 draw(canvas.getContext('2d'),w,h);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function surface(kind){
 return canvasTexture(512,512,(c,w,h)=>{
  const r=rng(kind==='bark'?72:53);c.fillStyle=kind==='bark'?'#8b7157':'#739654';c.fillRect(0,0,w,h);
  for(let i=0;i<24000;i++){
   const v=r(),x=r()*w,y=r()*h;c.fillStyle=kind==='bark'?(v>.5?'#ccb48a':'#372f26'):(v>.5?'#c6cc75':'#264828');
   c.globalAlpha=.08+r()*.24;c.fillRect(x,y,kind==='bark'?.5+r()*2:1+r()*3,kind==='bark'?6+r()*60:1+r()*3);
  }
  c.globalAlpha=.6;
  if(kind==='bark')for(let i=0;i<90;i++){
   const x=r()*w;c.strokeStyle=i%3?'#55422f':'#d0b489';c.lineWidth=.5+r()*2;c.beginPath();c.moveTo(x,0);
   for(let y=0;y<=h;y+=8)c.lineTo(x+Math.sin(y*.02+i)*3+Math.sin(y*.08)*1.5,y);c.stroke();
  }
  c.globalAlpha=1;
 });
}
const barkTexture=surface('bark'),mossTexture=surface('moss');
function reliefMap(kind){
 const texture=canvasTexture(512,512,(c,w,h)=>{
  const r=rng(kind==='bark'?938:541);c.fillStyle='#999';c.fillRect(0,0,w,h);
  for(let i=0;i<(kind==='bark'?160:6000);i++){
   const v=Math.floor(45+r()*170);c.fillStyle=`rgb(${v},${v},${v})`;
   if(kind==='bark'){
    c.strokeStyle=c.fillStyle;c.lineWidth=1+r()*5;c.beginPath();const x=r()*w;
    for(let y=0;y<=h;y+=8){const xx=x+Math.sin(y*.022+i)*4;y?c.lineTo(xx,y):c.moveTo(xx,y);}c.stroke();
   }else{c.beginPath();c.arc(r()*w,r()*h,1+r()*3,0,Math.PI*2);c.fill();}
  }
 });
 texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
const barkRelief=reliefMap('bark'),mossRelief=reliefMap('moss');
barkTexture.wrapS=barkTexture.wrapT=mossTexture.wrapS=mossTexture.wrapT=THREE.RepeatWrapping;
const leafTexture=canvasTexture(128,256,c=>{
 const g=c.createLinearGradient(20,20,100,220);g.addColorStop(0,'#cedd86');g.addColorStop(.4,'#709446');g.addColorStop(1,'#183d29');
 c.fillStyle=g;c.beginPath();c.moveTo(64,5);c.bezierCurveTo(130,50,125,165,64,250);c.bezierCurveTo(2,162,5,50,64,5);c.fill();
 c.strokeStyle='#e0e6a766';c.lineWidth=2;c.beginPath();c.moveTo(64,12);c.lineTo(64,246);c.stroke();
 for(let y=45;y<220;y+=22){c.beginPath();c.moveTo(64,y+18);c.lineTo(20,y-12);c.moveTo(64,y+18);c.lineTo(108,y-12);c.stroke();}
});
const endTexture=canvasTexture(512,512,(c,w,h)=>{
 const r=rng(118),grain=c.createRadialGradient(244,264,8,256,256,260);grain.addColorStop(0,'#e5c18b');grain.addColorStop(.75,'#b88852');grain.addColorStop(1,'#715031');c.fillStyle=grain;c.fillRect(0,0,w,h);
 for(let radius=12;radius<270;radius+=6+r()*5){
  c.strokeStyle=radius%3>1?'#65422c65':'#f5d8a76b';c.lineWidth=1+r()*2;c.beginPath();
  for(let i=0;i<=128;i++){const a=i/128*Math.PI*2,rr=radius+Math.sin(a*5+radius)*2.3,x=244+Math.cos(a)*rr,y=264+Math.sin(a)*rr*.96;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
 }
 c.strokeStyle='#4a302585';c.lineWidth=2;
 for(let i=0;i<7;i++){const a=r()*Math.PI*2;c.beginPath();for(let j=0;j<5;j++){const radius=170+j*22,x=244+Math.cos(a+j*.013)*radius,y=264+Math.sin(a+j*.013)*radius;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
});
const bananaTexture=canvasTexture(512,128,(c,w,h)=>{
 const r=rng(423),g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#b58a10');g.addColorStop(.24,'#ffd22c');g.addColorStop(.5,'#fff39a');g.addColorStop(.8,'#efb515');g.addColorStop(1,'#b98507');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<110;i++){c.fillStyle='#825222';c.globalAlpha=.05+r()*.14;c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}c.globalAlpha=1;
 for(const y of [21,60,103]){c.strokeStyle='#fff1a14a';c.lineWidth=2;c.beginPath();c.moveTo(0,y);c.lineTo(w,y+3);c.stroke();}
});
const mushroomTexture=canvasTexture(512,256,(c,w,h)=>{
 const r=rng(205),g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f47746');g.addColorStop(.6,'#d44329');g.addColorStop(1,'#8e231d');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<23;i++){const x=r()*w,y=25+r()*(h-60),radius=5+r()*11;c.fillStyle='#6b281f44';c.beginPath();c.ellipse(x,y+3,radius*1.13,radius*.82,0,0,7);c.fill();c.fillStyle=i%3?'#ffe9bb':'#fff6d9';c.beginPath();c.ellipse(x,y,radius,radius*.8,r()*.4,0,7);c.fill();}
});
const gillTexture=canvasTexture(256,256,c=>{
 c.fillStyle='#e0cfa6';c.fillRect(0,0,256,256);for(let i=0;i<96;i++){const a=i/96*Math.PI*2;c.strokeStyle=i%2?'#9b76594d':'#fff8d391';c.lineWidth=1;c.beginPath();c.moveTo(128+Math.cos(a)*25,128+Math.sin(a)*25);c.lineTo(128+Math.cos(a)*128,128+Math.sin(a)*128);c.stroke();}
});
function forestTexture(seed,scale=1){
 const density=Math.max(1,Math.min(1.5,Number(scale)||1));
 return canvasTexture(Math.round(1024*density),Math.round(1536*density),(c,w,h)=>{
  const r=rng(seed);
  function limb(x,y,len,angle,width,depth){
   angle=Math.max(-1.15,Math.min(1.15,angle));const nx=x+Math.sin(angle)*len,ny=y-Math.cos(angle)*len;
   c.strokeStyle='#42675c';c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.sin(angle-.2)*len*.5,y-Math.cos(angle)*len*.5,nx,ny);c.stroke();
   if(depth>0){limb(nx,ny,len*(.62+r()*.13),angle-.42-r()*.25,width*.62,depth-1);limb(nx,ny,len*(.6+r()*.17),angle+.3+r()*.4,width*.6,depth-1);}
   else for(let j=0;j<26;j++){c.fillStyle=['#476e59','#52765a','#638863','#88a371'][Math.floor(r()*4)];c.beginPath();c.ellipse(nx+(r()-.5)*95*density,ny+(r()-.5)*55*density,(10+r()*17)*density,(4+r()*9)*density,r()*3,0,Math.PI*2);c.fill();}
  }
  for(let i=0;i<5;i++)limb((i+.3+r()*.3)*w/5,h+100*density,(300+r()*400)*density,(r()-.5)*.15,(10+r()*24)*density,4);
  for(let i=0;i<50;i++){const x=r()*w,y=h-r()*150*density;for(let j=0;j<9;j++){c.fillStyle='#426653';c.beginPath();c.ellipse(x+(j-4)*6*density,y-j*8*density,18*density,4*density,-.8,0,7);c.fill();}}
  const soft=document.createElement('canvas');soft.width=w;soft.height=h;soft.getContext('2d').drawImage(c.canvas,0,0);c.clearRect(0,0,w,h);c.filter=`blur(${5*density}px)`;c.drawImage(soft,0,0);c.filter='none';
 });
}
const logGeo=new THREE.CylinderGeometry(.19,.24,1,24,8);
const logPositions=logGeo.attributes.position;
for(let i=0;i<logPositions.count;i++){
 const x=logPositions.getX(i),y=logPositions.getY(i),z=logPositions.getZ(i),angle=Math.atan2(z,x),relief=1+.055*Math.sin(angle*7+y*9)+.027*Math.sin(angle*13-y*14);
 logPositions.setX(i,x*relief);logPositions.setZ(i,z*relief);
}
logGeo.computeVertexNormals();
const capGeo=new THREE.CircleGeometry(.2,24),mossGeo=new THREE.SphereGeometry(1,16,8),leafGeo=new THREE.PlaneGeometry(1,2);
const mushroomGeo=new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),stemGeo=new THREE.CylinderGeometry(.1,.14,.26,10);
const bananaPath=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.22,0,0),new THREE.Vector3(0,-.38,0),new THREE.Vector3(.23,.07,0));
const bananaGeo=new THREE.TubeGeometry(bananaPath,22,.068,10,false),fruitVertices=bananaGeo.attributes.position;
for(let i=0;i<fruitVertices.count;i++){
 const t=Math.floor(i/11)/22,center=bananaPath.getPoint(t),taper=.32+.68*Math.pow(Math.sin(Math.PI*t),.45);
 fruitVertices.setXYZ(i,center.x+(fruitVertices.getX(i)-center.x)*taper,center.y+(fruitVertices.getY(i)-center.y)*taper,center.z+(fruitVertices.getZ(i)-center.z)*taper);
}
bananaGeo.computeVertexNormals();
const tipGeo=new THREE.SphereGeometry(.06,7,5),knotGeo=new THREE.TorusGeometry(.09,.027,6,16),thornGeo=new THREE.ConeGeometry(.15,.58,7),hazardCueGeo=new THREE.RingGeometry(.46,.58,24);
const arrowShape=new THREE.Shape();arrowShape.moveTo(-.7,-.25);arrowShape.lineTo(.05,-.25);arrowShape.lineTo(.05,-.65);arrowShape.lineTo(.85,0);arrowShape.lineTo(.05,.65);arrowShape.lineTo(.05,.25);arrowShape.lineTo(-.7,.25);arrowShape.closePath();
const arrowGeo=new THREE.ExtrudeGeometry(arrowShape,{depth:.12,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,steps:1}),dummy=new THREE.Object3D();

export function createScenery(scene,renderer){
 const canopyArt=createCanopyArt(scene),canopyVfx=createCanopyVfx(scene);
 const bark=new THREE.MeshStandardMaterial({color:0xc5a782,map:barkTexture,bumpMap:barkRelief,bumpScale:.055,roughness:.87});
 const moss=new THREE.MeshStandardMaterial({color:0xa8bd79,map:mossTexture,bumpMap:mossRelief,bumpScale:.045,roughness:.96});
 const leaf=new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.35,side:THREE.DoubleSide,roughness:.88});
 const end=new THREE.MeshStandardMaterial({map:endTexture,roughness:.76});
 const woodVariants=[bark,...[0xaf916a,0x9c7856,0xd4b88b].map(color=>{const m=bark.clone();m.color.set(color);return m;})];
 const mossVariants=[moss,...[0x83b65a,0xc1bc68,0x71a778].map(color=>{const m=moss.clone();m.color.set(color);return m;})];
 const dark=new THREE.MeshStandardMaterial({color:0x3f3023,roughness:1});
 const gold=new THREE.MeshStandardMaterial({color:0xffffff,map:bananaTexture,roughness:.33,metalness:.02,emissive:0x5f3800,emissiveIntensity:.18});
 const red=new THREE.MeshStandardMaterial({color:0xffffff,map:mushroomTexture,bumpMap:mushroomTexture,bumpScale:.016,roughness:.38});
 const cream=new THREE.MeshStandardMaterial({color:0xf2e4bf,roughness:.68});
 const gills=new THREE.MeshStandardMaterial({map:gillTexture,bumpMap:gillTexture,bumpScale:.035,roughness:.86,side:THREE.DoubleSide});
 const blue=new THREE.MeshStandardMaterial({color:0x55c4d0,emissive:0x17666f,emissiveIntensity:.35,roughness:.5});
 const leafBright=new THREE.MeshStandardMaterial({map:leafTexture,color:0xb7da77,emissive:0x244918,emissiveIntensity:.2,alphaTest:.35,side:THREE.DoubleSide,roughness:.72});
 const vineGlow=new THREE.MeshStandardMaterial({color:0x6fa45b,emissive:0x183d27,emissiveIntensity:.18,roughness:.86});
 const violet=new THREE.MeshStandardMaterial({color:0xa784ff,emissive:0x472b86,emissiveIntensity:.8,roughness:.38});
 const thorn=new THREE.MeshStandardMaterial({color:0xd8654d,emissive:0x5a180f,emissiveIntensity:.38,roughness:.62});

 // Static menus/results use DOM overlays. Render the WebGL world once when entering a
 // static mode, then sleep GPU rendering until gameplay or a scenery change invalidates it.
 let staticRenderDirty=true,lastRenderMode='';
 const baseRender=renderer.render.bind(renderer);
 const invalidateStaticFrame=()=>{staticRenderDirty=true;};
 renderer.render=(renderScene,renderCamera)=>{
  const mode=document.body?.dataset?.mode||'';
  const active=mode==='playing'||mode==='dying'||mode==='starting';
  if(active){staticRenderDirty=true;lastRenderMode=mode;return baseRender(renderScene,renderCamera);}
  if(staticRenderDirty||mode!==lastRenderMode){staticRenderDirty=false;lastRenderMode=mode;return baseRender(renderScene,renderCamera);}
 };

 // Keep the wrap boundary invisible: no decorative vines hanging from the screen edges.
 let highQuality=false,treeImageMesh=null,platformTemplate=null,platformLoading=false,platformConfig=null,runtimeAssetsActive=false,runtimePrefetchRequested=false,assetHashes=new Map();
 const controlledAssetUrl=asset=>versionedAssetUrl(import.meta.env.BASE_URL+asset,assetHashes.get(asset));
 let activeVisualProfile={profile:'balanced',highScenery:false},visualConstraints={constrained:false};
 const desktopDetailAllowed=()=>allowsDesktopDetail(activeVisualProfile,visualConstraints);
 function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
 function instances(geometry,material,parent,count,place){
  const batch=new THREE.InstancedMesh(geometry,material,count);parent.add(batch);
  for(let i=0;i<count;i++){dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);place(i,dummy);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);}
  batch.castShadow=batch.receiveShadow=true;return batch;
 }

 // Branch groups are expensive because each contains several instanced decorative batches.
 // The game already calls dispose() when a branch leaves the live window; intercept that
 // signal and retain a bounded pool keyed by the branch's exact visual signature.
 const branchPool=new Map();
 const MAX_POOLED_BRANCHES=56;
 let pooledBranchCount=0;
 const variantFor=p=>(Math.imul(p.id+1,2654435761)>>>0)%4;
 const poolKeyFor=(p,variant=variantFor(p))=>[p.type,p.fragile?1:0,p.reward===2?2:1,Number(p.width).toFixed(3),variant].join('|');
 function permanentlyDisposeBranch(group){
  group.traverse(o=>{
   if(!o.isInstancedMesh)return;
   const original=o.userData._poolOriginalDispose;
   if(original)original();else THREE.InstancedMesh.prototype.dispose.call(o);
  });
 }
 function trimBranchPool(){
  while(pooledBranchCount>MAX_POOLED_BRANCHES){
   const entry=[...branchPool.entries()].find(([,items])=>items.length);
   if(!entry)break;
   const [key,items]=entry,group=items.shift();pooledBranchCount--;
   if(!items.length)branchPool.delete(key);
   permanentlyDisposeBranch(group);
  }
 }
 function releaseBranchToPool(group){
  if(group.parent||group.userData._inBranchPool)return;
  const key=group.userData._poolKey;if(!key)return;
  group.visible=false;group.userData._inBranchPool=true;
  const items=branchPool.get(key)||[];items.push(group);branchPool.set(key,items);pooledBranchCount++;trimBranchPool();
 }
 function armBranchPooling(group){
  group.traverse(o=>{
   if(!o.isInstancedMesh||o.userData._poolDisposeWrapped)return;
   const original=o.dispose.bind(o);o.userData._poolDisposeWrapped=true;o.userData._poolOriginalDispose=original;
   o.dispose=()=>{
    if(group.userData._poolReleaseQueued||group.userData._inBranchPool)return;
    group.userData._poolReleaseQueued=true;
    queueMicrotask(()=>{group.userData._poolReleaseQueued=false;releaseBranchToPool(group);});
   };
  });
 }
 function restorePooledBranch(group,p,variant,key){
  group.userData.platformWidth=p.width;group.userData.platformType=p.type;group.userData.fragile=!!p.fragile;group.userData.variant=variant;
  group.userData.impactAt=undefined;group.userData._poolKey=key;group.userData._inBranchPool=false;group.userData._poolReleaseQueued=false;
  group.visible=true;group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.set(1,1,1);
  const authored=group.getObjectByName('authored-branch'),procedural=group.getObjectByName('procedural-branch');
  if(authored)authored.visible=highQuality;
  if(procedural)procedural.visible=!highQuality||!authored;
  applyVisualDetailBudget(group,activeVisualProfile,visualConstraints);
  attachPlatform(group);armBranchPooling(group);return group;
 }

 function attachPlatform(group){
  const special=['leaf','swing','vanish'].includes(group.userData.platformType);
  if(!platformTemplate||special||(group.userData.platformType==='cracked'||group.userData.fragile)||group.getObjectByName('authored-branch'))return;
  const model=platformTemplate.clone(true),authored=new THREE.Group();authored.name='authored-branch';const variant=group.userData.variant||0;
  model.scale.x*=group.userData.platformWidth;model.scale.y*=PLATFORM_SCALE*(.94+variant*.025);model.scale.z*=PLATFORM_SCALE*(.92+(variant%3)*.06);authored.add(model);authored.visible=highQuality;group.add(authored);
  const cushion=mesh(mossGeo,moss,authored,0,-.045*PLATFORM_SCALE,0);cushion.scale.set(group.userData.platformWidth*.48,.045*PLATFORM_SCALE,.28*PLATFORM_SCALE);cushion.receiveShadow=true;
  const width=group.userData.platformWidth;
  instances(mossGeo,moss,authored,9,(i,o)=>{o.position.set((i/8-.5)*width*.88,-.05*PLATFORM_SCALE,Math.sin(i*3)*.16*PLATFORM_SCALE);o.scale.set(.16*PLATFORM_SCALE,.05*PLATFORM_SCALE,.13*PLATFORM_SCALE);});
  instances(leafGeo,leaf,authored,10,(i,o)=>{o.position.set((i/9-.5)*width*.92,-.14*PLATFORM_SCALE,.22*PLATFORM_SCALE);o.scale.set(.10*PLATFORM_SCALE,.16*PLATFORM_SCALE,1);o.rotation.set(.18,Math.sin(i)*.3,Math.sin(i*4)*.8);});
  group.getObjectByName('procedural-branch').visible=!highQuality;armBranchPooling(group);
 }
 function loadPlatform(){
  if(!runtimeAssetsActive||!highQuality||!platformConfig?.platformModel||platformLoading||platformTemplate)return;platformLoading=true;
  new GLTFLoader(createTrackedLoadingManager('environment-glb')).load(controlledAssetUrl(platformConfig.platformModel),gltf=>{
   const model=gltf.scene;model.rotation.set(...(platformConfig.platformRotation||[0,0,0]));model.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0)){console.warn('Invalid branch bounds');platformLoading=false;return;}
   const normalizer=new THREE.Group();normalizer.add(model);normalizer.scale.set(1/size.x,(platformConfig.platformHeight||.42)/size.y,(platformConfig.platformDepth||.65)/size.z);
   model.position.x-=(box.min.x+box.max.x)/2;model.position.z-=(box.min.z+box.max.z)/2;model.position.y-=box.max.y-(platformConfig.landingInset||0)*size.y;
   model.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material?.isMeshStandardMaterial&&!material.map&&!material.vertexColors&&o.geometry.attributes.uv){material.map=barkTexture;material.bumpMap=barkRelief;material.bumpScale=.055;material.roughness=.9;material.metalness=0;material.needsUpdate=true;}}});
   platformTemplate=normalizer;platformLoading=false;const groups=[];scene.traverse(o=>{if(o.userData.platformWidth)groups.push(o);});groups.forEach(attachPlatform);invalidateStaticFrame();
  },undefined,error=>{platformLoading=false;console.warn('Branch GLB unavailable; procedural branches remain.',error.message);});
 }

 const background=new THREE.Group();scene.add(background);

 // Altitude-driven atmosphere accents. These are procedural so the four visual
 // phases remain lightweight while matching the supplied sunny/golden/neon/night references.
 const weatherBackdrop=new THREE.Group();background.add(weatherBackdrop);
 const synthSunTexture=canvasTexture(512,512,(c,w,h)=>{
  c.clearRect(0,0,w,h);const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.42);
  g.addColorStop(0,'#fff0d7');g.addColorStop(.5,'#ff93d8');g.addColorStop(1,'#ff55bd00');
  c.fillStyle=g;c.beginPath();c.arc(w/2,h/2,w*.34,0,Math.PI*2);c.fill();
  c.globalCompositeOperation='destination-out';
  for(let y=h*.48;y<h*.72;y+=24){c.fillStyle='#000';c.fillRect(w*.18,y,w*.64,8);}
  c.globalCompositeOperation='source-over';
 });
 const moonTexture=canvasTexture(512,512,(c,w,h)=>{
  c.clearRect(0,0,w,h);const g=c.createRadialGradient(w*.42,h*.38,8,w/2,h/2,w*.38);
  g.addColorStop(0,'#ffffff');g.addColorStop(.72,'#dbeaff');g.addColorStop(1,'#a7c9ff00');
  c.fillStyle=g;c.beginPath();c.arc(w/2,h/2,w*.3,0,Math.PI*2);c.fill();
  c.globalAlpha=.16;for(let i=0;i<18;i++){const r=rng(900+i),x=w*(.32+r()*.36),y=h*(.32+r()*.36),rr=5+r()*18;c.fillStyle='#6b86aa';c.beginPath();c.arc(x,y,rr,0,Math.PI*2);c.fill();}c.globalAlpha=1;
 });
 const synthSun=new THREE.Mesh(new THREE.PlaneGeometry(5.5,5.5),new THREE.MeshBasicMaterial({map:synthSunTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,fog:false}));
 synthSun.position.z=-7.55;weatherBackdrop.add(synthSun);
 const moon=new THREE.Mesh(new THREE.PlaneGeometry(3.2,3.2),new THREE.MeshBasicMaterial({map:moonTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,fog:false}));
 moon.position.z=-7.5;weatherBackdrop.add(moon);
 const starCount=150,starPositions=new Float32Array(starCount*3),starRng=rng(1337);
 for(let i=0;i<starCount;i++){starPositions[i*3]=(starRng()-.5)*24;starPositions[i*3+1]=(starRng()-.5)*15;starPositions[i*3+2]=-7.6;}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
 const starMaterial=new THREE.PointsMaterial({color:0xddeeff,size:.055,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:false});
 const stars=new THREE.Points(starGeo,starMaterial);weatherBackdrop.add(stars);

 const rainDrops=240,rainPositions=new Float32Array(rainDrops*6);
 const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
 const rainMaterial=new THREE.LineBasicMaterial({color:0xb8dcff,transparent:true,opacity:0,depthWrite:false});
 const rainLines=new THREE.LineSegments(rainGeo,rainMaterial);rainLines.visible=false;rainLines.renderOrder=20;scene.add(rainLines);

 // Full-frame phase treatments make each 400m atmosphere unmistakable even on
 // bright authored backgrounds. They sit in front of the scenic plate, behind gameplay.
 const washGeo=new THREE.PlaneGeometry(1,1);
 const goldenWash=new THREE.Mesh(washGeo,new THREE.MeshBasicMaterial({color:0xff9a35,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false,fog:false}));
 goldenWash.position.z=-7.34;goldenWash.renderOrder=-4;weatherBackdrop.add(goldenWash);
 const neonWashTexture=canvasTexture(256,256,(c,w,h)=>{
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ff1fae');g.addColorStop(.42,'#a42cff');g.addColorStop(1,'#19d8ff');
  c.fillStyle=g;c.fillRect(0,0,w,h);
 });
 const neonWash=new THREE.Mesh(washGeo,new THREE.MeshBasicMaterial({map:neonWashTexture,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false,fog:false,blending:THREE.AdditiveBlending}));
 neonWash.position.z=-7.32;neonWash.renderOrder=-3;weatherBackdrop.add(neonWash);
 const nightWash=new THREE.Mesh(washGeo,new THREE.MeshBasicMaterial({color:0x071a3c,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false,fog:false}));
 nightWash.position.z=-7.30;nightWash.renderOrder=-2;weatherBackdrop.add(nightWash);

 const forest=[],forestTextureCache=new Map();
 const forestTextureFor=(index,scale=1)=>{
  const normalized=scale>1.01?1.5:1,key=`${index}:${normalized}`;
  if(!forestTextureCache.has(key))forestTextureCache.set(key,forestTexture(26+index*16,normalized));
  return forestTextureCache.get(key);
 };
 for(let i=0;i<3;i++){
  const map=forestTextureFor(i,1),material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,color:[0xa7cbbb,0x7caa93,0x466b56][i],opacity:[.3,.38,.48][i],fog:false});
  const layer=new THREE.Mesh(new THREE.PlaneGeometry(38-i*5,32),material);layer.position.z=-22+i*5;layer.renderOrder=-10+i;layer.userData.forestIndex=i;background.add(layer);forest.push(layer);
 }
 function refreshForestTextureQuality(){
  const scale=activeVisualProfile.backgroundMode==='layered-forest'?(activeVisualProfile.backgroundTextureScale||1):1;
  const anisotropy=Math.max(1,Math.round(activeVisualProfile.maxAnisotropy||2));
  for(const layer of forest){
   const map=forestTextureFor(layer.userData.forestIndex,scale);
   if(map.anisotropy!==anisotropy){map.anisotropy=anisotropy;map.needsUpdate=true;}
   if(layer.material.map!==map){layer.material.map=map;layer.material.needsUpdate=true;}
  }
 }
 // The old procedural low-poly trunk and its surrounding ivy have been removed entirely.
 // Every quality preset uses the authored portrait/landscape premium canopy artwork.
 // Quality only changes render cost/effects; the core art direction stays identical.
 let viewWidth=20,viewHeight=14,currentCamera=5;
 let treeCameraOrigin=null,treeClimbOffset=0;
 let treeScrollBias=0,treeRepeatY=1,treeScrollSpeedFactor=1;
 // A soft overlap is required even for the prepared strip: its edges are not pixel-seamless.
 let treeOverlap=.12;
 const treePhase=()=>wrap01(treeClimbOffset*treeRepeatY+treeScrollBias);
 function updateTreeScroll(){
  const factor=document.body?.dataset?.reducedMotion==='true'?.25:1;
  if(factor!==treeScrollSpeedFactor){
   const previous=computeTreeScroll(currentCamera,treeCameraOrigin,viewHeight,treeScrollSpeedFactor);
   const next=computeTreeScroll(currentCamera,treeCameraOrigin,viewHeight,factor);
   treeScrollBias=wrap01(treeScrollBias+(previous-next)*treeRepeatY);
   treeScrollSpeedFactor=factor;
  }
  treeClimbOffset=computeTreeScroll(currentCamera,treeCameraOrigin,viewHeight,treeScrollSpeedFactor);
 }
 function configureTreeMaterial(material){
  material.onBeforeCompile=shader=>{
   shader.uniforms.treeOverlap={value:treeOverlap};
   shader.fragmentShader='uniform float treeOverlap;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
     vec2 treeUV=vMapUv;
     // Increasing V samples higher bark, which moves the image DOWN on screen.
     float treePeriod=1.0-treeOverlap;
     float treeY=treeOverlap+fract(treeUV.y)*treePeriod;
     // Derivatives must come from continuous UVs, before fract/branch, to avoid a mip seam.
     vec2 treeDx=dFdx(vec2(treeUV.x,treeUV.y*treePeriod));
     vec2 treeDy=dFdy(vec2(treeUV.x,treeUV.y*treePeriod));
     vec4 treeSample=textureGrad(map,vec2(treeUV.x,treeY),treeDx,treeDy);
     if(treeOverlap>0.0 && treeY>treePeriod){
      vec4 nextSample=textureGrad(map,vec2(treeUV.x,treeY-treePeriod),treeDx,treeDy);
      treeSample=mix(treeSample,nextSample,smoothstep(treePeriod,1.0,treeY));
     }
     diffuseColor*=treeSample;
    #endif
   `);
  };
  material.customProgramCacheKey=()=>'tree-overlap-v1';
 }
 const treeTextures=new Map(),treeRequests=new Set();
 function refreshBackground(){
  const wantsAuthoredTree=activeVisualProfile.backgroundMode==='authored-tree';
  const authoredTreeReady=wantsAuthoredTree&&!!treeImageMesh?.material.map;
  // Balanced and High use the exact same layered-forest composition. HIGH only
  // raises texture density/filtering/render quality; Ultra swaps to the authored tree.
  forest.forEach((m,i)=>{m.visible=background.visible&&!authoredTreeReady&&i>0;});
  if(treeImageMesh)treeImageMesh.visible=background.visible&&authoredTreeReady;
  invalidateStaticFrame();
 }
 function fitTree(){
  if(!treeImageMesh?.material.map)return;
  const map=treeImageMesh.material.map,image=map.image;
  if(!image?.width||!image?.height)return;
  const viewAspect=viewWidth/viewHeight,imageAspect=image.width/image.height;
  let repeatX=1,repeatY=1;
  if(imageAspect>viewAspect)repeatX=viewAspect/imageAspect;
  else repeatY=imageAspect/viewAspect;

  const coverMode=platformConfig?.treeImageMode==='cover';
  if(coverMode){
   // The premium mountain/canopy paintings are authored scenic plates, not
   // seamless strips. Crop them like CSS background-size: cover and never tile.
   map.wrapS=THREE.ClampToEdgeWrapping;map.wrapT=THREE.ClampToEdgeWrapping;
   map.repeat.set(repeatX,repeatY);
   map.offset.set((1-repeatX)/2,(1-repeatY)/2);
   treeRepeatY=1;
   treeImageMesh.scale.set(viewWidth*1.10,viewHeight*1.10,1);
   treeImageMesh.position.set(0,currentCamera,-8);
   return;
  }

  const oldPhase=treePhase();
  const period=1-treeOverlap;
  repeatY/=period;
  if(treeRepeatY!==repeatY){treeRepeatY=repeatY;treeScrollBias=wrap01(oldPhase-treeClimbOffset*repeatY);}
  const marginX=(1-repeatX)/2,marginY=(.5-treeOverlap)/period-repeatY/2;
  map.wrapS=THREE.ClampToEdgeWrapping;map.wrapT=THREE.RepeatWrapping;
  map.repeat.set(repeatX,repeatY);map.offset.set(marginX,wrap01(marginY+treePhase()));
  treeImageMesh.scale.set(viewWidth*1.04,viewHeight*1.04,1);treeImageMesh.position.set(0,currentCamera,-8);
 }
 function loadTree(){
  if(!runtimeAssetsActive||activeVisualProfile.backgroundMode!=='authored-tree'||!platformConfig?.treeImages)return;const kind=viewWidth>viewHeight?'landscape':'portrait',url=platformConfig.treeImages[kind];if(!url)return;
  if(treeTextures.has(url)){
   if(!treeImageMesh){
    treeImageMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,fog:false,transparent:false,opacity:1,depthWrite:false}));
    if(platformConfig?.treeImageMode!=='cover')configureTreeMaterial(treeImageMesh.material);
    background.add(treeImageMesh);
   }
   treeImageMesh.material.map=treeTextures.get(url);treeImageMesh.material.needsUpdate=true;fitTree();refreshBackground();return;
  }
  if(treeRequests.has(url))return;treeRequests.add(url);
  new THREE.TextureLoader(createTrackedLoadingManager('environment-texture')).load(controlledAssetUrl(url),map=>{
   map.colorSpace=THREE.SRGBColorSpace;
   map.wrapS=THREE.ClampToEdgeWrapping;
   map.wrapT=platformConfig?.treeImageMode==='cover'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
   map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
   map.anisotropy=Math.max(1,Math.round(activeVisualProfile.maxAnisotropy||4));
   treeTextures.set(url,map);treeRequests.delete(url);loadTree();invalidateStaticFrame();
  },undefined,()=>{treeRequests.delete(url);console.warn('Premium background unavailable; layered forest remains.');});
 }
 function prefetchRuntimeAssets(){
  runtimePrefetchRequested=true;
  if(!platformConfig)return;
  if(platformConfig.platformModel)prefetchVisualAsset(controlledAssetUrl(platformConfig.platformModel));
  const kind=viewWidth>viewHeight?'landscape':'portrait',url=platformConfig.treeImages?.[kind];
  if(activeVisualProfile.backgroundMode==='authored-tree'&&url)prefetchVisualAsset(controlledAssetUrl(url));
 }
 Promise.all([
  fetch(import.meta.env.BASE_URL+'environment.json').then(r=>r.ok?r.json():{}),
  fetch(import.meta.env.BASE_URL+'asset-manifest.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
 ]).then(([config,manifest])=>{
  platformConfig=config;
  treeOverlap=Math.max(0,Math.min(.25,Number(config.treeScrollOverlap??.12)||0));
  assetHashes=new Map((manifest.assets||[]).map(asset=>[asset.path,asset.sha256]));
  if(runtimePrefetchRequested)prefetchRuntimeAssets();
  loadPlatform();loadTree();
 }).catch(()=>{});

 const r=rng(51),particleGeo=new THREE.BufferGeometry(),particlePositions=new Float32Array(48*3);particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
 const particleMaterial=new THREE.PointsMaterial({color:0xffdf79,size:.07,transparent:true,opacity:.85,depthWrite:false});
 const particles=new THREE.Points(particleGeo,particleMaterial);particles.frustumCulled=false;particles.visible=false;scene.add(particles);const sparks=[];let lastJetTrailAt=-1;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.4,28),new THREE.MeshBasicMaterial({color:0xd7eca6,transparent:true,opacity:0,depthWrite:false}));ring.visible=false;scene.add(ring);let ringAge=1;

 function branch(p){
  const variant=variantFor(p),key=poolKeyFor(p,variant),items=branchPool.get(key);
  if(items?.length){const group=items.pop();pooledBranchCount--;if(!items.length)branchPool.delete(key);return restorePooledBranch(group,p,variant,key);}
  const branchBark=woodVariants[variant],branchMoss=mossVariants[variant];
  const group=new THREE.Group();group.userData.platformWidth=p.width;group.userData.platformType=p.type;group.userData.fragile=!!p.fragile;group.userData.variant=variant;group.userData._poolKey=key;
  const fallback=new THREE.Group();fallback.name='procedural-branch';fallback.scale.set(1,PLATFORM_SCALE,PLATFORM_SCALE);group.add(fallback);
  if(p.type==='cracked'||p.fragile){
   for(const side of [-1,1]){const wood=mesh(logGeo,branchBark,fallback,side*p.width*.255,-.24);wood.rotation.z=Math.PI/2;wood.scale.set(.82+variant*.03,p.width*.49,.9+variant*.04);wood.castShadow=wood.receiveShadow=true;const splinter=mesh(logGeo,end,fallback,side*.045,-.31,.17);splinter.rotation.z=side*(.25+variant*.12);splinter.scale.set(.19,.38+.05*variant,.16);}
  }else{const wood=mesh(logGeo,branchBark,fallback,0,-.24);wood.rotation.z=Math.PI/2;wood.scale.set(.82+variant*.09,p.width,.82+(3-variant)*.055);wood.castShadow=wood.receiveShadow=true;}
  for(const side of [-1,1]){const cut=mesh(capGeo,end,fallback,side*p.width/2,-.24,0);cut.rotation.y=side*Math.PI/2;const twig=mesh(logGeo,branchBark,fallback,side*(p.width*(.30+variant*.018)),-.36,-.04);twig.scale.set(.34+variant*.035,.44+variant*.05,.34);twig.rotation.z=side*(.88+variant*.12);}
  for(const side of ((p.type==='cracked'||p.fragile)?[-1,1]:[0])){const top=mesh(mossGeo,branchMoss,fallback,side*p.width*.26,-.085);top.scale.set(p.width/(side?4:2),.075+variant*.006,.28+variant*.025);top.receiveShadow=true;}
  const detail=new THREE.Group();fallback.add(detail);detail.visible=desktopDetailAllowed();detail.userData.desktopDetail=true;
  instances(knotGeo,dark,detail,5,(i,o)=>{o.position.set((i/4-.5)*p.width*.85,-.27,.205);o.scale.set(.6+i%2*.25,.5,1);});
  instances(mossGeo,branchMoss,detail,9,(i,o)=>{o.position.set((i/8-.5)*p.width*.9,-.04,-.04+Math.sin(i*4)*.12);o.scale.set(.13,.04,.15);});
  instances(leafGeo,leaf,detail,7,(i,o)=>{o.position.set((i/6-.5)*p.width*.85,-.31,.05);o.scale.set(.11,.22,1);o.rotation.z=(i%2?1:-1)*.6;});
  instances(leafGeo,leaf,fallback,14,(i,o)=>{o.position.set((i/13-.5)*p.width,-.16-Math.sin(i*3.1)*.045,.12);o.rotation.set(.1,Math.sin(i)*.5,Math.sin(i*7+p.id)*.9);o.scale.set(.1,.13+Math.abs(Math.sin(i*2))*.12,1);});

  // High-detail contour work for procedural/special branches. It stays below the
  // landing plane, so silhouettes gain taper, knots and moss without changing physics.
  const organic=new THREE.Group();organic.name='organic-platform-detail';organic.userData.desktopDetail=true;organic.visible=desktopDetailAllowed();fallback.add(organic);
  for(const [side,index] of [[-1,0],[1,1]]){
   const spur=mesh(logGeo,branchBark,organic,side*p.width*(.38+variant*.012),-.3,-.06+index*.03);
   spur.scale.set(.13+variant*.012,.42+variant*.045,.13);spur.rotation.z=side*(.9+variant*.055);spur.rotation.x=side*.09;spur.castShadow=spur.receiveShadow=true;
   const tuft=mesh(mossGeo,branchMoss,organic,side*p.width*.34,-.055,.02-index*.04);
   tuft.scale.set(.28+variant*.025,.045,.18+variant*.015);tuft.rotation.z=side*(.08+variant*.018);tuft.receiveShadow=true;
  }
  instances(knotGeo,end,organic,3,(i,o)=>{o.position.set((i-1)*p.width*.27,-.255,.205);o.rotation.y=Math.PI/2;o.scale.set(.85+i*.08,.75,.7);});
  instances(mossGeo,branchMoss,organic,5,(i,o)=>{o.position.set((i/4-.5)*p.width*.68,-.035,Math.sin(i*2.6)*.105);o.scale.set(.12+.025*(i%2),.035,.12+.02*((i+1)%2));});
  if(p.type==='moving'){
   const paddles=new THREE.Group();group.add(paddles);group.userData.paddles=paddles;
   for(const side of [-1,1]){const fin=mesh(arrowGeo,blue,paddles,side*(p.width*(.34+variant%3*.055)),-.23*PLATFORM_SCALE,.48);fin.rotation.z=side<0?Math.PI:0;fin.scale.setScalar((.22+variant*.012)*PLATFORM_SCALE);}
   instances(knotGeo,cream,group,2+variant%2,(i,o)=>{o.position.set((i?1:-1)*p.width*.3,-.24*PLATFORM_SCALE,0);o.rotation.y=Math.PI/2;o.scale.set(2.4,2.4,1.4);});
  }
  if(p.type==='leaf'){
   const leafPad=new THREE.Group();group.add(leafPad);group.userData.leafPad=leafPad;
   const leafStem=mesh(logGeo,branchBark,leafPad,0,-.22,-.02);leafStem.rotation.z=Math.PI/2;leafStem.scale.set(.12,p.width*.44,.12);leafStem.castShadow=true;
   instances(leafGeo,leafBright,leafPad,11,(i,o)=>{const lane=i%3,row=Math.floor(i/3);o.position.set((lane-1)*p.width*.27+(row%2?-.04:.04),-.03+row*.015,.2-row*.065);o.rotation.set(.18,(lane-1)*.16,(lane-1)*.48+(row-1)*.1);o.scale.set(.31+.035*row,.48+.055*(i%2),1);});
   instances(knotGeo,vineGlow,leafPad,3,(i,o)=>{o.position.set((i-1)*p.width*.24,-.18,.1);o.rotation.x=Math.PI/2;o.scale.set(1.4,1.4,.8);});
  }
  if(p.type==='swing'){
   const swingRig=new THREE.Group();group.add(swingRig);group.userData.swingRig=swingRig;
   instances(knotGeo,cream,swingRig,2,(i,o)=>{o.position.set((i?1:-1)*p.width*.36,.05,.08);o.rotation.x=Math.PI/2;o.scale.set(1.55,1.55,.9);});
   for(const side of [-1,1]){const root=mesh(logGeo,branchBark,swingRig,side*p.width*.35,-.34,-.06);root.scale.set(.08,.28,.08);root.rotation.z=side*.2;root.castShadow=true;}
  }
  if(p.type==='vanish'){
   const vanishGlow=new THREE.Group();group.add(vanishGlow);group.userData.vanishGlow=vanishGlow;
   instances(knotGeo,violet,vanishGlow,5,(i,o)=>{o.position.set((i/4-.5)*p.width*.76,.02,.34);o.rotation.x=Math.PI/2;o.scale.set(1.15,1.15,.8);});
  }
  if(p.type==='cracked'||p.fragile)instances(logGeo,dark,group,3+(variant%2),(i,o)=>{o.position.set((i-(2+(variant%2))/2)*.13*PLATFORM_SCALE,-.19*PLATFORM_SCALE,.38*PLATFORM_SCALE);o.scale.set(.07*PLATFORM_SCALE,.34*PLATFORM_SCALE,.07*PLATFORM_SCALE);o.rotation.z=i%2?-.5:.5;});
  if(p.type==='spring'){
   const mushroom=new THREE.Group();mushroom.scale.setScalar(ITEM_SCALE);group.add(mushroom);group.userData.mushroom=mushroom;
   const stem=mesh(stemGeo,cream,mushroom,0,.12);stem.castShadow=true;const under=mesh(capGeo,gills,mushroom,0,.25);under.rotation.x=-Math.PI/2;under.scale.set(2,1.6,1);
   const cap=mesh(mushroomGeo,red,mushroom,0,.25);cap.scale.set(.40+variant*.018,.17+variant*.028,.32+variant*.025);cap.castShadow=cap.receiveShadow=true;
   instances(mossGeo,cream,mushroom,7,(i,o)=>{const angle=i*2.399,rad=i===0?0:.23;o.position.set(Math.cos(angle)*rad,.25+.23*Math.sqrt(1-(rad/.42)**2),Math.sin(angle)*rad*.8);o.scale.set(.046,.012,.039);o.rotation.z=-Math.cos(angle)*.4;});
   const collar=mesh(knotGeo,cream,mushroom,0,.14);collar.rotation.x=Math.PI/2;collar.scale.set(1.1,1.1,1);
  }
  const coin=new THREE.Group();coin.position.set(0,BANANA_HEIGHT,.18);coin.scale.setScalar(ITEM_SCALE);group.add(coin);const bunches=p.reward===2?2:1,fruitCount=bunches*3;
  function fruitPosition(i,o){const fruit=i%3,bunch=Math.floor(i/3);o.position.set((bunch-(bunches-1)/2)*.56+(fruit-1)*.07,Math.abs(fruit-1)*.035,fruit*.05);o.rotation.z=(fruit-1)*.16;}
  instances(bananaGeo,gold,coin,fruitCount,fruitPosition);const endpoint=new THREE.Vector3();
  instances(tipGeo,dark,coin,fruitCount*2,(i,o)=>{const fruit=Math.floor(i/2);fruitPosition(fruit,o);endpoint.copy(i%2?bananaPath.v2:bananaPath.v0).applyEuler(o.rotation);o.position.add(endpoint);o.scale.set(.56,.8,.62);});
  const roots=new THREE.Group();group.add(roots);instances(logGeo,branchBark,roots,2+variant,(i,o)=>{o.position.set((i/(variant+1)-.5)*p.width*.7,-.48,.02);o.scale.set(.1,.45+((i+variant)%3)*.1,.1);o.rotation.z=Math.sin(i+variant)*.25;});
  const offshoots=new THREE.Group();group.add(offshoots);instances(logGeo,branchBark,offshoots,1+(variant%3),(i,o)=>{const side=i%2?1:-1;o.position.set(side*p.width*(.24+i*.07),-.43,-.08+i*.05);o.scale.set(.11,.34+variant*.055,.11);o.rotation.z=side*(.62+variant*.13+i*.16);});
  group.userData.coin=coin;attachPlatform(group);armBranchPooling(group);return group;
 }

 function hazard(h){
  const group=new THREE.Group();group.userData.hazardId=h.id;group.userData.hazardType=h.type;
  const cueMaterial=new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const cue=mesh(hazardCueGeo,cueMaterial,group,0,0,.28);cue.visible=false;group.userData.telegraph=cue;
  if(h.type==='falling-fruit'){
   const fruit=mesh(mossGeo,gold,group,0,0,.08);fruit.scale.set(.43,.46,.43);
   const crown=mesh(leafGeo,leafBright,group,.12,.34,.1);crown.scale.set(.16,.16,.16);crown.rotation.z=-.65;
   group.userData.body=fruit;
  }else if(h.type==='vine-sweep'){
   const sweep=mesh(logGeo,vineGlow,group,0,0,.04);sweep.rotation.z=Math.PI/2;sweep.scale.set(.13,1.35,.13);group.userData.body=sweep;
   for(let i=-2;i<=2;i++){
    const spike=mesh(thornGeo,thorn,group,i*.28,.12*(i%2),.1);spike.rotation.z=i%2?Math.PI:-.15;spike.scale.set(.55,.7,.55);
   }
  }else if(h.type==='swinging-pod'){
   const cord=mesh(logGeo,vineGlow,group,0,.72,.02);cord.scale.set(.08,.7,.08);
   const core=mesh(mossGeo,thorn,group,0,0,.06);core.scale.set(.42,.42,.36);group.userData.body=core;
   for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,spike=mesh(thornGeo,thorn,group,Math.cos(a)*.34,Math.sin(a)*.34,.09);
    spike.rotation.z=-a+Math.PI/2;spike.scale.set(.55,.72,.55);
   }
  }else{
   for(let i=0;i<7;i++){
    const spike=mesh(thornGeo,thorn,group,(i-3)*.105,-.02+Math.abs(i-3)*.025,.08+(i%2)*.05);
    spike.rotation.z=(i-3)*.12;spike.scale.set(.8+Math.abs(i-3)*.05,1+Math.abs(i-3)*.06,.8);
   }
   const core=mesh(mossGeo,vineGlow,group,0,-.2,.04);core.scale.set(.48,.18,.32);group.userData.body=core;
  }
  return group;
 }

 const mistMap=canvasTexture(128,64,(c,w,h)=>{const gradient=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gradient.addColorStop(0,'#d2efdf77');gradient.addColorStop(1,'#d2efdf00');c.fillStyle=gradient;c.fillRect(0,0,w,h);});
 const mistMaterial=new THREE.MeshBasicMaterial({map:mistMap,transparent:true,depthWrite:false,opacity:0}),mistLayers=new THREE.Group();background.add(mistLayers);
 // One broad feathered mist volume replaces the legacy stacked 22x5 strips that
 // could read as horizontal bands on tall and ultrawide viewports.
 const mistCloud=new THREE.Mesh(new THREE.PlaneGeometry(30,18),mistMaterial);mistCloud.position.set(0,0,-2.7);mistLayers.add(mistCloud);
 let wrapAge=1;const wrapCues=new THREE.Group();wrapCues.visible=false;scene.add(wrapCues);const cueMaterial=new THREE.MeshBasicMaterial({color:0xb9ffdb,transparent:true,opacity:0,depthWrite:false});
 for(const side of [-1,1]){const cue=new THREE.Mesh(new THREE.RingGeometry(.26,.32,20),cueMaterial);cue.position.x=side*(WIDTH/2-VINE_INSET);cue.position.z=.8;wrapCues.add(cue);}
 const forestTint=new THREE.Color(0x25483e);
 const treeThemeTints=[0xffffff,0xffb75f,0xe04dff,0x4f78bd].map(value=>new THREE.Color(value));
 const treeTint=new THREE.Color();
 const treeTintStrength=[0,.48,.66,.72];

 return {branch,hazard,
  animateBranch(group,p,time){
   const reducedMotion=document.body?.dataset?.reducedMotion==='true',impact=group.userData.impactAt===undefined?10:time-group.userData.impactAt;
   const impactDip=reducedMotion?0:Math.sin(Math.min(1,impact/.25)*Math.PI)*.06;
   const leafBob=!reducedMotion&&p.type==='leaf'?Math.sin(time*2.15+p.phase)*.11:0;
   group.position.y=p.y-impactDip+leafBob;
   group.rotation.z=!reducedMotion&&p.type==='leaf'?Math.sin(time*1.5+p.phase)*.025:!reducedMotion&&p.type==='swing'?Math.sin(time*.92+p.phase)*.045:0;
   const paddles=group.userData.paddles;if(paddles){paddles.position.x=reducedMotion?0:Math.sin(time*(p.moveSpeed||1)*3+p.phase)*.045;paddles.scale.y=reducedMotion?1:1+Math.sin(time*3+p.phase)*.06;}
   const mushroom=group.userData.mushroom;if(mushroom){const pulse=reducedMotion?0:Math.sin(time*2+p.id)*.035;mushroom.scale.set(ITEM_SCALE*(1-pulse*.45),ITEM_SCALE*(1+pulse),ITEM_SCALE*(1-pulse*.45));}
   const vanishGlow=group.userData.vanishGlow;if(vanishGlow){const armed=p.vanishAt!==null,pulse=reducedMotion?0:(.08+.07*Math.sin(time*10));vanishGlow.scale.setScalar(armed?1+pulse:1);vanishGlow.visible=!p.broken;}
   const leafPad=group.userData.leafPad;if(leafPad&&!reducedMotion)leafPad.rotation.y=Math.sin(time*.9+p.phase)*.055;
   const swingRig=group.userData.swingRig;if(swingRig&&!reducedMotion)swingRig.rotation.z=-group.rotation.z*.7;
  },
  animateHazard(group,h,time){
   const reducedMotion=document.body?.dataset?.reducedMotion==='true',telegraph=group.userData.telegraph;
   group.position.set(h.x,h.y,0);
   if(h.type==='swinging-pod')group.rotation.z=reducedMotion?0:Math.sin(time*1.2+h.phase)*.12;
   else if(h.type==='vine-sweep')group.rotation.z=reducedMotion?0:Math.sin(time*5+h.phase)*.025;
   else group.rotation.z=reducedMotion?0:Math.sin(time*2.1+h.phase)*.08;
   const pulse=reducedMotion?1:1+Math.sin(time*3.4+h.phase)*.035;group.scale.setScalar(pulse);
   if(telegraph){
    telegraph.visible=!!h.telegraphing;
    telegraph.position.y=h.type==='falling-fruit'?(h.baseY-h.y):0;
    telegraph.material.opacity=h.telegraphing ? .62 : 0;
    if(h.telegraphing&&!reducedMotion){const cuePulse=1+Math.sin(time*8)*.16;telegraph.scale.setScalar(cuePulse);}
   }
  },
  setPixelMode(enabled){background.visible=!enabled;canopyArt.setVisible(!enabled);refreshBackground();},
  get platformReady(){return !!platformTemplate;},
  get backgroundReady(){return forest.some(m=>m.visible)||!!treeImageMesh?.visible;},
  get treeVisible(){return forest.some(m=>m.visible)||!!treeImageMesh?.visible;},
  get treeClimbOffset(){return treeClimbOffset;},
  get treeScrollDiagnostics(){return {
   treeScrollNormalized:treePhase(),treeScrollScreens:Math.max(0,currentCamera-(treeCameraOrigin??currentCamera))/Math.max(.001,viewHeight),
   treeScrollSpeedFactor,treeWrapEnabled:treeImageMesh?.material.map?.wrapT===THREE.RepeatWrapping,
   treeTextureKind:treeImageMesh?.material.map?(platformConfig?.treeImageMode==='cover'?'premium-cover':'overlap-strip'):'forest-fallback',
   treeCameraOrigin,treeMeshY:treeImageMesh?.position.y??null,treeCameraY:currentCamera,
   backgroundMode:activeVisualProfile.backgroundMode||'layered-forest',
   forestTextureScale:activeVisualProfile.backgroundTextureScale||1,
   forestVisibleLayers:forest.filter(m=>m.visible).length,
   treeAuthoredVisible:!!treeImageMesh?.visible,treeFallbackVisible:forest.some(m=>m.visible),
   treeMistVisible:!!mistLayers.visible&&mistMaterial.opacity>.001,
   treeMaterialOpacity:treeImageMesh?.material?.opacity??null,
   treeMaterialTransparent:treeImageMesh?.material?.transparent??null,
   treeAnisotropy:treeImageMesh?.material?.map?.anisotropy??0,
   treeTextureOffset:treeImageMesh?.material.map?.offset.y??0
  };},
  get pooledBranches(){return pooledBranchCount;},
  prefetchRuntimeAssets,
  prepareRuntimeAssets(){
   runtimeAssetsActive=true;
   loadPlatform();
   loadTree();
   invalidateStaticFrame();
  },
  resize(width,height){const phase=treePhase();viewWidth=Math.max(.001,width);viewHeight=Math.max(.001,height);updateTreeScroll();treeScrollBias=wrap01(phase-treeClimbOffset*treeRepeatY);if(runtimePrefetchRequested)prefetchRuntimeAssets();loadTree();fitTree();invalidateStaticFrame();},
  burst(event){
   if(document.body?.dataset?.reducedMotion==='true')return;
   canopyVfx.burst(event);
   const colors={spring:0xffb94f,leaf:0xaee77b,swing:0x77d9c7,vanish:0xb792ff,cracked:0xe8b271,hazard:0xff765f,jet:0x7cecff,milestone:0xffe47a,coin:0xffdf79};
   const key=event.type==='hazard'?'hazard':event.type==='jet'?'jet':event.type==='milestone'?'milestone':event.type==='coin'?'coin':event.platformType||'';
   ring.material.color.setHex(colors[key]||0xd7eca6);
   if(event.type==='bounce'){ring.position.set(event.x,event.y+.08,.6);ringAge=0;ring.visible=true;}
   if(event.type==='wrap'){wrapAge=0;wrapCues.position.y=event.y+.7;wrapCues.visible=true;}
  },
  jetTrail(x,y,time){
   if(document.body?.dataset?.reducedMotion==='true'||time-lastJetTrailAt<.045)return;
   lastJetTrailAt=time;canopyVfx.jetTrail(x,y);
  },
  update(cameraY,time,dt,palette,night,biome=0,blend=1,weather={}){
   const mode=document.body?.dataset?.mode||'',active=mode==='playing'||mode==='dying'||mode==='starting';
   if(!active&&!staticRenderDirty)return;
   currentCamera=cameraY;
   if(treeCameraOrigin===null)treeCameraOrigin=cameraY;
   updateTreeScroll();
   canopyArt.update(cameraY,time,palette,night,background.visible);
   canopyVfx.update(dt);
   if(background.visible){
    forest.forEach((m,i)=>{if(!m.visible)return;m.position.x=Math.sin(time*(.035+i*.012)+i*1.7)*(.18+i*.22);m.position.y=cameraY+2-Math.sin(cameraY*(.009+i*.003))*(i+1.35);m.material.color.copy(palette).lerp(forestTint,.4+i*.12);});
    if(treeImageMesh?.visible){
     fitTree();
     const coverMode=platformConfig?.treeImageMode==='cover';
     const reduced=document.body?.dataset?.reducedMotion==='true';
     // Camera-locked scenic cover with only a restrained distant parallax drift.
     treeImageMesh.position.x=coverMode&&!reduced?Math.sin(cameraY*.008)*viewWidth*.012:0;
     treeImageMesh.position.y=currentCamera+(coverMode&&!reduced?Math.sin(cameraY*.011)*viewHeight*.012:0);
     // The authored tropical background is opaque, so the DOM gradient behind it
     // cannot communicate biome changes. Tint the scenic plate itself while
     // preserving its texture detail and smooth four-theme transition.
     const previousBiome=(biome+3)%4;
     treeTint.copy(treeThemeTints[previousBiome]).lerp(treeThemeTints[biome],blend);
     const tintAmount=THREE.MathUtils.lerp(treeTintStrength[previousBiome],treeTintStrength[biome],blend);
     treeImageMesh.material.color.set(0xffffff).lerp(treeTint,tintAmount);
    }
    const phaseFrom=Number.isFinite(weather.from)?weather.from:Math.max(0,biome-1),phaseTo=Number.isFinite(weather.to)?weather.to:biome;
    const phaseWeight=index=>phaseFrom===phaseTo?(phaseFrom===index?1:0):(phaseFrom===index?1-blend:0)+(phaseTo===index?blend:0);
    const goldenWeight=phaseWeight(1),neonWeight=phaseWeight(2),nightWeight=phaseWeight(3),weatherMist=Math.max(0,Math.min(1,Number(weather.mist)||0));
    weatherBackdrop.position.y=cameraY;
    const washWidth=viewWidth*1.18,washHeight=viewHeight*1.18;
    goldenWash.scale.set(washWidth,washHeight,1);goldenWash.material.opacity=goldenWeight*.34;goldenWash.visible=goldenWash.material.opacity>.01;
    neonWash.scale.set(washWidth,washHeight,1);neonWash.material.opacity=neonWeight*.30;neonWash.visible=neonWash.material.opacity>.01;
    nightWash.scale.set(washWidth,washHeight,1);nightWash.material.opacity=nightWeight*.52;nightWash.visible=nightWash.material.opacity>.01;
    synthSun.position.set(0,viewHeight*.29,-7.20);synthSun.material.opacity=neonWeight*.98;synthSun.visible=synthSun.material.opacity>.01;
    moon.position.set(-viewWidth*.27,viewHeight*.31,-7.18);moon.material.opacity=nightWeight*.98;moon.visible=moon.material.opacity>.01;
    stars.position.set(0,0,0);starMaterial.opacity=nightWeight*.95;stars.visible=starMaterial.opacity>.01;
    mistLayers.position.y=cameraY;mistLayers.position.x=Math.sin(time*.09)*1.4;
    mistMaterial.opacity=.08+weatherMist*.34;
    mistLayers.visible=mistMaterial.opacity>.015;
    moss.roughness=.96-weatherMist*.18;bark.roughness=.87-weatherMist*.12;

    const rain=Math.max(0,Math.min(1,Number(weather.rain)||0));
    rainLines.visible=rain>.01;rainMaterial.opacity=.08+rain*.62;
    if(rainLines.visible){
     const spanX=viewWidth*1.18,spanY=viewHeight*1.35,fall=time*(.78+rain*.48);
     for(let i=0;i<rainDrops;i++){
      const seedX=((i*.61803398875)%1),seedY=((i*.38196601125)%1);
      const x=(seedX-.5)*spanX+Math.sin(i*1.71)*.18;
      const localY=((seedY-fall*(.72+(i%7)*.035))%1+1)%1;
      const y=cameraY+(localY-.5)*spanY;
      const len=.22+rain*.36+(i%5)*.035,drift=.045+rain*.09;
      const o=i*6;rainPositions[o]=x;rainPositions[o+1]=y;rainPositions[o+2]=1.6;rainPositions[o+3]=x+drift;rainPositions[o+4]=y-len;rainPositions[o+5]=1.6;
     }
     rainGeo.attributes.position.needsUpdate=true;
    }
   }else{mistLayers.visible=false;rainLines.visible=false;}
   wrapAge+=dt;if(wrapAge<.45){wrapCues.visible=true;cueMaterial.opacity=Math.max(0,1-wrapAge/.4)*.7;for(const cue of wrapCues.children)cue.scale.setScalar(1+Math.min(wrapAge,1)*2);}else{wrapCues.visible=false;cueMaterial.opacity=0;}
   ringAge+=dt;if(ringAge<.3){ring.visible=true;ring.material.opacity=Math.max(0,1-ringAge*4)*.65;ring.scale.setScalar(1+ringAge*3);}else{ring.visible=false;ring.material.opacity=0;}
   if(sparks.length){for(const s of sparks){s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy-=3*dt;}while(sparks.length&&(sparks[0].age>.7||sparks.length>48))sparks.shift();if(sparks.length){for(let i=0;i<48;i++){const s=sparks[i];particlePositions[i*3]=s?s.x:0;particlePositions[i*3+1]=s?s.y:-10000;particlePositions[i*3+2]=s?s.z:0;}particleGeo.attributes.position.needsUpdate=true;particles.visible=true;}else particles.visible=false;}
  },
  reset(){sparks.length=0;particles.visible=false;canopyVfx.reset();canopyArt.reset();ringAge=1;ring.visible=false;wrapAge=1;wrapCues.visible=false;cueMaterial.opacity=0;lastJetTrailAt=-1;treeCameraOrigin=null;treeClimbOffset=0;treeScrollBias=0;treeScrollSpeedFactor=document.body?.dataset?.reducedMotion==='true'?.25:1;synthSun.visible=false;moon.visible=false;stars.visible=false;goldenWash.visible=false;neonWash.visible=false;nightWash.visible=false;rainLines.visible=false;rainMaterial.opacity=0;fitTree();invalidateStaticFrame();},
  setQuality(profile,options={}){
   activeVisualProfile=typeof profile==='object'&&profile?profile:{profile:profile?'high':'balanced',highScenery:!!profile};
   visualConstraints={constrained:!!options.constrained};
   highQuality=!!activeVisualProfile.highScenery&&!visualConstraints.constrained;
   canopyArt.setQuality(activeVisualProfile,visualConstraints);
   canopyVfx.setQuality(activeVisualProfile);
   for(const texture of treeTextures.values()){
    const anisotropy=Math.max(1,Math.round(activeVisualProfile.maxAnisotropy||4));
    if(texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
   }
   refreshForestTextureQuality();
   loadPlatform();loadTree();
   scene.traverse(o=>{
    if(o.name==='authored-branch')o.visible=highQuality;
    if(o.name==='procedural-branch')o.visible=!highQuality||!o.parent.getObjectByName('authored-branch');
   });
   applyVisualDetailBudget(scene,activeVisualProfile,visualConstraints);
   refreshBackground();invalidateStaticFrame();
  },
  invalidateRender(){invalidateStaticFrame();}
 };
}
