import * as THREE from 'three';

const woodGeometry=new THREE.CylinderGeometry(.24,.34,1,12,3);
const mossGeometry=new THREE.SphereGeometry(1,12,6);
const woodMaterial=new THREE.MeshStandardMaterial({color:0x8e6848,roughness:.94,metalness:0});
const mossMaterial=new THREE.MeshStandardMaterial({color:0x789a58,roughness:.98,metalness:0});

export function createCanopyPlatforms(){
  let detailScale=1;

  function decorate(group,platform){
    if(!group||group.userData.canopySculpture)return;
    group.userData.canopySculpture=true;
    const width=Math.max(.8,Number(platform.width)||1.4);
    const variant=group.userData.variant||0;
    const sculpture=new THREE.Group();
    sculpture.name='canopy-sculpted-support';
    sculpture.position.z=-.025;
    group.add(sculpture);

    // One shared tapered support replaces piles of one-off decorative meshes.
    const core=new THREE.Mesh(woodGeometry,woodMaterial);
    core.rotation.z=Math.PI/2;
    core.position.set(0,-.34,-.04);
    core.scale.set(.78+variant*.025,width*.92,.82+(3-variant)*.035);
    core.castShadow=core.receiveShadow=true;
    sculpture.add(core);

    for(const side of [-1,1]){
      const spur=new THREE.Mesh(woodGeometry,woodMaterial);
      spur.position.set(side*width*.31,-.48,-.08);
      spur.rotation.z=side*(.94+variant*.035);
      spur.scale.set(.30,.42+variant*.035,.30);
      spur.castShadow=spur.receiveShadow=true;
      sculpture.add(spur);

      const moss=new THREE.Mesh(mossGeometry,mossMaterial);
      moss.position.set(side*width*.25,-.12,.01);
      moss.scale.set(width*.19,.055,.23);
      moss.receiveShadow=true;
      sculpture.add(moss);
    }

    const oldOrganic=group.getObjectByName('organic-platform-detail');
    if(oldOrganic)oldOrganic.visible=false;
    sculpture.scale.setScalar(detailScale);
  }

  function setQuality(profile={}){
    const name=typeof profile==='string'?profile:profile.profile;
    detailScale=name==='low'?.94:1;
    woodMaterial.roughness=name==='ultra'?.88:.94;
    mossMaterial.roughness=name==='ultra'?.92:.98;
  }

  return {
    decorate,
    setQuality,
    dispose(){
      woodGeometry.dispose();mossGeometry.dispose();
      woodMaterial.dispose();mossMaterial.dispose();
    }
  };
}
