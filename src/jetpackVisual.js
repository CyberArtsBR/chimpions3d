import * as THREE from 'three';

// Shared expedition equipment: enamel, brass fittings and dark nozzle cavities.
const enamel=new THREE.MeshStandardMaterial({color:0x238f91,metalness:.28,roughness:.3});
const brass=new THREE.MeshStandardMaterial({color:0xd6ad60,metalness:.65,roughness:.32});
const graphite=new THREE.MeshStandardMaterial({color:0x202c30,metalness:.35,roughness:.55});
const glass=new THREE.MeshStandardMaterial({color:0xbef9ef,emissive:0x54ddca,emissiveIntensity:.65,roughness:.22});
const flameMaterial=new THREE.MeshBasicMaterial({color:0xffb632});
const coreMaterial=new THREE.MeshBasicMaterial({color:0xe0fffa});
const tankGeo=new THREE.CapsuleGeometry(.14,.34,4,12);
const bandGeo=new THREE.TorusGeometry(.145,.025,6,16);
const nozzleGeo=new THREE.CylinderGeometry(.105,.14,.14,12);
const fireGeo=new THREE.ConeGeometry(.1,.48,12);
const plateGeo=new THREE.BoxGeometry(.34,.34,.13);
const gaugeGeo=new THREE.CylinderGeometry(.065,.065,.035,16);
export function createJetpack(){
 const group=new THREE.Group(),flames=[];
 function part(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;}
 part(plateGeo,graphite,0,0,0);
 for(const side of [-1,1]){
  part(tankGeo,enamel,side*.18,0,0);
  for(const y of [-.17,.17]){const b=part(bandGeo,brass,side*.18,y,0);b.rotation.x=Math.PI/2;}
  part(nozzleGeo,graphite,side*.18,-.34,0);
  const exhaust=new THREE.Group();exhaust.position.set(side*.18,-.4,0);group.add(exhaust);flames.push(exhaust);
  for(const [material,scale] of [[flameMaterial,1],[coreMaterial,.55]]){
   const f=new THREE.Mesh(fireGeo,material);f.rotation.z=Math.PI;f.scale.setScalar(scale);f.position.y=-.24*scale;exhaust.add(f);
  }
 }
 const gauge=part(gaugeGeo,brass,0,.04,.14);gauge.rotation.x=Math.PI/2;
 const face=part(gaugeGeo,glass,0,.04,.163);face.rotation.x=Math.PI/2;face.scale.set(.72,1,.72);
 group.userData.flames=flames;
 return group;
}
export function animateJetpack(group,time,flying){
 for(const [i,flame] of group.userData.flames.entries()){
  flame.visible=flying;flame.scale.y=.85+Math.sin(time*31+i*2)*.12;
 }
}
