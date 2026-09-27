import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createExpeditionBackdrop(world,scene,camera){
 const names=['day','golden','neon','night'];
 const layers=names.map((name,index)=>{
  const picture=document.createElement('picture');picture.className='expedition-backdrop';
  const source=document.createElement('source');source.media='(orientation: landscape)';
  source.srcset=import.meta.env.BASE_URL+'backgrounds/expedition/'+name+'-landscape.jpg';
  const img=document.createElement('img');img.src=import.meta.env.BASE_URL+'backgrounds/expedition/'+name+'-portrait.jpg';img.alt='';img.decoding='async';
  picture.append(source,img);world.prepend(picture);return picture;
 });
 const loader=new THREE.TextureLoader(),cache=new Map(),backplates=[];
 const FADE_SECONDS=3;
 let enabled=true,current=-1,outgoing=-1,transitionStarted=0;
 for(let i=0;i<4;i++){
  const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.position.z=-7;mesh.renderOrder=-100+i;scene.add(mesh);backplates.push(mesh);
 }
 function load(url){
  if(cache.has(url))return cache.get(url);
  const texture=loader.load(url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;cache.set(url,texture);return texture;
 }
 return {update(index){
  const now=performance.now();
  if(index!==current){
   outgoing=current;
   current=index;
   transitionStarted=now;
   layers.forEach((layer,i)=>layer.classList.toggle('active',i===index));
  }
  const progress=outgoing<0?1:Math.min(1,(now-transitionStarted)/(FADE_SECONDS*1000));
  if(progress===1)outgoing=-1;
  const width=(camera.right-camera.left)/camera.zoom,height=(camera.top-camera.bottom)/camera.zoom,wide=width>height;
  backplates.forEach((mesh,i)=>{
   const url=import.meta.env.BASE_URL+'backgrounds/expedition/'+names[i]+(wide?'-landscape.jpg':'-portrait.jpg');
   const map=load(url),image=map.image;if(mesh.material.map!==map){mesh.material.map=map;mesh.material.needsUpdate=true;}
   mesh.visible=enabled&&!!image?.width&&(i===current||i===outgoing);
   mesh.material.opacity=i===current?progress:i===outgoing?1-progress:0;
   mesh.renderOrder=i===outgoing?-100:i===current?-99:-101;
   if(image?.width){const aspect=image.width/image.height,view=width/height;map.repeat.set(Math.min(1,view/aspect),Math.min(1,aspect/view));map.offset.set((1-map.repeat.x)/2,(1-map.repeat.y)/2);}
   mesh.scale.set(width*1.005,height*1.005,1);mesh.position.y=camera.position.y;
  });
 },setVisible(value){enabled=value;layers.forEach(layer=>layer.hidden=!value);backplates.forEach((mesh,i)=>mesh.visible=value&&(i===current||i===outgoing));}};

}
const plate=new RoundedBoxGeometry(1,1,1,3,.1),bolt=new THREE.SphereGeometry(1,12,8);
const armor=new THREE.MeshStandardMaterial({color:0x344451,metalness:.78,roughness:.32});
const edge=new THREE.MeshStandardMaterial({color:0x89949b,metalness:.8,roughness:.25});
const dark=new THREE.MeshStandardMaterial({color:0x0c1823,metalness:.65,roughness:.4});
const moss=new THREE.MeshStandardMaterial({color:0x71972e,roughness:.95});
const leaf=new THREE.MeshStandardMaterial({color:0xaccb42,roughness:.8});
const colors={solid:0x20d8ff,cracked:0xff454d,moving:0xffd337,vertical:0xb16aff};
const lights=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:3.6,roughness:.22,metalness:.3,toneMapped:false})]));
const paints=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.35})]));
const ledCanvas=document.createElement('canvas');ledCanvas.width=ledCanvas.height=64;
const ledContext=ledCanvas.getContext('2d'),ledGradient=ledContext.createRadialGradient(32,32,1,32,32,32);
ledGradient.addColorStop(0,'#fff');ledGradient.addColorStop(.2,'#ffffff99');ledGradient.addColorStop(1,'#ffffff00');
ledContext.fillStyle=ledGradient;ledContext.fillRect(0,0,64,64);
const ledMap=new THREE.CanvasTexture(ledCanvas);
const ledHalos=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.SpriteMaterial({map:ledMap,color,transparent:true,opacity:.52,depthWrite:false,blending:THREE.AdditiveBlending})]));
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,2,64,64,64);gradient.addColorStop(0,'#fff7bc99');gradient.addColorStop(.3,'#ffcf3738');gradient.addColorStop(1,'#ffcf3700');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
const glowMap=new THREE.CanvasTexture(glowCanvas),glowMaterial=new THREE.SpriteMaterial({map:glowMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
function piece(parent,geometry,material,x,y,z,w,h,d){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function createTechPlatform(p,group){
 if(group.userData.tech)return group;
 group.userData.tech=true;group.userData.finalVisualPolish=true;
 const legacy=new THREE.Group();legacy.name='legacy-platform';legacy.visible=false;
 for(const child of [...group.children])if(child!==group.userData.coin)legacy.add(child);
 group.add(legacy);delete group.userData.paddles;delete group.userData.mushroom;
 const hull=new THREE.Group();group.add(hull);
 const type=p.type in colors?p.type:'solid',light=lights[type],paint=paints[type],w=p.width;
 function ledHalo(x,y,z,size){const halo=new THREE.Sprite(ledHalos[type]);halo.position.set(x,y,z);halo.scale.set(size,size*.48,1);hull.add(halo);}
 const halves=type==='cracked'?[-1,1]:[0];
 for(const side of halves){const width=side?w*.48:w,x=side*w*.255;
  piece(hull,plate,armor,x,-.24,0,width,.38,.65);
  piece(hull,plate,edge,x,-.07,.02,width*1.015,.09,.72);
  piece(hull,plate,paint,x,-.18,.355,width*.91,.15,.045);
  piece(hull,plate,dark,x,-.31,.37,width*.68,.12,.07);
  piece(hull,plate,light,x,-.3,.416,width*.38,.035,.035);
  ledHalo(x,-.3,.47,width*.5);
  piece(hull,plate,moss,x,-.015,-.025,width*.98,.055,.58);
 }
 for(const side of [-1,1]){
  piece(hull,plate,edge,side*(w/2-.12),-.22,.34,.25,.35,.19);
  piece(hull,plate,dark,side*(w/2-.12),-.2,.447,.17,.23,.04);
  piece(hull,bolt,light,side*(w/2-.12),-.2,.48,.048,.061,.025);
  ledHalo(side*(w/2-.12),-.2,.51,.32);
  piece(hull,plate,dark,side*w*.28,-.45,0,.18,.16,.35);
 }
 for(let i=0;i<22;i++){
  const x=(i/21-.5)*w*.96,y=Math.sin(i*8+p.id)*.013;
  piece(hull,bolt,i%3?moss:leaf,x,.005+y,Math.sin(i*7)*.2,.05+(i%3)*.015,.025,.045);
  if(i%3===0){const frond=piece(hull,bolt,leaf,x,.055,-.13,.02,.11,.035);frond.rotation.z=Math.sin(i*5)*.7;}
 }
 for(let i=0;i<3;i++){
  const points=[];for(let n=0;n<=12;n++){const t=n/12;points.push(new THREE.Vector3((t-.5)*w*(.5+i*.13),-.39-Math.sin(t*Math.PI)*(.16+i*.07),-.06+i*.08));}
  const vineGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.014,5,false);
  const vine=new THREE.Mesh(vineGeo,moss);hull.add(vine); // Retained with the bounded branch pool.
 }
 if(type==='moving'||type==='vertical')for(const side of [-1,1]){
  const marker=piece(hull,plate,light,side*.16,-.18,.405,.08,.022,.025);marker.rotation.z=side*(type==='vertical'?Math.PI/3:-Math.PI/3);
 }
 const halo=new THREE.Sprite(glowMaterial);halo.scale.set(1.2,1.2,1);halo.position.z=-.12;group.userData.coin.add(halo);
 return group;
}
