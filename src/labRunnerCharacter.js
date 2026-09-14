import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const BONE_MAPPING={
  hips:null,spine:null,chest:null,neck:null,head:null,
  leftShoulder:null,leftUpperArm:null,leftForearm:null,leftHand:null,
  rightShoulder:null,rightUpperArm:null,rightForearm:null,rightHand:null,
  leftThigh:null,leftShin:null,leftFoot:null,rightThigh:null,rightShin:null,rightFoot:null,
};
const ARM_REST_ANGLE=THREE.MathUtils.degToRad(22);
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const aliases={
  hips:['hips','hip','pelvis'],spine:['spine','spine0','spine1','spine01'],chest:['chest','upperchest','spine2','spine02','spine3'],neck:['neck','neck1','necktwist01'],head:['head'],
  Shoulder:['shoulder','clavicle','collar'],UpperArm:['upperarm','arm','uparm'],Forearm:['forearm','lowerarm','elbow'],Hand:['hand','wrist'],
  Thigh:['thigh','upleg','upperleg'],Shin:['shin','calf','leg','lowerleg','knee'],Foot:['foot','ankle'],
};
function nameParts(name){
  let s=name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replace(/mixamorig\d*[:_ ]*/g,'').replace(/cc[_ ]*base[_ ]*/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  let words=s.split(/\s+/),side=words.includes('left')||words.includes('l')?'left':words.includes('right')||words.includes('r')?'right':'';
  let core=words.filter(w=>!['left','right','l','r','bone','def','bip','bip001'].includes(w)).join('');
  if(!side&&/^(left|right)/.test(core)){side=core.startsWith('left')?'left':'right';core=core.slice(side.length);}
  return{side,core};
}
function isDescendant(child,ancestor){for(let p=child?.parent;p;p=p.parent)if(p===ancestor)return true;return false;}
function worldDirection(a,b){return b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();}

export async function createLabRunnerCharacter(url){
  const gltf=await new GLTFLoader().loadAsync(url),model=gltf.scene,root=new THREE.Group(),visual=new THREE.Group();
  root.add(visual);visual.add(model);model.visible=false;
  const rig={},rest=new Map(),bases=new Map(),axes=new Map(),used=new Set(),q=new THREE.Quaternion(),delta=new THREE.Quaternion();
  let phase=0,elapsed=0,bodyOffset=0,landingPulse=0;
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});if(!bones.length)throw new Error('GLB has no bones.');
  for(const key of Object.keys(BONE_MAPPING)){
    const side=key.startsWith('left')?'left':key.startsWith('right')?'right':'',kind=side?key.slice(side.length):key;
    let matches=bones.filter(b=>{if(BONE_MAPPING[key])return b.name===BONE_MAPPING[key];const p=nameParts(b.name);return p.side===side&&(aliases[kind]||[]).includes(p.core);});
    if(!BONE_MAPPING[key]&&key==='hips'&&matches.length>1)matches=matches.filter(b=>matches.every(other=>other===b||isDescendant(other,b)));
    if(!BONE_MAPPING[key]&&matches.length>1&&(key==='spine'||key==='chest'))matches=matches.filter(b=>matches.every(other=>other===b||(key==='spine'?isDescendant(other,b):isDescendant(b,other))));
    const bone=matches.length===1&&!used.has(matches[0])?matches[0]:null;if(bone){rig[key]=bone;used.add(bone);}
  }
  const required=['leftUpperArm','rightUpperArm','leftForearm','rightForearm','leftThigh','rightThigh','leftShin','rightShin','leftFoot','rightFoot'],missing=required.filter(k=>!rig[k]);
  if(missing.length)throw new Error('Rig mapping incomplete: '+missing.join(', '));bones.forEach(b=>rest.set(b,b.quaternion.clone()));

  model.updateWorldMatrix(true,true);let box=new THREE.Box3().setFromObject(model,true),height=box.max.y-box.min.y;if(!(height>0))throw new Error('Invalid avatar dimensions.');
  model.scale.multiplyScalar(1.82/height);model.updateWorldMatrix(true,true);box.setFromObject(model,true);model.position.x-=(box.min.x+box.max.x)/2;model.position.z-=(box.min.z+box.max.z)/2;model.position.y-=box.min.y;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});

  // Exact world-space arm preparation from the working Rig Lab. Raw Euler values are
  // never added directly to imported local bone axes; that caused the twisted prototype.
  for(const side of ['left','right']){
    const arm=rig[side+'UpperArm'],elbow=rig[side+'Forearm'];if(!isDescendant(elbow,arm))throw new Error('Forearm hierarchy is incompatible.');
    model.updateWorldMatrix(true,true);const from=worldDirection(arm,elbow);if(from.lengthSq()<.5)throw new Error('Arm has zero length.');
    const to=new THREE.Vector3((side==='left'?1:-1)*Math.sin(ARM_REST_ANGLE),-Math.cos(ARM_REST_ANGLE),.04).normalize(),parentWorld=arm.parent.getWorldQuaternion(new THREE.Quaternion()),world=arm.getWorldQuaternion(new THREE.Quaternion());
    arm.quaternion.copy(parentWorld.invert().multiply(new THREE.Quaternion().setFromUnitVectors(from,to)).multiply(world));
  }
  model.updateWorldMatrix(true,true);
  for(const [key,bone] of Object.entries(rig)){bases.set(key,bone.quaternion.clone());const inverseWorld=bone.getWorldQuaternion(new THREE.Quaternion()).invert();axes.set(key,[X,Y,Z].map(axis=>axis.clone().applyQuaternion(inverseWorld)));}

  function applyPose(pose,offset,alpha){
    for(const [key,bone] of Object.entries(rig)){q.copy(bases.get(key));(pose[key]||[0,0,0]).forEach((angle,i)=>q.multiply(delta.setFromAxisAngle(axes.get(key)[i],angle)));bone.quaternion.slerp(q,alpha);}
    bodyOffset=THREE.MathUtils.lerp(bodyOffset,offset,alpha);visual.position.y=bodyOffset;
  }
  function makePose(state,gait,jumpHeight,vy,sliding){
    const pose={},set=(key,x=0,y=0,z=0)=>{pose[key]=[x,y,z];},run=state==='RUN',swing=Math.sin(phase),breath=Math.sin(elapsed*1.7),stride=(run ? .88 : .48)*gait;
    set('hips',run ? .08*gait : 0,swing*.03*gait,swing*.018*gait);set('spine',-.015+breath*.008+(run ? .10*gait : 0));set('chest',breath*.01,-swing*.05*gait);set('neck',-.01);set('head',Math.sin(elapsed*.7)*.012,Math.sin(elapsed*.5)*.018);
    for(const [side,sign] of [['left',1],['right',-1]]){
      const cycle=swing*sign;set(side+'Shoulder',0,0,-sign*.025);set(side+'UpperArm',cycle*(run ? .68 : .3)*gait);set(side+'Forearm',-.16-(run ? .62 : .12)*gait-Math.max(0,cycle)*.16*gait);set(side+'Hand',.02);
      set(side+'Thigh',-.04-cycle*stride);set(side+'Shin',.10+Math.max(0,-cycle)*(run ? 1.12 : .62)*gait);set(side+'Foot',-.05-Math.max(0,-cycle)*.20*gait);
    }
    let offset=breath*.004+Math.abs(Math.cos(phase))*(run ? .05 : .02)*gait;
    if(state==='JUMP'){
      const apex=Math.max(0,Math.min(1,jumpHeight/85)),launch=Math.max(0,Math.min(1,vy/600)),tuck=.20+.44*apex;offset=-.06*tuck;set('hips',.10*tuck);set('spine',.09*tuck);
      for(const side of ['left','right']){set(side+'Thigh',-.48*tuck);set(side+'Shin',.92*tuck);set(side+'Foot',-.32*tuck);set(side+'UpperArm',-.54+.18*launch);set(side+'Forearm',-.34);}
    }
    if(sliding){
      offset=-.43;set('hips',.34);set('spine',.48);set('chest',.18);set('neck',-.16);set('head',-.12);
      for(const [side,sign] of [['left',1],['right',-1]]){set(side+'Thigh',-.92,0,sign*.05);set(side+'Shin',1.45);set(side+'Foot',-.48);set(side+'UpperArm',.35*sign,0,sign*.16);set(side+'Forearm',-.68);}
    }
    if(landingPulse>0&&!sliding){const t=landingPulse;offset-=.12*t;set('hips',.20*t);set('spine',.12*t);for(const side of ['left','right']){set(side+'Thigh',-.28*t);set(side+'Shin',.52*t);}}
    return{pose,offset};
  }
  const idle=makePose('IDLE',0,0,0,false);applyPose(idle.pose,idle.offset,1);model.updateWorldMatrix(true,true);
  for(const side of ['left','right'])if(worldDirection(rig[side+'UpperArm'],rig[side+'Forearm']).y>-.55)throw new Error('Idle arm validation failed.');
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});box.setFromObject(model,true);model.position.y-=box.min.y;model.updateWorldMatrix(true,true);root.rotation.y=Math.PI/2;model.visible=true;

  return{
    root,model,boneCount:bones.length,
    update(dt,{state='RUN',speed=1,jumpHeight=0,vy=0,sliding=false,landed=false}={}){
      elapsed+=dt;if(landed)landingPulse=1;landingPulse=Math.max(0,landingPulse-dt*7);const gait=state==='RUN'||state==='WALK'?Math.max(.25,Math.min(1,speed)):0;phase+=dt*(state==='RUN'?11.5:6.5)*Math.max(.3,gait);
      const posed=makePose(state,gait,jumpHeight,vy,sliding);applyPose(posed.pose,posed.offset,1-Math.exp(-16*dt));model.updateWorldMatrix(true,true);
    },
    setFacingRight(right=true){root.rotation.y=right?Math.PI/2:-Math.PI/2;},
    dispose(){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());}
  };
}
