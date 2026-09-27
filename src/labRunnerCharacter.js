import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateGLB} from './upload.js';

const BONE_MAPPING={
  hips:null,spine:null,chest:null,neck:null,head:null,
  leftShoulder:null,leftUpperArm:null,leftForearm:null,leftHand:null,
  rightShoulder:null,rightUpperArm:null,rightForearm:null,rightHand:null,
  leftThigh:null,leftShin:null,leftFoot:null,rightThigh:null,rightShin:null,rightFoot:null,
};
const ARM_REST_ANGLE=THREE.MathUtils.degToRad(22);
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const WORLD_AXES=[X,Y,Z];
const SIDES=['left','right'];
const SLIDE_POSE={
  hips:[.34,0,0],spine:[.70,0,0],chest:[.22,0,0],neck:[-.43,0,0],head:[-.29,0,0],
  leftThigh:[-1.48,0,.055],leftShin:[1.96,0,0],leftFoot:[-.48,0,0],leftShoulder:[.09,0,-.025],leftUpperArm:[.50,0,.075],leftForearm:[-1.06,0,0],leftHand:[-.10,0,0],
  rightThigh:[-1.48,0,-.055],rightShin:[1.96,0,0],rightFoot:[-.48,0,0],rightShoulder:[.09,0,.025],rightUpperArm:[.50,0,-.075],rightForearm:[-1.06,0,0],rightHand:[-.10,0,0]
};
const SLIDE_KEYS=Object.keys(SLIDE_POSE);
const aliases={
  hips:['hips','hip','pelvis'],spine:['spine','spine0','spine1','spine01'],chest:['chest','upperchest','spine2','spine02','spine3'],neck:['neck','neck1','necktwist01'],head:['head'],
  Shoulder:['shoulder','clavicle','collar'],UpperArm:['upperarm','arm','uparm'],Forearm:['forearm','lowerarm','elbow'],Hand:['hand','wrist'],
  Thigh:['thigh','upleg','upperleg'],Shin:['shin','calf','leg','lowerleg','knee'],Foot:['foot','ankle'],
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth01=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function nameParts(name){
  let s=name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replace(/mixamorig\d*[:_ ]*/g,'').replace(/cc[_ ]*base[_ ]*/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  let words=s.split(/\s+/),side=words.includes('left')||words.includes('l')?'left':words.includes('right')||words.includes('r')?'right':'';
  let core=words.filter(w=>!['left','right','l','r','bone','def','bip','bip001'].includes(w)).join('');
  if(!side&&/^(left|right)/.test(core)){side=core.startsWith('left')?'left':'right';core=core.slice(side.length);}
  return{side,core};
}
function isDescendant(child,ancestor){for(let p=child?.parent;p;p=p.parent)if(p===ancestor)return true;return false;}

export async function createLabRunnerCharacter(source){
  const manager=new THREE.LoadingManager();
  const isLocal=source instanceof ArrayBuffer;
  if(isLocal){
    validateGLB(source);
    manager.setURLModifier(value=>{
      if(!value.startsWith('blob:')&&!value.startsWith('data:'))throw new Error('External avatar resources are not supported.');
      return value;
    });
  }
  const loader=new GLTFLoader(manager);
  const gltf=isLocal?await loader.parseAsync(source,''):await loader.loadAsync(source),model=gltf.scene,root=new THREE.Group(),visual=new THREE.Group();
  root.add(visual);visual.add(model);model.visible=false;

  // All animation scratch state is allocated once. update() does not traverse the
  // skeleton and does not allocate pose arrays, vectors, quaternions or matrices.
  const rig={},bases=new Map(),axes=new Map(),used=new Set();
  const targetQuat=new THREE.Quaternion(),axisQuat=new THREE.Quaternion(),tmpQuatA=new THREE.Quaternion(),tmpQuatB=new THREE.Quaternion();
  const tmpVecA=new THREE.Vector3(),tmpVecB=new THREE.Vector3(),footPoint=new THREE.Vector3(),rootInverse=new THREE.Matrix4();
  const bones=[],textures=new Set();let triangles=0,skinned=0;
  model.traverse(o=>{
    if(o.isBone)bones.push(o);
    if(o.isSkinnedMesh)skinned++;
    if(o.isMesh){
      triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;
      for(const material of(Array.isArray(o.material)?o.material:[o.material]))Object.values(material||{}).forEach(value=>{if(value?.isTexture)textures.add(value);});
    }
  });
  if(!bones.length)throw new Error('GLB has no bones.');
  if(!skinned)throw new Error('The avatar has no skinned mesh.');
  if(isLocal&&triangles>300000)throw new Error('Use an avatar below 300,000 triangles.');
  if(isLocal){let pixels=0;for(const texture of textures){const image=texture.source?.data;pixels+=(image?.width||0)*(image?.height||0);}if(pixels>48*1024*1024)throw new Error('Avatar textures are too large. Try 2K or smaller textures.');}

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
  model.scale.multiplyScalar(2.08/height);model.updateWorldMatrix(true,true);box.setFromObject(model,true);model.position.x-=(box.min.x+box.max.x)/2;model.position.z-=(box.min.z+box.max.z)/2;model.position.y-=box.min.y;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});

  function worldDirection(a,b,out){
    a.getWorldPosition(tmpVecA);b.getWorldPosition(tmpVecB);return out.subVectors(tmpVecB,tmpVecA).normalize();
  }
  for(const side of SIDES){
    const arm=rig[side+'UpperArm'],elbow=rig[side+'Forearm'];if(!isDescendant(elbow,arm))throw new Error('Forearm hierarchy is incompatible.');
    model.updateWorldMatrix(true,true);const from=worldDirection(arm,elbow,tmpVecA);if(from.lengthSq()<.5)throw new Error('Arm has zero length.');
    tmpVecB.set((side==='left'?1:-1)*Math.sin(ARM_REST_ANGLE),-Math.cos(ARM_REST_ANGLE),.04).normalize();
    arm.parent.getWorldQuaternion(tmpQuatA);arm.getWorldQuaternion(tmpQuatB);
    arm.quaternion.copy(tmpQuatA.invert().multiply(targetQuat.setFromUnitVectors(from,tmpVecB)).multiply(tmpQuatB));
  }

  model.updateWorldMatrix(true,true);
  for(const [key,bone] of Object.entries(rig)){
    bases.set(key,bone.quaternion.clone());
    bone.getWorldQuaternion(tmpQuatA).invert();
    axes.set(key,WORLD_AXES.map(axis=>axis.clone().applyQuaternion(tmpQuatA)));
  }
  const rigEntries=Object.entries(rig).map(([key,bone])=>({key,bone,base:bases.get(key),axes:axes.get(key)}));
  const pose={},poseKeys=Object.keys(BONE_MAPPING);for(const key of poseKeys)pose[key]=new Float32Array(3);
  const set=(key,x=0,y=0,z=0)=>{const p=pose[key];p[0]=x;p[1]=y;p[2]=z;};
  const resetPose=()=>{for(const key of poseKeys)pose[key].fill(0);};

  let gaitPhase=0,elapsed=0,bodyOffset=0,groundCorrection=0,landingPulse=0,landingStrength=.65,slideBlend=0,slideEntryPulse=0,slideExitPulse=0;
  let wasGrounded=true,wasSliding=false,lastHalfStep=0,lastAirPhase='grounded';

  function dispatchPresentation(type,detail={}){
    if(typeof globalThis.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return;
    globalThis.dispatchEvent(new CustomEvent('chimpions-dash-animation-event',{detail:{type,...detail}}));
  }
  function emitFootContact(side,intensity,speed){
    if(typeof globalThis.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return;
    const detail={side,intensity,speed};
    globalThis.dispatchEvent(new CustomEvent('chimpions-dash-foot-contact',{detail}));
    dispatchPresentation('footContact',detail);
  }
  function updateFootContacts(previousPhase,nextPhase,intensity,speed){
    const current=Math.floor((nextPhase+.0001)/Math.PI);
    if(current<=lastHalfStep){lastHalfStep=current;return;}
    const first=Math.max(lastHalfStep+1,current-1);
    for(let step=first;step<=current;step++)emitFootContact(step%2===0?'left':'right',intensity,speed);
    lastHalfStep=current;
  }

  function applyPose(offset,alpha){
    for(const entry of rigEntries){
      const angles=pose[entry.key];targetQuat.copy(entry.base);
      targetQuat.multiply(axisQuat.setFromAxisAngle(entry.axes[0],angles[0]));
      targetQuat.multiply(axisQuat.setFromAxisAngle(entry.axes[1],angles[1]));
      targetQuat.multiply(axisQuat.setFromAxisAngle(entry.axes[2],angles[2]));
      entry.bone.quaternion.slerp(targetQuat,alpha);
    }
    bodyOffset=THREE.MathUtils.lerp(bodyOffset,offset,alpha);
    visual.position.y=bodyOffset+groundCorrection;
  }

  function runPose(speedRatio){
    const speedT=smooth01((speedRatio-.72)/1.75),sprint=smooth01((speedRatio-.95)/1.5);
    const breath=Math.sin(elapsed*1.65),bob=Math.abs(Math.sin(gaitPhase)),lateral=Math.sin(gaitPhase*2);
    const lean=.035+.145*sprint,stride=.55+.36*speedT;
    set('hips',.025+lean*.38,lateral*.018*(.6+speedT),-lateral*.012);
    set('spine',lean+breath*.004,-lateral*.026);
    set('chest',lean*.38+breath*.006,lateral*.052);
    set('neck',-lean*.38,-lateral*.012);
    set('head',-lean*.26+Math.sin(elapsed*.72)*.006,-lateral*.016+Math.sin(elapsed*.48)*.008);

    for(const side of SIDES){
      const left=side==='left',local=gaitPhase+(left?0:Math.PI),swing=Math.sin(local),contact=Math.max(0,Math.cos(local)),flight=Math.max(0,-Math.cos(local));
      const plant=smooth01((contact-.25)/.68),armSwing=swing*(.44+.20*speedT);
      set(side+'Shoulder',.015+flight*.018,0,(left?-1:1)*(.018+lateral*.008));
      set(side+'UpperArm',armSwing,0,(left?1:-1)*(.018+.022*sprint));
      set(side+'Forearm',-.16-(.26+.23*speedT)*Math.max(0,-swing)-.10*flight,0,(left?1:-1)*.012);
      set(side+'Hand',.018+Math.sin(local*2)*.025*(.45+speedT),0,0);

      const plantedSwing=swing*(1-.28*plant);
      set(side+'Thigh',-.035-plantedSwing*stride-.035*flight);
      set(side+'Shin',.075+flight*(.58+.42*speedT)+Math.max(0,-swing)*.18-.055*plant);
      set(side+'Foot',-.035-flight*(.13+.08*speedT)+.105*plant-swing*.035);
    }
    return .002+breath*.002+bob*(.018+.025*speedT)-.012*plantAverage();
  }

  function plantAverage(){
    const a=Math.max(0,Math.cos(gaitPhase)),b=Math.max(0,Math.cos(gaitPhase+Math.PI));
    return smooth01((Math.max(a,b)-.25)/.68);
  }

  function jumpPose(jumpHeight,vy,jumpHeld,jumpAge){
    const heightT=clamp(jumpHeight/112,0,1),up=clamp(vy/600,0,1),down=clamp(-vy/690,0,1);
    const held=jumpHeld?1:0,commit=held*smooth01((jumpAge-.045)/.12);
    let phase='descent';
    if(jumpAge<.042&&vy>180)phase='anticipation';
    else if(jumpAge<.105&&vy>160)phase='takeoff';
    else if(vy>115)phase='ascent';
    else if(Math.abs(vy)<=115)phase='apex';
    else if(vy<0&&jumpHeight<58)phase='landingPreparation';

    if(phase!==lastAirPhase){lastAirPhase=phase;}
    const compact=.44*(1-commit)+.18*commit;
    const hang=phase==='apex'?1:0,prep=phase==='landingPreparation'?smooth01((58-jumpHeight)/58):0;
    const anticipation=phase==='anticipation'?1:0,takeoff=phase==='takeoff'?1:0;
    const torso=.05+.08*commit-.08*down+.08*takeoff;
    set('hips',.10*compact+.20*anticipation-.04*prep);
    set('spine',torso+.22*anticipation-.10*prep);
    set('chest',.035+.06*hang-.05*down);
    set('neck',-.035-.06*hang+.06*prep);
    set('head',-.025-.045*hang+.045*prep);

    for(const side of SIDES){
      const sign=side==='left'?1:-1,asym=sign*Math.sin(jumpAge*8)*.035*(1-hang);
      const thigh=-.30*compact-.20*heightT-.16*anticipation+.18*prep+asym;
      const shin=.44*compact+.32*heightT+.38*anticipation-.28*prep;
      set(side+'Thigh',thigh,0,sign*.018*(1-hang));
      set(side+'Shin',shin);
      set(side+'Foot',-.16*compact-.10*heightT+.18*prep);
      set(side+'Shoulder',-.04*takeoff,0,-sign*.025);
      set(side+'UpperArm',-.34-.16*commit+.12*down+sign*.025*Math.sin(jumpAge*5));
      set(side+'Forearm',-.24-.16*commit-.10*hang);
      set(side+'Hand',-.015+sign*.018*Math.sin(jumpAge*7));
    }
    const compression=.10*anticipation+.035*takeoff;
    return-.045*compact-.035*heightT-compression+.015*up;
  }

  function blendSlide(offset){
    if(slideBlend<=.001&&slideExitPulse<=.001)return offset;
    const t=slideBlend,entry=slideEntryPulse,exit=slideExitPulse;
    for(const key of SLIDE_KEYS){
      const p=pose[key],target=SLIDE_POSE[key];p[0]=THREE.MathUtils.lerp(p[0],target[0],t);p[1]=THREE.MathUtils.lerp(p[1],target[1],t);p[2]=THREE.MathUtils.lerp(p[2],target[2],t);
    }
    if(exit>.001){
      const p=pose.spine;p[0]-=.06*exit;
      pose.leftUpperArm[0]-=.08*exit;pose.rightUpperArm[0]-=.08*exit;
    }
    return THREE.MathUtils.lerp(offset,-.96-.055*entry,t);
  }

  function applyLanding(offset){
    if(landingPulse<=.001)return offset;
    const t=landingPulse,strength=landingStrength;
    const impact=t*t*strength;
    pose.hips[0]+=.20*impact;pose.spine[0]+=.14*impact;pose.chest[0]-=.04*impact;
    pose.neck[0]-=.07*impact;pose.head[0]-=.05*impact;
    for(const side of SIDES){
      pose[side+'Thigh'][0]-=.30*impact;
      pose[side+'Shin'][0]+=.58*impact;
      pose[side+'Foot'][0]-=.12*impact;
      pose[side+'UpperArm'][0]-=.16*impact;
      pose[side+'Forearm'][0]-=.10*impact;
    }
    return offset-.13*impact;
  }

  resetPose();
  const idleBreath=Math.sin(elapsed*1.7);
  set('spine',-.012+idleBreath*.006);set('chest',idleBreath*.008);set('neck',-.008);
  for(const side of SIDES){set(side+'UpperArm',0);set(side+'Forearm',-.14);set(side+'Thigh',-.035);set(side+'Shin',.09);set(side+'Foot',-.045);}
  applyPose(0,1);model.updateWorldMatrix(true,true);
  for(const side of SIDES)if(worldDirection(rig[side+'UpperArm'],rig[side+'Forearm'],tmpVecA).y>-.55)throw new Error('Idle arm validation failed.');
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});box.setFromObject(model,true);model.position.y-=box.min.y;model.updateWorldMatrix(true,true);root.rotation.y=Math.PI/2;model.visible=true;

  function footHeight(){
    // Only update the two foot ancestry chains needed for grounding. The renderer
    // will update the full hierarchy later; no per-frame skeleton traversal is needed here.
    rig.leftFoot.updateWorldMatrix(true,false);rig.rightFoot.updateWorldMatrix(true,false);
    rootInverse.copy(root.matrixWorld).invert();
    let min=Infinity;
    footPoint.setFromMatrixPosition(rig.leftFoot.matrixWorld).applyMatrix4(rootInverse);min=Math.min(min,footPoint.y);
    footPoint.setFromMatrixPosition(rig.rightFoot.matrixWorld).applyMatrix4(rootInverse);min=Math.min(min,footPoint.y);
    return min;
  }
  const restingFootHeight=footHeight();

  return{
    root,model,boneCount:bones.length,
    update(dt,{state='RUN',speed=1,normalizedSpeed=0,jumpHeight=0,vy=0,grounded=true,jumpHeld=false,jumpAge=0,sliding=false,landed=false,landingVelocity=0,paused=false}={}){
      if(paused)return;
      dt=clamp(Number(dt)||0,0,.05);elapsed+=dt;
      const speedRatio=clamp(speed,.25,4),moving=(state==='RUN'||state==='WALK')&&grounded&&!sliding;
      const speedT=smooth01((speedRatio-.72)/1.75);

      if(!wasGrounded&&grounded)lastHalfStep=Math.floor((gaitPhase+.0001)/Math.PI);
      if(wasGrounded&&!grounded)lastAirPhase='anticipation';
      if(!wasSliding&&sliding){slideBlend=Math.max(slideBlend,.82);slideEntryPulse=1;}
      else if(wasSliding&&!sliding)slideExitPulse=1;
      wasGrounded=grounded;wasSliding=sliding;

      slideBlend=THREE.MathUtils.damp(slideBlend,sliding?1:0,sliding?38:13,dt);
      slideEntryPulse=Math.max(0,slideEntryPulse-dt*9.5);
      slideExitPulse=Math.max(0,slideExitPulse-dt*7.5);
      if(landed){
        landingPulse=1;
        landingStrength=clamp((landingVelocity||520)/720,.45,1.15);
      }
      landingPulse=Math.max(0,landingPulse-dt*(5.4+1.8/Math.max(.45,landingStrength)));

      if(moving){
        const previousPhase=gaitPhase,cadence=8.7+5.2*speedT;
        gaitPhase+=dt*cadence;
        updateFootContacts(previousPhase,gaitPhase,.58+.40*speedT,speedRatio);
      }else lastHalfStep=Math.floor((gaitPhase+.0001)/Math.PI);

      resetPose();
      let offset=0;
      if(!grounded||state==='JUMP')offset=jumpPose(jumpHeight,vy,jumpHeld,jumpAge);
      else if(state==='RUN'||state==='WALK')offset=runPose(speedRatio);
      else{
        const breath=Math.sin(elapsed*1.7);
        set('spine',-.012+breath*.006);set('chest',breath*.008);set('neck',-.008);set('head',Math.sin(elapsed*.7)*.006,Math.sin(elapsed*.5)*.009);
        for(const side of SIDES){set(side+'UpperArm',0);set(side+'Forearm',-.14);set(side+'Thigh',-.035);set(side+'Shin',.09);set(side+'Foot',-.045);}
        offset=breath*.003;
      }
      offset=blendSlide(offset);
      if(grounded&&!sliding)offset=applyLanding(offset);

      const alpha=1-Math.exp(-(sliding?24:17)*dt);
      applyPose(offset,alpha);

      if(grounded){
        const correction=clamp(groundCorrection+restingFootHeight-footHeight(),-.16,.16);
        const safeCorrection=sliding?Math.min(0,correction):correction;
        groundCorrection=THREE.MathUtils.damp(groundCorrection,safeCorrection,sliding?30:20,dt);
      }else groundCorrection=THREE.MathUtils.damp(groundCorrection,0,18,dt);
      visual.position.y=bodyOffset+groundCorrection;
    },
    setFacingRight(right=true){root.rotation.y=right?Math.PI/2:-Math.PI/2;},
    dispose(){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());}
  };
}
