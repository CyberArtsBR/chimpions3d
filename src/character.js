import * as THREE from 'three';
import {JUMP} from './physics.js';
import {validateGLB} from './upload.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// MANUAL BONE MAPPING: exact GLB bone names; null means automatic detection.
// Check the console table and hierarchy. Ambiguous matches are never selected.
const DEFAULT_BONE_MAPPING = {
  hips: null, spine: null, chest: null, neck: null, head: null,
  leftShoulder: null, leftUpperArm: null, leftForearm: null, leftHand: null,
  rightShoulder: null, rightUpperArm: null, rightForearm: null, rightHand: null,
  leftThigh: null, leftShin: null, leftFoot: null,
  rightThigh: null, rightShin: null, rightFoot: null,
};
const ARM_REST_ANGLE = THREE.MathUtils.degToRad(22); // Slightly open arms, halfway toward an A-pose.
const MODEL_YAW = 0; // Set Math.PI if this model faces -Z. Gameplay forward is +Z.

export async function loadCharacter(url, overrides = {}) {
  const BONE_MAPPING={...DEFAULT_BONE_MAPPING,...overrides};
  const manager=new THREE.LoadingManager();
  if(url instanceof ArrayBuffer){
    validateGLB(url);
    manager.setURLModifier(value=>{
      if(!value.startsWith('blob:')&&!value.startsWith('data:'))throw new Error('External avatar resources are not supported.');
      return value;
    });
  }
  const loader=new GLTFLoader(manager);
  const gltf = url instanceof ArrayBuffer?await loader.parseAsync(url,''):await loader.loadAsync(url);
  const model = gltf.scene;
  model.visible = false;
  const root = new THREE.Group(), visual = new THREE.Group();
  root.add(visual); visual.add(model);
  const rig = {}, rest = new Map(), bases = new Map(), axes = new Map();
  const X = new THREE.Vector3(1,0,0), Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
  const q = new THREE.Quaternion(), delta = new THREE.Quaternion();
  let state='IDLE', phase=0, jumpStage='', stageTime=0, bodyOffset=0, armLift=0, launchVelocity=JUMP;

  const aliases = {
  hips: ['hips', 'hip', 'pelvis'], spine: ['spine', 'spine0', 'spine1', 'spine01'],
  chest: ['chest', 'upperchest', 'spine2', 'spine02', 'spine3'],
  neck: ['neck', 'neck1', 'necktwist01'], head: ['head'],
  Shoulder: ['shoulder', 'clavicle', 'collar'], UpperArm: ['upperarm', 'arm', 'uparm'],
  Forearm: ['forearm', 'lowerarm', 'elbow'], Hand: ['hand', 'wrist'],
  Thigh: ['thigh', 'upleg', 'upperleg'], Shin: ['shin', 'calf', 'leg', 'lowerleg', 'knee'],
  Foot: ['foot', 'ankle'],
};
function nameParts(name) {
  let s = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    .replace(/mixamorig\d*[:_ ]*/g, '').replace(/cc[_ ]*base[_ ]*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let words = s.split(/\s+/);
  let side = words.includes('left') || words.includes('l') ? 'left'
    : words.includes('right') || words.includes('r') ? 'right' : '';
  let core = words.filter(w => !['left', 'right', 'l', 'r', 'bone', 'def', 'bip', 'bip001'].includes(w)).join('');
  if (!side && /^(left|right)/.test(core)) {
    side = core.startsWith('left') ? 'left' : 'right'; core = core.slice(side.length);
  }
  return { side, core };
}
function inspect(root) {
  const bones = [];
  root.traverse(o => { if (o.isBone) bones.push(o); });
  console.group('GLB bone hierarchy (all bones)');
  function print(o, depth = 0) {
    if (o.isBone) console.log('  '.repeat(depth) + o.name);
    o.children.forEach(c => print(c, depth + (o.isBone ? 1 : 0)));
  }
  print(root); console.groupEnd();
  const used = new Set(), report = [];
  for (const key of Object.keys(BONE_MAPPING)) {
    const side = key.startsWith('left') ? 'left' : key.startsWith('right') ? 'right' : '';
    const kind = side ? key.slice(side.length) : key;
    let matches = bones.filter(b => {
      if (BONE_MAPPING[key]) return b.name === BONE_MAPPING[key];
      const p = nameParts(b.name);
      return p.side === side && aliases[kind].includes(p.core);
    });
    // Hip/Pelvis chains: select the common ancestor, never an arbitrary match.
    if (!BONE_MAPPING[key] && key === 'hips' && matches.length > 1) {
      matches = matches.filter(b => matches.every(other => other === b || isDescendant(other, b)));
    }
    // Numbered spine segments form a chain: use its lowest spine / highest chest.
    if (!BONE_MAPPING[key] && matches.length > 1 && (key === 'spine' || key === 'chest')) {
      matches = matches.filter(b => matches.every(other => other === b ||
        (key === 'spine' ? isDescendant(other, b) : isDescendant(b, other))));
    }
    const bone = matches.length === 1 && !used.has(matches[0]) ? matches[0] : null;
    if (bone) { rig[key] = bone; used.add(bone); }
    report.push({ slot: key, bone: bone?.name || 'UNRESOLVED', candidates: matches.map(b => b.name).join(', ') });
  }
  console.table(report);
  console.log('Manual overrides: BONE_MAPPING near the top of src/character.js.');
  for (const b of bones) rest.set(b, b.quaternion.clone());
  if (!bones.length) throw new Error('GLB has no bones.');
  if (!bones.some(b => b.parent) || !rig.leftUpperArm || !rig.rightUpperArm || !rig.leftForearm || !rig.rightForearm)
    throw new Error('Arm mapping is incomplete or ambiguous. Set BONE_MAPPING; character remains hidden.');
  return report;
}
function worldDirection(a, b) {
  return b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
}
function prepareIdle() {
  // Rest quaternions and skin inverse-bind matrices remain untouched.
  // Solve upper arms in world space, then convert back to each parent's frame.
  for (const side of ['left', 'right']) {
    const arm = rig[side + 'UpperArm'], elbow = rig[side + 'Forearm'];
    if (!isDescendant(elbow, arm)) throw new Error('Forearm must descend from upper arm. Correct BONE_MAPPING.');
    model.updateWorldMatrix(true, true);
    const from = worldDirection(arm, elbow);
    if (from.lengthSq() < 0.5) throw new Error('Arm has zero length; cannot safely prepare idle.');
    const to = new THREE.Vector3(
      (side === 'left' ? 1 : -1) * Math.sin(ARM_REST_ANGLE),
      -Math.cos(ARM_REST_ANGLE), 0.04,
    ).normalize();
    const parentWorld = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    const world = arm.getWorldQuaternion(new THREE.Quaternion());
    arm.quaternion.copy(parentWorld.invert().multiply(new THREE.Quaternion().setFromUnitVectors(from, to)).multiply(world));
  }
  model.updateWorldMatrix(true, true);
  for (const [key, bone] of Object.entries(rig)) {
    bases.set(key, bone.quaternion.clone());
    const inverseWorld = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    axes.set(key, [X, Y, Z].map(axis => axis.clone().applyQuaternion(inverseWorld)));
  }
  applyPose(makePose(0, 0), 1);
  model.updateWorldMatrix(true, true);
  // Fail closed: arms must actually point down before the model is revealed.
  for (const side of ['left', 'right']) {
    if (worldDirection(rig[side + 'UpperArm'], rig[side + 'Forearm']).y > -0.6)
      throw new Error('Idle arm validation failed. Character stays hidden; review bone mapping.');
  }
}
function isDescendant(child, ancestor) {
  for (let p = child.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
}
function makePose(time, gait, motion={}) {
  const pose = {};
  const set = (key, x = 0, y = 0, z = 0) => { pose[key] = [x, y, z]; };
  const running = state === 'RUN';
  const stride = (running ? 0.85 : 0.48) * gait;
  const swing = Math.sin(phase), breath = Math.sin(time * 1.7);
  set('hips', running ? 0.09 * gait : 0, swing * 0.035 * gait, swing * 0.025 * gait);
  set('spine', -0.015 + breath * 0.008 + (running ? 0.09 * gait : 0));
  set('chest', breath * 0.01, -swing * 0.055 * gait);
  set('neck', -0.01);
  set('head', Math.sin(time * 0.7) * 0.012, Math.sin(time * 0.5) * 0.02);
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const cycle = swing * sign;
    set(side + 'Shoulder', 0, 0, -sign * 0.025);
    set(side + 'UpperArm', cycle * (running ? 0.65 : 0.3) * gait, 0, sign * breath * 0.007);
    set(side + 'Forearm', -0.16 - (running ? 0.7 : 0.12) * gait - Math.max(0, cycle) * 0.16 * gait);
    set(side + 'Hand', 0.025);
    set(side + 'Thigh', -0.055 - cycle * stride);
    set(side + 'Shin', 0.11 + Math.max(0, -cycle) * (running ? 1.15 : 0.65) * gait);
    set(side + 'Foot', -0.055 - Math.max(0, -cycle) * 0.22 * gait);
  }
  let offset = breath * 0.004 + Math.abs(Math.cos(phase)) * (running ? 0.065 : 0.025) * gait;
  if (state === 'JUMP' || state === 'LAND') {
    const launch=Math.max(0,Math.min(1,motion.launch||0));
    const ascend=Math.max(0,Math.min(1,motion.ascend||0));
    const apex=Math.max(0,Math.min(1,motion.apex||0));
    const descend=Math.max(0,Math.min(1,motion.descend||0));
    const landing=Math.max(0,Math.min(1,motion.landing||0));
    const compression=Math.min(1,launch*.92+landing*.88+apex*.22);
    // Keep the physical root untouched: all extra motion lives inside the visual rig.
    // The silhouette now reads as push-off, extension, float, fall preparation and contact.
    offset=-.18*launch+.045*ascend-.04*apex-.025*descend-.14*landing;
    set('hips', .16*compression-.055*ascend+.045*descend);
    set('spine', .13*launch-.085*ascend+.055*apex+.075*descend+.11*landing);
    set('chest', -.055*ascend+.035*apex+.065*descend+.045*landing);
    set('neck', -.018+.025*apex-.018*descend);
    set('head', -.025*ascend+.038*apex+.025*descend);
    for (const [side,sign] of [['left',1],['right',-1]]) {
      const asym=sign*(.045*ascend+.07*descend);
      set(side+'Thigh',-.72*launch-.12*ascend-.32*apex+.09*descend-.5*landing+asym);
      set(side+'Shin',1.18*launch+.12*ascend+.62*apex+.18*descend+.92*landing);
      set(side+'Foot',-.5*launch+.08*ascend-.22*apex+.13*descend-.34*landing);
      set(side+'Shoulder',-.08*ascend-.05*apex,0,sign*(.08*apex+.055*descend));
      set(side+'UpperArm',.24*launch-1.02*ascend-.7*apex-.31*descend+.13*landing,0,sign*(.055*apex+.035*descend));
      set(side+'Forearm',-.18-.2*launch-.3*ascend-.22*apex-.1*descend-.16*landing);
      set(side+'Hand',.025+.08*ascend+.05*apex);
    }
  }
  return { pose, offset };
}
function applyPose({ pose, offset }, alpha) {
  for (const [key, bone] of Object.entries(rig)) {
    q.copy(bases.get(key));
    (pose[key] || [0, 0, 0]).forEach((angle, i) => q.multiply(delta.setFromAxisAngle(axes.get(key)[i], angle)));
    bone.quaternion.slerp(q, alpha);
  }
  bodyOffset = THREE.MathUtils.lerp(bodyOffset, offset, alpha);
  visual.position.y = bodyOffset;
}

  try {
  let triangles=0,skinned=0;const textures=new Set();
  model.traverse(o=>{
    if(o.isSkinnedMesh)skinned++;
    if(o.isMesh){
      triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;
      for(const material of (Array.isArray(o.material)?o.material:[o.material]))Object.values(material||{}).forEach(v=>{if(v?.isTexture)textures.add(v);});
    }
  });
  if(!skinned)throw new Error('The avatar has no skinned mesh.');
  if(triangles>300000)throw new Error('Use an avatar below 300,000 triangles for this browser test.');
  let pixels=0;for(const texture of textures){const image=texture.source?.data;pixels+=(image?.width||0)*(image?.height||0);}
  if(pixels>48*1024*1024)throw new Error('Avatar textures are too large. Try 2K or smaller textures.');
  model.rotation.y += MODEL_YAW;
  model.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(model,true);
  const height=box.max.y-box.min.y;
  if (!(height>0)) throw new Error('Invalid avatar dimensions');
  model.scale.multiplyScalar(1.45/height);
  model.updateWorldMatrix(true,true);
  box.setFromObject(model,true);
  model.position.x-=(box.min.x+box.max.x)/2;
  model.position.z-=(box.min.z+box.max.z)/2;
  model.position.y-=box.min.y;
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=o.isSkinnedMesh;o.receiveShadow=false;}});
  inspect(model);
  const required=['hips','leftThigh','rightThigh','leftShin','rightShin','leftFoot','rightFoot'];
  const missing=required.filter(key=>!rig[key]);
  if(missing.length)throw new Error('Could not map: '+missing.join(', ')+'. Use a compatible humanoid rig or configure bone overrides.');
  prepareIdle();
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  box.setFromObject(model,true);
  model.position.y-=box.min.y;
  model.updateWorldMatrix(true,true);
  model.visible=true;
  return {
    root, model, boneCount:rest.size, triangles,
    update(dt,time,velocity,bounceAge,active,feel={}) {
      if(active&&bounceAge<.04&&velocity>0)launchVelocity=Math.max(JUMP,velocity);
      const landing=active?Math.max(0,Math.min(1,feel.landing||0)):0;
      const launch=active?Math.max(0,Math.min(1,1-bounceAge/.14)):0;
      const ascend=active&&velocity>1.15?Math.max(0,Math.min(1,velocity/launchVelocity)):0;
      const apex=active?Math.max(0,1-Math.abs(velocity)/3.1):0;
      const descend=active&&velocity<-.8?Math.max(0,Math.min(1,-velocity/launchVelocity)):0;
      state=landing>.12?'LAND':active?'JUMP':'IDLE';
      jumpStage=!active?'':launch>.08?'TAKEOFF':ascend>.12?'ASCEND':apex>.12?'APEX':landing>.12?'LAND':'DESCEND';
      stageTime=bounceAge;phase+=dt*7;
      const posed=makePose(time,0,{launch,ascend,apex,descend,landing});
      for(const side of ['left','right']){
        if(feel.dying){
          posed.pose[side+'UpperArm'][0]=-1.1+Math.sin(time*15+(side==='left'?0:2))*.35;
          posed.pose[side+'Shin'][0]=.5+Math.sin(time*12)*.2;
        }
      }
      // Slightly faster response at takeoff/contact, softer through the airborne arc.
      const poseRate=launch>.08||landing>.25?22:14;
      applyPose(posed,1-Math.exp(-poseRate*dt));
      const squash=active?Math.exp(-bounceAge*22)*.05:0;
      visual.scale.set(1+squash*.4,1-squash,1+squash*.4);
      visual.rotation.z=THREE.MathUtils.damp(visual.rotation.z,active?-(feel.vx||0)*.009:0,12,dt);
    }
  };
  }catch(error){disposeCharacter({root});throw error;}
}

export function disposeCharacter(a){
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 a.root.traverse(o=>{
  if(o.skeleton)skeletons.add(o.skeleton);
  if(o.geometry)geometries.add(o.geometry);
  for(const m of (o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){
   materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});
  }
 });
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
 skeletons.forEach(s=>s.dispose());
}
