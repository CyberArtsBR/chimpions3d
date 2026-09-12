import * as THREE from 'three';

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
const endTexture=canvasTexture(256,256,(c)=>{
 c.fillStyle='#c19b6b';c.fillRect(0,0,256,256);
 for(let i=8;i<130;i+=6){c.strokeStyle=i%4?'#684c3470':'#ecd2a277';c.lineWidth=1.5;c.beginPath();c.ellipse(126,129,i,i*.95,0,0,Math.PI*2);c.stroke();}
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
const logGeo=new THREE.CylinderGeometry(.19,.24,1,18,3);
const capGeo=new THREE.CircleGeometry(.2,24);
const mossGeo=new THREE.SphereGeometry(1,16,8);
const leafGeo=new THREE.PlaneGeometry(1,2);
const mushroomGeo=new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI/2);
const stemGeo=new THREE.CylinderGeometry(.1,.14,.26,10);
const bananaPath=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.22,0,0),new THREE.Vector3(0,-.38,0),new THREE.Vector3(.23,.07,0));
const bananaGeo=new THREE.TubeGeometry(bananaPath,14,.068,7,false);
const tipGeo=new THREE.SphereGeometry(.06,7,5);
const knotGeo=new THREE.TorusGeometry(.09,.027,6,16);
const dummy=new THREE.Object3D();
export function createScenery(scene,renderer){
 const bark=new THREE.MeshStandardMaterial({color:0xa7977d,map:barkTexture,bumpMap:barkTexture,bumpScale:.09,roughness:.97});
 const moss=new THREE.MeshStandardMaterial({color:0xabc788,map:mossTexture,bumpMap:mossTexture,bumpScale:.05,roughness:.94});
 const leaf=new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.35,side:THREE.DoubleSide,roughness:.88});
 const end=new THREE.MeshStandardMaterial({map:endTexture,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x3f3023,roughness:1});
 const gold=new THREE.MeshStandardMaterial({color:0xffd04a,roughness:.4,metalness:.05,emissive:0x4c3102,emissiveIntensity:.25});
 const red=new THREE.MeshStandardMaterial({color:0xc75635,roughness:.55});
 const cream=new THREE.MeshStandardMaterial({color:0xe6d6ac,roughness:.85});
 const blue=new THREE.MeshStandardMaterial({color:0x55c4d0,emissive:0x17666f,emissiveIntensity:.35,roughness:.5});
 let highQuality=true,treeImageMesh=null;
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
 // Optional vertically tileable tree image. No missing-file requests by default.
 fetch(import.meta.env.BASE_URL+'environment.json').then(r=>r.ok?r.json():{}).then(config=>{
  if(!config.treeImage)return;
  new THREE.TextureLoader().load(import.meta.env.BASE_URL+config.treeImage,map=>{
   map.colorSpace=THREE.SRGBColorSpace;map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
   const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,fog:false});
   treeImageMesh=new THREE.Mesh(new THREE.PlaneGeometry(6,24),material);
   treeImageMesh.position.set(.35,0,-4);treeImageMesh.visible=highQuality;
   background.add(treeImageMesh);trunk.visible=!highQuality;
  },undefined,()=>console.warn('Tree image unavailable; using procedural tree.'));
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
 function branch(p){
  const group=new THREE.Group();
  const wood=mesh(logGeo,bark,group,0,-.24);wood.rotation.z=Math.PI/2;wood.scale.set(1,p.width,1);wood.castShadow=wood.receiveShadow=true;
  for(const side of [-1,1]){
   const cut=mesh(capGeo,end,group,side*p.width/2,-.24,0);cut.rotation.y=side*Math.PI/2;
   const twig=mesh(logGeo,bark,group,side*(p.width*.34),-.36,-.04);twig.scale.set(.38,.5,.38);twig.rotation.z=side*1.05;
  }
  const top=mesh(mossGeo,moss,group,0,-.075);top.scale.set(p.width/2,.085,.32);top.receiveShadow=true;
  const detail=new THREE.Group();group.add(detail);detail.visible=highQuality;detail.userData.desktopDetail=true;
  for(let i=0;i<5;i++){
   const x=(i/4-.5)*p.width*.85;
   const knot=mesh(knotGeo,dark,detail,x,-.27,.205);knot.scale.set(.6+i%2*.25,.5,1);
   const tuft=mesh(mossGeo,moss,detail,x,-.035,-.04);tuft.scale.set(.12,.055,.19);
   const fern=mesh(leafGeo,leaf,detail,x,-.31,.05);fern.scale.set(.11,.22,1);fern.rotation.z=(i%2?1:-1)*.6;
  }
  const foliage=new THREE.InstancedMesh(leafGeo,leaf,14);group.add(foliage);
  for(let i=0;i<14;i++){
   dummy.position.set((i/13-.5)*p.width,-.16-Math.sin(i*3.1)*.045,.12);
   dummy.rotation.set(.1,Math.sin(i)*.5,Math.sin(i*7+p.id)*.9);
   dummy.scale.set(.1,.13+Math.abs(Math.sin(i*2))*.12,1);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);
  }
  if(p.type==='moving')for(const x of [-.32,0,.32]){const marker=mesh(knotGeo,blue,group,x,-.23,.24);marker.scale.set(.6,1,1);}
  if(p.type==='cracked')for(let i=0;i<3;i++){const split=mesh(logGeo,dark,group,(i-1)*.13,-.19,.215);split.scale.set(.07,.38,.07);split.rotation.z=(i%2?-.5:.5);}
  if(p.type==='spring'){
   mesh(stemGeo,cream,group,0,.08);const cap=mesh(mushroomGeo,red,group,0,.17);cap.scale.set(.4,.2,.32);
   for(const x of [-.16,.12]){const spot=mesh(mossGeo,cream,group,x,.27,.17);spot.scale.set(.045,.025,.02);}
  }
  const coin=new THREE.Group();coin.position.set(0,1,.18);group.add(coin);
  for(let i=0;i<3;i++){
   const fruit=mesh(bananaGeo,gold,coin,(i-1)*.075,Math.abs(i-1)*.035,i*.05);fruit.rotation.z=(i-1)*.18;
  }
  mesh(tipGeo,dark,coin,.23,.07,.06);
  group.userData.coin=coin;return group;
 }
 return {branch,
  burst(event){
   if(event.type==='bounce'){ring.position.set(event.x,event.y+.08,.6);ringAge=0;}
   if(event.type==='coin'||event.spring)for(let i=0;i<12;i++)sparks.push({x:event.x,y:event.y+.4,z:.5,vx:(r()-.5)*3,vy:1+r()*2,age:0});
  },
  update(cameraY,time,dt,palette,night){
   forest.forEach((m,i)=>{m.position.y=cameraY+2-Math.sin(cameraY*.012)*(i+1);m.material.color.copy(palette).lerp(new THREE.Color(0x25483e),.4+i*.12);});
   trunk.position.y=cameraY;
   if(treeImageMesh){treeImageMesh.position.y=cameraY;treeImageMesh.material.map.offset.y=cameraY/24;}
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
  setQuality(high){highQuality=high;motes.visible=high;forest[0].visible=high;trunk.geometry=high?detailedTrunkGeo:trunkGeo;trunk.visible=!high||!treeImageMesh;if(treeImageMesh)treeImageMesh.visible=high;scene.traverse(o=>{if(o.userData.desktopDetail)o.visible=high;});}
 };
}
