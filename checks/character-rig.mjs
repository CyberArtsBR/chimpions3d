import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {mapHumanoidRig,mapSecondaryMotionBones,prepareAnimationRig} from '../src/character/rigUtils.js';

function bone(name,x=0,y=0,z=0){
  const value=new THREE.Bone();
  value.name=name;
  value.position.set(x,y,z);
  return value;
}

function buildRig({missingRightFoot=false,misparentLeftForearm=false,zeroLeftArm=false}={}){
  const root=new THREE.Group();
  const hips=bone('Hips',0,1,0);root.add(hips);
  const spine=bone('Spine',0,.24,0);hips.add(spine);
  const chest=bone('Chest',0,.26,0);spine.add(chest);
  chest.add(bone('ScapulaHelper',0,.02,0));
  const neck=bone('Neck',0,.18,0);chest.add(neck);
  const head=bone('Head',0,.18,0);neck.add(head);
  head.add(bone('LeftEar',.08,.12,0),bone('RightEar',-.08,.12,0));
  hips.add(bone('TailBase',0,-.02,-.12));

  for(const side of ['Left','Right']){
    const sign=side==='Left'?1:-1;
    const shoulder=bone(side+'Shoulder',sign*.13,.10,0);chest.add(shoulder);
    const upper=bone(side+'UpperArm',sign*.16,-.04,0);shoulder.add(upper);
    const forearm=bone(side+'Forearm',zeroLeftArm&&side==='Left'?0:sign*.25,zeroLeftArm&&side==='Left'?0:-.36,0);
    if(misparentLeftForearm&&side==='Left')chest.add(forearm);else upper.add(forearm);
    forearm.add(bone(side+'Hand',sign*.08,-.30,0));

    const thigh=bone(side+'Thigh',sign*.12,-.32,0);hips.add(thigh);
    const shin=bone(side+'Shin',0,-.42,0);thigh.add(shin);
    if(!(missingRightFoot&&side==='Right'))shin.add(bone(side+'Foot',0,-.36,.10));
  }
  root.updateWorldMatrix(true,true);
  return root;
}

const report={status:'PASS',cases:[]};

{
  const root=buildRig();
  const {rig,bones}=mapHumanoidRig(root);
  const authoredLeft=rig.leftUpperArm.quaternion.clone();
  const entries=prepareAnimationRig(root,rig);
  const secondary=mapSecondaryMotionBones(root,entries);
  const leftEntry=entries.find(entry=>entry.key==='leftUpperArm');
  assert(leftEntry,'left upper-arm entry must exist');
  assert(leftEntry.authoredBase.angleTo(authoredLeft)<1e-9,'authored rest quaternion snapshot must be preserved');
  assert(rig.leftUpperArm.quaternion.angleTo(authoredLeft)<1e-9,'rig preparation must restore the authored GLB rest quaternion');
  assert.equal(entries.length>=11,true,'required humanoid animation entries must be prepared');
  assert.equal(secondary.length>=3,true,'ear/tail secondary bones should be detected when present');
  assert.equal(secondary.some(entry=>entry.bone.name==='ScapulaHelper'),false,'scapula helper must never be mistaken for a cap accessory');
  assert.equal(bones.every(item=>item.scale.distanceTo(new THREE.Vector3(1,1,1))<1e-12),true,'rig preparation must not alter bone scale');
  report.cases.push({name:'valid humanoid + optional accessories',status:'PASS',bones:bones.length,secondary:secondary.length});
}

assert.throws(()=>mapHumanoidRig(new THREE.Group()),/no bones/i);
report.cases.push({name:'local upload without bones',status:'PASS'});

assert.throws(()=>mapHumanoidRig(buildRig({missingRightFoot:true})),/rightFoot/i);
report.cases.push({name:'local upload missing required foot',status:'PASS'});

assert.throws(()=>mapHumanoidRig(buildRig({misparentLeftForearm:true})),/forearm must descend/i);
report.cases.push({name:'local upload invalid elbow hierarchy',status:'PASS'});

{
  const root=buildRig({zeroLeftArm:true});
  const {rig}=mapHumanoidRig(root);
  assert.throws(()=>prepareAnimationRig(root,rig),/zero length/i);
  report.cases.push({name:'local upload zero-length arm',status:'PASS'});
}

fs.writeFileSync('checks/character-rig-report.json',JSON.stringify(report,null,2));
console.log('PASS character rig compatibility and local-upload failure boundaries');
