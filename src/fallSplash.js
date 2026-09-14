import * as THREE from 'three';
export function createFallSplash(scene){
 const count=72;
 const material=new THREE.MeshStandardMaterial({color:0xd10f2f,roughness:.24,metalness:0,transparent:true,opacity:.98});
 const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),material,count),dummy=new THREE.Object3D();
 const puddle=new THREE.Mesh(new THREE.SphereGeometry(1,18,8),material.clone());
 puddle.scale.set(1.05,.075,.58);puddle.visible=false;scene.add(puddle);
 const crownMaterial=material.clone();
 const crown=new THREE.Mesh(new THREE.TorusGeometry(.58,.075,8,30),crownMaterial);crown.rotation.x=Math.PI/2;crown.visible=false;scene.add(crown);
 const drops=Array.from({length:count},(_,i)=>{
  const a=i*2.3999632297,fast=i<24,speed=(fast?3.2:1.7)+(i%7)*.34;
  return {vx:Math.cos(a)*speed,vy:(fast?5.8:3.8)+(i%9)*.48,size:.05+(i%6)*.018,z:Math.sin(a)*(.22+(i%4)*.055)};
 });
 mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);let age=0,impactTriggered=false;
 function hide(){mesh.visible=puddle.visible=crown.visible=false;}
 function realStart(x,y){
  mesh.position.set(x,y,.78);puddle.position.set(x,y-.03,.62);crown.position.set(x,y+.02,.66);
  age=0;mesh.visible=puddle.visible=crown.visible=true;api.update(0);
 }
 const onOffscreen=event=>{
  impactTriggered=true;const detail=event.detail||{};realStart(Number(detail.x)||0,Number(detail.y)||0);
 };
 window.addEventListener('chimp-death-offscreen',onOffscreen);
 const api={
  // game.js still calls start on its legacy timer; ignore that call. The splash is now
  // controlled by the exact moment the full avatar leaves the camera frame.
  start(){},
  clear(){impactTriggered=false;hide();},
  update(dt){
   if(!mesh.visible&&!puddle.visible&&!crown.visible)return;
   age+=dt;if(age>1.65){hide();return;}
   for(let i=0;i<count;i++){
    const d=drops[i],stretch=1+Math.max(0,d.vy-9.8*age)*.16;
    dummy.position.set(d.vx*age,d.vy*age-5.4*age*age,d.z);
    dummy.rotation.z=Math.atan2(d.vx,Math.max(.2,d.vy-10.8*age));
    dummy.scale.set(d.size,d.size*stretch,d.size*(.82+(i%3)*.08));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
   const fade=Math.max(0,1-age/1.65);material.opacity=.98*fade;
   const spread=1+Math.min(age,.55)*2.7;puddle.scale.set(1.05*spread,.075,.58*spread);puddle.material.opacity=.86*fade;
   crown.scale.setScalar(1+Math.min(age,.45)*2.2);crown.material.opacity=Math.max(0,1-age/.72)*.9;
  },
  dispose(){window.removeEventListener('chimp-death-offscreen',onOffscreen);}
 };
 return api;
}
