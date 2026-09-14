import * as THREE from 'three';

// The old Emerald Mist treatment used three large transparent PlaneGeometry meshes
// (22 x 5 world units). On tall/wide screens their overlap reads as horizontal bands.
// Keep real scene fog/lighting, but refuse only those legacy strip meshes.
const baseAdd=THREE.Object3D.prototype.add;
if(!THREE.Object3D.prototype.__chimpNoBiomeBands){
  THREE.Object3D.prototype.add=function(...objects){
    const filtered=objects.filter(object=>{
      if(!object?.isMesh||object.geometry?.type!=='PlaneGeometry')return true;
      const {width,height}=object.geometry.parameters||{};
      const material=object.material;
      const legacyMist=width===22&&height===5&&material?.isMeshBasicMaterial&&material.transparent&&material.depthWrite===false;
      if(legacyMist){object.geometry.dispose();material.dispose();return false;}
      return true;
    });
    return filtered.length?baseAdd.apply(this,filtered):this;
  };
  THREE.Object3D.prototype.__chimpNoBiomeBands=true;
}
