import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WIDTH, PLATFORM_SCALE, ITEM_SCALE} from './physics.js';

// All scenery is generated locally. Shared geometry, instanced leaves and small
// reusable textures keep the forest independent of downloaded art packs.
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function canvasTexture(w,h,draw){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 draw(canvas.getContext('2d'),w,h);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=4;return texture;
}
function surface(kind){
 return canvasTexture(512,512,(c,w,h)=>{
  const r=rng(kind==='bark'?72:53);
  c.fillStyle=kind==='bark'?'#8b7157':'#739654';c.fillRect(0,0,w,h);
  for(let i=0;i<24000;i++){
   const v=r(),x=r()*w,y=r()*h;
   c.fillStyle=kind==='bark'?(v>.5?'#ccb48a':'#372f26'):(v>.5?'#c6cc75':'#264828');
   c.globalAlpha=.08+r()*.24;
   c.fillRect(x,y,kind==='bark'?.5+r()*2:1+r()*3,kind==='bark'?6+r()*60:1+r()*3);
  }
  c.globalAlpha=.6;
  if(kind==='bark')for(let i=0;i<90;i++){
   const x=r()*w;c.strokeStyle=i%3?'#55422f':'#d0b489';c.lineWidth=.5+r()*2;
   c.beginPath();c.moveTo(x,0);for(let y=0;y<=h;y+=8)c.lineTo(x+Math.sin(y*.02+i)*3+Math.sin(y*.08)*1.5,y);c.stroke();
  }
  c.globalAlpha=1;
 });
}
const barkTexture=surface('bark'),mossTexture=surface('moss');
barkTexture.wrapS=barkTexture.wrapT=mossTexture.wrapS=mossTexture.wrapT=THREE.RepeatWrapping;
const leafTexture=canvasTexture(128,256,(c)=>{
 const g=c.createLinearGradient(20,20,100,220);g.addColorStop(0,'#cedd86');g.addColorStop(.4,'#709446');g.addColorStop(1,'#183d29');
 c.fillStyle=g;c.beginPath();c.moveTo(64,5);c.bezierCurveTo(130,50,125,165,64,250);c.bezierCurveTo(2,162,5,50,64,5);c.fill();
 c.strokeStyle='#e0e6a766';c.lineWidth=2;c.beginPath();c.moveTo(64,12);c.lineTo(64,246);c.stroke();
 for(let y=45;y<220;y+=22){c.beginPath();c.moveTo(64,y+18);c.lineTo(20,y-12);c.moveTo(64,y+18);c.lineTo(108,y-12);c.stroke();}
});
const endTexture=canvasTexture(512,512,(c,w,h)=>{
 const r=rng(118),grain=c.createRadialGradient(244,264,8,256,256,260);
 grain.addColorStop(0,'#e5c18b');grain.addColorStop(.75,'#b88852');grain.addColorStop(1,'#715031');c.fillStyle=grain;c.fillRect(0,0,w,h);
 for(let radius=12;radius<270;radius+=6+r()*5){
  c.strokeStyle=radius%3>1?'#65422c65':'#f5d8a76b';c.lineWidth=1+r()*2;c.beginPath();
  for(let i=0;i<=128;i++){const a=i/128*Math.PI*2,rr=radius+Math.sin(a*5+radius)*2.3;const x=244+Math.cos(a)*rr,y=264+Math.sin(a)*rr*.96;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
 }
 c.strokeStyle='#4a302585';c.lineWidth=2;
 for(let i=0;i<7;i++){const a=r()*Math.PI*2;c.beginPath();for(let j=0;j<5;j++){const radius=170+j*22,x=244+Math.cos(a+j*.013)*radius,y=264+Math.sin(a+j*.013)*radius;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
});
const bananaTexture=canvasTexture(512,128,(c,w,h)=>{
 const r=rng(423),g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#b58a10');g.addColorStop(.24,'#ffd22c');g.addColorStop(.5,'#fff39a');g.addColorStop(.8,'#efb515');g.addColorStop(1,'#b98507');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<110;i++){c.fillStyle='#825222';c.globalAlpha=.05+r()*.14;c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}c.globalAlpha=1;
 for(const y of [21,60,103]){c.strokeStyle='#fff1a14a';c.lineWidth=2;c.beginPath();c.moveTo(0,y);c.lineTo(w,y+3);c.stroke();}
});
const mushroomTexture=canvasTexture(512,256,(c,w,h)=>{
 const r=rng(205),g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f47746');g.addColorStop(.6,'#d44329');g.addColorStop(1,'#8e231d');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<23;i++){const x=r()*w,y=25+r()*(h-60),radius=5+r()*11;c.fillStyle='#6b281f44';c.beginPath();c.ellipse(x,y+3,radius*1.13,radius*.82,0,0,7);c.fill();c.fillStyle=i%3?'#ffe9bb':'#fff6d9';c.beginPath();c.ellipse(x,y,radius,radius*.8,r()*.4,0,7);c.fill();}
});
const gillTexture=canvasTexture(256,256,(c)=>{
 c.fillStyle='#e0cfa6';c.fillRect(0,0,256,256);for(let i=0;i<96;i++){const a=i/96*Math.PI*2;c.strokeStyle=i%2?'#9b76594d':'#fff8d391';c.lineWidth=1;c.beginPath();c.moveTo(128+Math.cos(a)*25,128+Math.sin(a)*25);c.lineTo(128+Math.cos(a)*128,128+Math.sin(a)*128);c.stroke();}
});
function forestTexture(seed){
 return canvasTexture(1024,1536,(c,w,h)=>{
  const r=rng(seed);
  function limb(x,y,len,angle,width,depth){
   angle=Math.max(-1.15,Math.min(1.15,angle));
   const nx=x+Math.sin(angle)*len,ny=y-Math.cos(angle)*len;
   c.strokeStyle='#42675c';c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.sin(angle-.2)*len*.5,y-Math.cos(angle)*len*.5,nx,ny);c.stroke();
   if(depth>0){limb(nx,ny,len*(.62+r()*.13),angle-.42-r()*.25,width*.62,depth-1);limb(nx,ny,len*(.6+r()*.17),angle+.3+r()*.4,width*.6,depth-1);}
   else for(let j=0;j<26;j++){c.fillStyle=['#476e59','#52765a','#638863','#88a371'][Math.floor(r()*4)];c.beginPath();c.ellipse(nx+(r()-.5)*95,ny+(r()-.5)*55,10+r()*17,4+r()*9,r()*3,0,Math.PI*2);c.fill();}
  }
  for(let i=0;i<5;i++)limb((i+.3+r()*.3)*w/5,h+100,300+r()*400,(r()-.5)*.15,10+r()*24,4);
  // Fern-like foreground at each tree layer's base.
  for(let i=0;i<50;i++){const x=r()*w,y=h-r()*150;for(let j=0;j<9;j++){c.fillStyle='#426653';c.beginPath();c.ellipse(x+(j-4)*6,y-j*8,18,4,-.8,0,7);c.fill();}}
  const soft=document.createElement('canvas');soft.width=w;soft.height=h;soft.getContext('2d').drawImage(c.canvas,0,0);
  c.clearRect(0,0,w,h);c.filter='blur(5px)';c.drawImage(soft,0,0);c.filter='none';
 });
}
const logGeo=new THREE.CylinderGeometry(.19,.24,1,24,8);
// Shared carved silhouette catches directional light even on the fallback logs.
const logPositions=logGeo.attributes.position;
for(let i=0;i<logPositions.count;i++){
 const x=logPositions.getX(i),y=logPositions.getY(i),z=logPositions.getZ(i),angle=Math.atan2(z,x);
 const relief=1+.055*Math.sin(angle*7+y*9)+.027*Math.sin(angle*13-y*14);
 logPositions.setX(i,x*relief);logPositions.setZ(i,z*relief);
}logGeo.computeVertexNormals();
const capGeo=new THREE.CircleGeometry(.2,24);
const mossGeo=new THREE.SphereGeometry(1,16,8);
const leafGeo=new THREE.PlaneGeometry(1,2);
const mushroomGeo=new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2);
const stemGeo=new THREE.CylinderGeometry(.1,.14,.26,10);
const bananaPath=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.22,0,0),new THREE.Vector3(0,-.38,0),new THREE.Vector3(.23,.07,0));
const bananaGeo=new THREE.TubeGeometry(bananaPath,22,.068,10,false);
const tipGeo=new THREE.SphereGeometry(.06,7,5);
const knotGeo=new THREE.TorusGeometry(.09,.027,6,16);
const dummy=new THREE.Object3D();
export function createScenery(scene,renderer){
 const bark=new THREE.MeshStandardMaterial({color:0xa7977d,map:barkTexture,bumpMap:barkTexture,bumpScale:.09,roughness:.97});
 const moss=new THREE.MeshStandardMaterial({color:0xabc788,map:mossTexture,bumpMap:mossTexture,bumpScale:.05,roughness:.94});
 const leaf=new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.35,side:THREE.DoubleSide,roughness:.88});
 const end=new THREE.MeshStandardMaterial({map:endTexture,bumpMap:endTexture,bumpScale:.025,roughness:.84});
 const dark=new THREE.MeshStandardMaterial({color:0x3f3023,roughness:1});
 const gold=new THREE.MeshStandardMaterial({color:0xffffff,map:bananaTexture,roughness:.33,metalness:.02,emissive:0x5f3800,emissiveIntensity:.18});
 const red=new THREE.MeshStandardMaterial({color:0xffffff,map:mushroomTexture,bumpMap:mushroomTexture,bumpScale:.016,roughness:.38});
 const cream=new THREE.MeshStandardMaterial({color:0xf2e4bf,roughness:.68});
 const gills=new THREE.MeshStandardMaterial({map:gillTexture,bumpMap:gillTexture,bumpScale:.035,roughness:.86,side:THREE.DoubleSide});
 const blue=new THREE.MeshStandardMaterial({color:0x55c4d0,emissive:0x17666f,emissiveIntensity:.35,roughness:.5});
 // Screen-edge collision vines are true lit 3D geometry, with braided stems and leaves.
 const edgeVines=new THREE.Group();scene.add(edgeVines);
 const vineMaterial=new THREE.MeshStandardMaterial({color:0x365830,map:barkTexture,bumpMap:barkTexture,bumpScale:.13,roughness:.9});
 const vineMoss=new THREE.MeshStandardMaterial({color:0x7ca852,map:mossTexture,bumpMap:mossTexture,bumpScale:.08,roughness:.92});
 for(const side of [-1,1]){
  for(let strand=0;strand<3;strand++){
   const points=[];
   for(let i=0;i<=20;i++){const y=-13+i*1.3;points.push(new THREE.Vector3(side*(WIDTH/2+.02+strand*.045+Math.sin(i*.92+strand)*.07),y,.35+strand*.08+Math.cos(i*.73)*.035));}
   const vine=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),120,.075-strand*.012,9,false),strand===1?vineMoss:vineMaterial);vine.castShadow=vine.receiveShadow=true;edgeVines.add(vine);
  }
  for(let i=0;i<28;i++){
   const y=-12.2+i*.92,leafMesh=new THREE.Mesh(leafGeo,leaf);
   leafMesh.position.set(side*(WIDTH/2-.02+Math.sin(i*1.7)*.09),y,.48);
   leafMesh.rotation.set(.15,side*.28,side*(.7+Math.sin(i*.8)*.35));leafMesh.scale.set(.13,.24+Math.sin(i)*.035,1);edgeVines.add(leafMesh);
  }
 }
 let highQuality=false,treeImageMesh=null,platformTemplate=null,platformLoading=false,platformConfig=null;
 function attachPlatform(group){
  if(!platformTemplate||group.getObjectByName('authored-branch'))return;
  const model=platformTemplate.clone(true),authored=new THREE.Group();authored.name='authored-branch';
  model.scale.x*=group.userData.platformWidth;model.scale.y*=PLATFORM_SCALE;model.scale.z*=PLATFORM_SCALE;authored.add(model);authored.visible=highQuality;group.add(authored);
  // Uploaded wood has no moss: keep a low, readable landing cushion.
  const cushion=mesh(mossGeo,moss,authored,0,-.045*PLATFORM_SCALE,0);cushion.scale.set(group.userData.platformWidth*.48,.045*PLATFORM_SCALE,.28*PLATFORM_SCALE);cushion.receiveShadow=true;
  // Small instanced clumps break up the authored branch silhouette without extra materials.
  const width=group.userData.platformWidth;
  instances(mossGeo,moss,authored,9,(i,o)=>{o.position.set((i/8-.5)*width*.88,-.05*PLATFORM_SCALE,Math.sin(i*3)*.16*PLATFORM_SCALE);o.scale.set(.16*PLATFORM_SCALE,.05*PLATFORM_SCALE,.13*PLATFORM_SCALE);});
  instances(leafGeo,leaf,authored,10,(i,o)=>{o.position.set((i/9-.5)*width*.92,-.14*PLATFORM_SCALE,.22*PLATFORM_SCALE);o.scale.set(.10*PLATFORM_SCALE,.16*PLATFORM_SCALE,1);o.rotation.set(.18,Math.sin(i)*.3,Math.sin(i*4)*.8);});
  group.getObjectByName('procedural-branch').visible=!highQuality;
 }
 function loadPlatform(){
  if(!highQuality||!platformConfig?.platformModel||platformLoading)return;
  platformLoading=true;
  new GLTFLoader().load(import.meta.env.BASE_URL+platformConfig.platformModel,gltf=>{
   const model=gltf.scene;
   model.rotation.set(...(platformConfig.platformRotation||[0,0,0]));
   model.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
   if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0)){console.warn('Invalid branch bounds');return;}
   const normalizer=new THREE.Group();normalizer.add(model);
   normalizer.scale.set(1/size.x,(platformConfig.platformHeight||.42)/size.y,(platformConfig.platformDepth||.65)/size.z);
   model.position.x-=(box.min.x+box.max.x)/2;
   model.position.z-=(box.min.z+box.max.z)/2;
   model.position.y-=box.max.y-(platformConfig.landingInset||0)*size.y;
   model.traverse(o=>{if(o.isMesh){
    o.castShadow=o.receiveShadow=true;
    for(const material of (Array.isArray(o.material)?o.material:[o.material])){
     if(material?.isMeshStandardMaterial&&!material.map&&!material.vertexColors&&o.geometry.attributes.uv){
      material.map=barkTexture;material.bumpMap=barkTexture;material.bumpScale=.045;material.roughness=.9;material.metalness=0;material.needsUpdate=true;
     }
    }
   }});
   platformTemplate=normalizer;
   const groups=[];scene.traverse(o=>{if(o.userData.platformWidth)groups.push(o);});groups.forEach(attachPlatform);
  },undefined,error=>console.warn('Branch GLB unavailable; procedural branches remain.',error.message));
 }
 const background=new THREE.Group();scene.add(background);
 const forest=[];
 for(let i=0;i<3;i++){
  const map=forestTexture(26+i*16);
  const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,color:[0xa7cbbb,0x7caa93,0x466b56][i],opacity:[.3,.38,.48][i],fog:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(38-i*5,32),material);
  mesh.position.z=-22+i*5;mesh.renderOrder=-10+i;background.add(mesh);forest.push(mesh);
 }
 const trunkGeo=new THREE.CylinderGeometry(1.13,1.22,40,24,30);
 const pos=trunkGeo.attributes.position;
 for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)+Math.sin(y*.16)*.28);pos.setZ(i,pos.getZ(i)+Math.sin(y*.23)*.12);}
 trunkGeo.computeVertexNormals();
 // Carved bark silhouette for desktop, sharing one material.
 const detailedTrunkGeo=trunkGeo.clone();
 const detailedPos=detailedTrunkGeo.attributes.position;
 for(let i=0;i<detailedPos.count;i++){
  const x=detailedPos.getX(i),y=detailedPos.getY(i),z=detailedPos.getZ(i);
  const angle=Math.atan2(z,x-Math.sin(y*.16)*.28);
  const relief=.065*Math.sin(angle*11+y*.18)+.025*Math.sin(angle*19-y*.7);
  detailedPos.setX(i,x+Math.cos(angle)*relief);detailedPos.setZ(i,z+Math.sin(angle)*relief);
 }detailedTrunkGeo.computeVertexNormals();
 const trunk=new THREE.Mesh(trunkGeo,bark);trunk.position.set(.35,0,-4);trunk.receiveShadow=true;background.add(trunk);
 // The corrected full background is fitted by aspect ratio and repeats in world Y.
 let viewWidth=20,viewHeight=14,currentCamera=5;
 const treeTextures=new Map(),treeRequests=new Set();
 function refreshBackground(){
  const active=highQuality&&!!treeImageMesh?.material.map;
  trunk.visible=highQuality&&!active;ivy.visible=highQuality&&!active;
  forest.forEach((m,i)=>{m.visible=!active&&(highQuality||i>0);});
  if(treeImageMesh)treeImageMesh.visible=active;
 }
 function fitTree(){
  if(!treeImageMesh?.material.map)return;
  const map=treeImageMesh.material.map,tileHeight=viewWidth*map.image.height/map.image.width;
  treeImageMesh.scale.set(viewWidth,viewHeight+4,1);
  treeImageMesh.position.set(0,currentCamera,-4);
  map.repeat.set(1,(viewHeight+4)/tileHeight);
  map.offset.y=(currentCamera-(viewHeight+4)/2)/tileHeight;
 }
 function loadTree(){
  if(!highQuality||!platformConfig?.treeImages)return;
  const kind=viewWidth>viewHeight?'landscape':'portrait',url=platformConfig.treeImages[kind];
  if(!url)return;
  if(treeTextures.has(kind)){
   if(!treeImageMesh){treeImageMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xd4d4d4,toneMapped:false,fog:false}));background.add(treeImageMesh);}
   treeImageMesh.material.map=treeTextures.get(kind);treeImageMesh.material.needsUpdate=true;
   fitTree();refreshBackground();return;
  }
  if(treeRequests.has(kind))return;treeRequests.add(kind);
  new THREE.TextureLoader().load(import.meta.env.BASE_URL+url,map=>{
   map.colorSpace=THREE.SRGBColorSpace;map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
   treeTextures.set(kind,map);loadTree();
  },undefined,()=>console.warn('Tree image unavailable; procedural tree remains.'));
 }
 fetch(import.meta.env.BASE_URL+'environment.json').then(r=>r.ok?r.json():{}).then(config=>{
  platformConfig=config;loadPlatform();loadTree();
 }).catch(()=>{});
 const ivy=new THREE.InstancedMesh(leafGeo,leaf,110);ivy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);ivy.frustumCulled=false;background.add(ivy);
 const motePositions=new Float32Array(90*3);const r=rng(51);
 for(let i=0;i<90;i++){motePositions[i*3]=(r()-.5)*24;motePositions[i*3+1]=(r()-.5)*24;motePositions[i*3+2]=-1-r()*6;}
 const moteGeo=new THREE.BufferGeometry();moteGeo.setAttribute('position',new THREE.BufferAttribute(motePositions,3));
 const moteMaterial=new THREE.PointsMaterial({color:0xffedb5,size:.045,transparent:true,opacity:.6,depthWrite:false});
 const motes=new THREE.Points(moteGeo,moteMaterial);motes.frustumCulled=false;background.add(motes);
 const particleGeo=new THREE.BufferGeometry(),particlePositions=new Float32Array(48*3);
 particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
 const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0xffdf79,size:.07,transparent:true,opacity:.85,depthWrite:false}));
 particles.frustumCulled=false;scene.add(particles);const sparks=[];
 const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.4,28),new THREE.MeshBasicMaterial({color:0xd7eca6,transparent:true,opacity:0,depthWrite:false}));
 scene.add(ring);let ringAge=1;
 function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
 function instances(geometry,material,parent,count,place){
  const batch=new THREE.InstancedMesh(geometry,material,count);parent.add(batch);
  for(let i=0;i<count;i++){dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);place(i,dummy);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);}
  batch.castShadow=batch.receiveShadow=true;return batch;
 }
 function branch(p){
  const group=new THREE.Group();group.userData.platformWidth=p.width;
  const fallback=new THREE.Group();fallback.name='procedural-branch';fallback.scale.set(1,PLATFORM_SCALE,PLATFORM_SCALE);group.add(fallback);
  // Physics already enlarged width; scale only thickness and depth here.
  const wood=mesh(logGeo,bark,fallback,0,-.24);wood.rotation.z=Math.PI/2;wood.scale.set(1,p.width,1);wood.castShadow=wood.receiveShadow=true;
  for(const side of [-1,1]){
   const cut=mesh(capGeo,end,fallback,side*p.width/2,-.24,0);cut.rotation.y=side*Math.PI/2;
   const twig=mesh(logGeo,bark,fallback,side*(p.width*.34),-.36,-.04);twig.scale.set(.38,.5,.38);twig.rotation.z=side*1.05;
  }
  const top=mesh(mossGeo,moss,fallback,0,-.085);top.scale.set(p.width/2,.085,.32);top.receiveShadow=true;
  const detail=new THREE.Group();fallback.add(detail);detail.visible=highQuality;detail.userData.desktopDetail=true;
  instances(knotGeo,dark,detail,5,(i,o)=>{o.position.set((i/4-.5)*p.width*.85,-.27,.205);o.scale.set(.6+i%2*.25,.5,1);});
  instances(mossGeo,moss,detail,9,(i,o)=>{o.position.set((i/8-.5)*p.width*.9,-.04,-.04+Math.sin(i*4)*.12);o.scale.set(.13,.04,.15);});
  instances(leafGeo,leaf,detail,7,(i,o)=>{o.position.set((i/6-.5)*p.width*.85,-.31,.05);o.scale.set(.11,.22,1);o.rotation.z=(i%2?1:-1)*.6;});
  instances(leafGeo,leaf,fallback,14,(i,o)=>{
   o.position.set((i/13-.5)*p.width,-.16-Math.sin(i*3.1)*.045,.12);o.rotation.set(.1,Math.sin(i)*.5,Math.sin(i*7+p.id)*.9);o.scale.set(.1,.13+Math.abs(Math.sin(i*2))*.12,1);
  });
  if(p.type==='moving')instances(knotGeo,blue,group,3,(i,o)=>{o.position.set((i-1)*.32*PLATFORM_SCALE,-.23*PLATFORM_SCALE,.38*PLATFORM_SCALE);o.scale.set(.6*PLATFORM_SCALE,PLATFORM_SCALE,PLATFORM_SCALE);});
  if(p.type==='cracked')instances(logGeo,dark,group,3,(i,o)=>{o.position.set((i-1)*.13*PLATFORM_SCALE,-.19*PLATFORM_SCALE,.38*PLATFORM_SCALE);o.scale.set(.07*PLATFORM_SCALE,.38*PLATFORM_SCALE,.07*PLATFORM_SCALE);o.rotation.z=(i%2?-.5:.5);});
  if(p.type==='spring'){
   const mushroom=new THREE.Group();mushroom.scale.setScalar(ITEM_SCALE);group.add(mushroom);
   const stem=mesh(stemGeo,cream,mushroom,0,.12);stem.castShadow=true;
   const under=mesh(capGeo,gills,mushroom,0,.25);under.rotation.x=-Math.PI/2;under.scale.set(2,1.6,1);
   const cap=mesh(mushroomGeo,red,mushroom,0,.25);cap.scale.set(.42,.23,.34);cap.castShadow=cap.receiveShadow=true;
   const collar=mesh(knotGeo,cream,mushroom,0,.14);collar.rotation.x=Math.PI/2;collar.scale.set(1.1,1.1,1);
  }
  const coin=new THREE.Group();coin.position.set(0,1,.18);coin.scale.setScalar(ITEM_SCALE);group.add(coin);
  const bunches=p.reward===2?2:1,fruitCount=bunches*3;
  // Two complete bunches communicate the double reward; one shared draw per material.
  function fruitPosition(i,o){
   const fruit=i%3,bunch=Math.floor(i/3);o.position.set((bunch-(bunches-1)/2)*.56+(fruit-1)*.07,Math.abs(fruit-1)*.035,fruit*.05);o.rotation.z=(fruit-1)*.16;
  }
  instances(bananaGeo,gold,coin,fruitCount,fruitPosition);
  const endpoint=new THREE.Vector3();
  instances(tipGeo,dark,coin,fruitCount*2,(i,o)=>{
   const fruit=Math.floor(i/2);fruitPosition(fruit,o);endpoint.copy(i%2?bananaPath.v2:bananaPath.v0).applyEuler(o.rotation);o.position.add(endpoint);o.scale.set(.56,.8,.62);
  });
  group.userData.coin=coin;attachPlatform(group);return group;
 }
 return {branch,
  setPixelMode(enabled){background.visible=!enabled;},
  get platformReady(){return !!platformTemplate;},
  get backgroundReady(){return !!treeImageMesh?.visible;},
  get treeVisible(){return trunk.visible||ivy.visible||!!treeImageMesh?.visible;},
  resize(width,height){viewWidth=width;viewHeight=height;loadTree();fitTree();},
  burst(event){
   if(event.type==='bounce'){ring.position.set(event.x,event.y+.08,.6);ringAge=0;}
   if(event.type==='coin'||event.spring)for(let i=0;i<12;i++)sparks.push({x:event.x,y:event.y+.4,z:.5,vx:(r()-.5)*3,vy:1+r()*2,age:0});
  },
  update(cameraY,time,dt,palette,night){
   edgeVines.position.y=cameraY;
   forest.forEach((m,i)=>{m.position.y=cameraY+2-Math.sin(cameraY*.012)*(i+1);m.material.color.copy(palette).lerp(new THREE.Color(0x25483e),.4+i*.12);});
   trunk.position.y=cameraY;
   currentCamera=cameraY;fitTree();
   if(treeImageMesh)treeImageMesh.material.color.set(0xd4d4d4).lerp(palette,night?.4:.10);
   for(let i=0;i<110;i++){
    const side=i%2?1:-1,y=((i*1.17-cameraY*.4+40)%28+28)%28-14;
    dummy.position.set(side*(1.2+Math.sin(i*6.7)*.2)+.35,cameraY+y,-2.75);
    dummy.rotation.set(.12,side*.2,side*(.55+Math.sin(time*.6+i)*.1));
    dummy.scale.set(.25+Math.sin(i)*.08,.25,1);dummy.updateMatrix();ivy.setMatrixAt(i,dummy.matrix);
   }ivy.instanceMatrix.needsUpdate=true;
   motes.position.set(Math.sin(time*.12)*.4,cameraY+Math.sin(time*.17),0);
   moteMaterial.opacity=night?.9:.35;
   ringAge+=dt;ring.material.opacity=Math.max(0,1-ringAge*4)*.65;ring.scale.setScalar(1+ringAge*3);
   for(const s of sparks){s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy-=3*dt;}
   while(sparks.length&&(sparks[0].age>.7||sparks.length>48))sparks.shift();
   for(let i=0;i<48;i++){const s=sparks[i];particlePositions[i*3]=s?s.x:0;particlePositions[i*3+1]=s?s.y:-10000;particlePositions[i*3+2]=s?s.z:0;}
   particleGeo.attributes.position.needsUpdate=true;
  },
  reset(){sparks.length=0;ringAge=1;},
  setQuality(high){highQuality=high;loadPlatform();loadTree();
   scene.traverse(o=>{if(o.name==='authored-branch')o.visible=high;if(o.name==='procedural-branch')o.visible=!high||!platformTemplate;if(o.userData.desktopDetail)o.visible=high;});
   motes.visible=high;trunk.geometry=high?detailedTrunkGeo:trunkGeo;refreshBackground();
  }
 };
}
