import * as THREE from 'three';
export function createFallSplash(scene){
 const count=32,mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:0xc51930,roughness:.32,metalness:0,transparent:true,opacity:.95}),count),dummy=new THREE.Object3D();
 const drops=Array.from({length:count},(_,i)=>({vx:Math.sin(i*2.399)*(1.5+i%4),vy:3.5+i%6*.55,size:.055+i%4*.022,z:Math.cos(i)*.18}));mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);let age=0;
 return {start(x,y){mesh.position.set(x,y,.7);age=0;mesh.visible=true;this.update(0);},clear(){mesh.visible=false;},update(dt){if(!mesh.visible)return;age+=dt;if(age>1.5){mesh.visible=false;return;}for(let i=0;i<count;i++){const d=drops[i];dummy.position.set(d.vx*age,d.vy*age-4.9*age*age,d.z);dummy.scale.set(d.size,d.size*(1+Math.max(0,d.vy-9.8*age)*.2),d.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;mesh.material.opacity=.95*Math.max(0,1-age/1.5);}};
}
