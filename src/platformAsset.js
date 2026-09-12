import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Loads one shared branch GLB and swaps it into platform holders when ready.
// Platform physics stay independent: the model is normalized so its highest
// point is local Y=0, matching the collision plane used by the game.
export function createBranchAsset(){
 let template=null;
 let templateWidth=1;
 const pending=[];

 function normalize(root){
  root.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(root);
  let size=box.getSize(new THREE.Vector3());

  // Some exports use Z (or even Y) as the branch's long axis. Rotate once so
  // the long axis is X, which is the platform width axis in Chimp Jump.
  if(size.y>size.x&&size.y>size.z) root.rotation.z-=Math.PI/2;
  else if(size.z>size.x) root.rotation.y+=Math.PI/2;

  root.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(root);
  size=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  root.position.x-=center.x;
  root.position.y-=box.max.y;
  root.position.z-=center.z;
  root.updateMatrixWorld(true);

  root.traverse(o=>{
   if(!o.isMesh)return;
   o.castShadow=true;
   o.receiveShadow=true;
   o.frustumCulled=true;
  });
  templateWidth=Math.max(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).x,.001);
  return root;
 }

 function apply(holder,width){
  if(!template)return false;
  holder.clear();
  const model=template.clone(true);
  const scale=width/templateWidth;
  model.scale.setScalar(scale);
  model.userData.branchAsset=true;
  holder.add(model);
  holder.userData.branchAssetReady=true;
  return true;
 }

 new GLTFLoader().load(
  import.meta.env.BASE_URL+'environment/platforms/branch-moss.glb',
  gltf=>{
   template=normalize(gltf.scene);
   for(const {holder,width} of pending)apply(holder,width);
   pending.length=0;
  },
  undefined,
  error=>{
   console.warn('Branch GLB unavailable; keeping procedural platforms.',error);
   pending.length=0;
  },
 );

 return {
  attach(holder,width){
   if(!apply(holder,width))pending.push({holder,width});
  },
 };
}
