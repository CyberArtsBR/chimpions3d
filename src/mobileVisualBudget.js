import * as THREE from 'three';

// visualCompletion marks non-essential branch accents with desktopDetail.
// Branches are created after the initial quality pass, so enforce the mobile budget
// at insertion time as well. Core branch/collision visuals are never hidden here.
const constrained=()=>matchMedia('(pointer: coarse)').matches||innerWidth<=600;
const priorAdd=THREE.Object3D.prototype.add;
if(!THREE.Object3D.prototype.__chimpMobileAccentBudget){
 THREE.Object3D.prototype.add=function(...objects){
  const result=priorAdd.apply(this,objects);
  if(constrained())for(const object of objects){
   if(!object?.userData?.platformWidth)continue;
   object.traverse(node=>{if(node.userData?.desktopDetail)node.visible=false;});
  }
  return result;
 };
 THREE.Object3D.prototype.__chimpMobileAccentBudget=true;
}
