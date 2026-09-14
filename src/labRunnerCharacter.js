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
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
  const rig={},bases=new Map(),axes=new Map(),used=new Set(),q=new THREE.Quaternion(),delta=new THREE.Quaternion();
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
  if(missing.length)throw new Error('Rig mapping incomplete: '+missing.join(', '));

  model.updateWorldMatrix(true,true);let box=new THREE.Box3().setFromObject(model,true),height=box.max.y-box.min.y;if(!(height>0))throw new Error('Invalid avatar dimensions.');
  // Slightly larger than the original technical test so the 3D Chimpion reads as the
  // hero against the 2D art instead of looking like a small debug model.
  model.scale.multiplyScalar(2.08/height);model.updateWorldMatrix(true,true);box.setFromObject(model,true);model.position.x-=(box.min.x+box.max.x)/2;model.position.z-=(box.min.z+box.max.z)/2;model.position.y-=box.min.y;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});

  // Same world-space arm preparation strategy used by the working Rig Lab. Never add
  // guessed Euler values directly to imported local axes: that was the cause of the
  // twisted first Dash prototype.
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
    const pose={},set=(key,x=0,y=0,z=0)=>{pose[key]=[x,y,z];},run=state==='RUN',swing=Math.sin(phase),breath=Math.sin(elapsed*1.7),stride=(run?.78:.42)*gait;
    set('hips',run?.065*gait:0,swing*.022*gait,swing*.014*gait);set('spine',-.012+breath*.006+(run?.075*gait:0));set('chest',breath*.008,-swing*.038*gait);set('neck',-.008);set('head',Math.sin(elapsed*.7)*.01,Math.sin(elapsed*.5)*.014);
    for(const [side,sign] of [['left',1],['right',-1]]){
      const cycle=swing*sign;set(side+'Shoulder',0,0,-sign*.02);set(side+'UpperArm',cycle*(run?.52:.25)*gait);set(side+'Forearm',-.14-(run?.48:.10)*gait-Math.max(0,cycle)*.13*gait);set(side+'Hand',.018);
      set(side+'Thigh',-.035-cycle*stride);set(side+'Shin',.09+Math.max(0,-cycle)*(run?.98:.55)*gait);set(side+'Foot',-.045-Math.max(0,-cycle)*.18*gait);
    }
    let offset=breath*.003+Math.abs(Math.cos(phase))*(run?.042:.018)*gait;
    if(state==='JUMP'){
      const apex=clamp(jumpHeight/85,0,1),launch=clamp(vy/600,0,1),tuck=.18+.40*apex;offset=-.055*tuck;set('hips',.09*tuck);set('spine',.075*tuck);
      for(const side of ['left','right']){set(side+'Thigh',-.44*tuck);set(side+'Shin',.82*tuck);set(side+'Foot',-.28*tuck);set(side+'UpperArm',-.44+.14*launch);set(side+'Forearm',-.28);}
    }
    if(sliding){
      offset=-.39;set('hips',.30);set('spine',.42);set('chest',.15);set('neck',-.13);set('head',-.10);
      for(const [side,sign] of [['left',1],['right',-1]]){set(side+'Thigh',-.82,0,sign*.04);set(side+'Shin',1.30);set(side+'Foot',-.42);set(side+'UpperArm',.27*sign,0,sign*.12);set(side+'Forearm',-.56);}
    }
    if(landingPulse>0&&!sliding){const t=landingPulse;offset-=.10*t;set('hips',.16*t);set('spine',.10*t);for(const side of ['left','right']){set(side+'Thigh',-.23*t);set(side+'Shin',.43*t);}}
    return{pose,offset};
  }
  const idle=makePose('IDLE',0,0,0,false);applyPose(idle.pose,idle.offset,1);model.updateWorldMatrix(true,true);
  for(const side of ['left','right'])if(worldDirection(rig[side+'UpperArm'],rig[side+'Forearm']).y>-.55)throw new Error('Idle arm validation failed.');
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});box.setFromObject(model,true);model.position.y-=box.min.y;model.updateWorldMatrix(true,true);root.rotation.y=Math.PI/2;model.visible=true;

  return{
    root,model,boneCount:bones.length,
    update(dt,{state='RUN',speed=1,jumpHeight=0,vy=0,sliding=false,landed=false}={}){
      elapsed+=dt;if(landed)landingPulse=1;landingPulse=Math.max(0,landingPulse-dt*7);
      // speed is the game-speed ratio (1 at Stage 1, roughly 2 at the cap). Keep the
      // stride safe for varied rigs but increase foot cadence with world speed so the
      // Chimpion always looks like it is actually running, never jogging in slow motion.
      const speedRatio=clamp(speed,.25,2.2),moving=state==='RUN'||state==='WALK';
      const gait=moving?clamp(.72+speedRatio*.28,.72,1.12):0;
      phase+=dt*(state==='RUN'?11.8:6.4)*(moving?speedRatio:0.3);
      const posed=makePose(state,gait,jumpHeight,vy,sliding);applyPose(posed.pose,posed.offset,1-Math.exp(-17*dt));model.updateWorldMatrix(true,true);
    },
    setFacingRight(right=true){root.rotation.y=right?Math.PI/2:-Math.PI/2;},
    dispose(){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());}
  };
}
