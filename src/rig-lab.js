import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

// MANUAL BONE MAPPING: exact GLB bone names; null means automatic detection.
// Check the console table and hierarchy. Ambiguous matches are never selected.
const BONE_MAPPING = {
  hips: null, spine: null, chest: null, neck: null, head: null,
  leftShoulder: null, leftUpperArm: null, leftForearm: null, leftHand: null,
  rightShoulder: null, rightUpperArm: null, rightForearm: null, rightHand: null,
  leftThigh: null, leftShin: null, leftFoot: null,
  rightThigh: null, rightShin: null, rightFoot: null,
};
const ARM_REST_ANGLE = THREE.MathUtils.degToRad(22); // Slightly open arms, halfway toward an A-pose.
const MODEL_YAW = 0; // Set Math.PI if this model faces -Z. Gameplay forward is +Z.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8cbd5);
scene.fog = new THREE.Fog(0xb8cbd5, 25, 90);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe5f3ff, 0x72725a, 2.3));
const sun = new THREE.DirectionalLight(0xfff0dc, 3);
sun.position.set(5, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -8;
sun.shadow.camera.right = sun.shadow.camera.top = 8;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x82938b, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const player = new THREE.Group();
const visual = new THREE.Group();
player.add(visual);
scene.add(player);
camera.position.set(0, 2.6, -4.5);
const message = document.querySelector('#message');
const ui = Object.fromEntries(['state', 'speed', 'grounded'].map(id => [id, document.getElementById(id)]));
const keys = new Set();
let model, helper, rig = {}, ready = false;
let state = 'IDLE', forced = null, speed = 0, grounded = true, velocityY = 0;
let jumpStage = '', stageTime = 0, phase = 0, elapsed = 0, bodyOffset = 0;
const rest = new Map(), bases = new Map(), axes = new Map();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const q = new THREE.Quaternion(), delta = new THREE.Quaternion();
const v = new THREE.Vector3(), targetCamera = new THREE.Vector3();
const aliases = {
  hips: ['hips', 'hip', 'pelvis'], spine: ['spine', 'spine0', 'spine1', 'spine01'],
  chest: ['chest', 'upperchest', 'spine2', 'spine02', 'spine3'],
  neck: ['neck', 'neck1'], head: ['head'],
  Shoulder: ['shoulder', 'clavicle', 'collar'], UpperArm: ['upperarm', 'arm', 'uparm'],
  Forearm: ['forearm', 'lowerarm', 'elbow'], Hand: ['hand', 'wrist'],
  Thigh: ['thigh', 'upleg', 'upperleg'], Shin: ['shin', 'calf', 'leg', 'lowerleg', 'knee'],
  Foot: ['foot', 'ankle'],
};
function nameParts(name) {
  let s = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    .replace(/mixamorig\d*[:_ ]*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
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
  console.log('Manual overrides: BONE_MAPPING near the top of src/main.js.');
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
function makePose(time, gait) {
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
    let crouch = 0;
    if (jumpStage === 'CROUCH') crouch = Math.sin(Math.min(stageTime / 0.18, 1) * Math.PI / 2);
    else if (jumpStage === 'LAND') crouch = Math.sin(Math.min(stageTime / 0.26, 1) * Math.PI);
    else if (jumpStage === 'AIRBORNE') crouch = 0.28;
    offset = -0.16 * crouch;
    set('hips', 0.12 * crouch); set('spine', 0.12 * crouch);
    for (const side of ['left', 'right']) {
      set(side + 'Thigh', -0.55 * crouch);
      set(side + 'Shin', 1.05 * crouch);
      set(side + 'Foot', -0.45 * crouch);
      set(side + 'UpperArm', jumpStage === 'CROUCH' ? 0.3 * crouch : -0.5);
      set(side + 'Forearm', -0.4);
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
new GLTFLoader().load(import.meta.env.BASE_URL + 'model/chimpion.glb', gltf => {
  model = gltf.scene;
  model.visible = false; // Never attach a visible rest-pose model.
  visual.add(model);
  try {
    model.rotation.y += MODEL_YAW;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid model bounds.');
    model.scale.multiplyScalar(1.8 / height);
    model.updateWorldMatrix(true, true);
    const scaled = new THREE.Box3().setFromObject(model, true);
    model.position.x -= (scaled.min.x + scaled.max.x) / 2;
    model.position.z -= (scaled.min.z + scaled.max.z) / 2;
    model.position.y -= scaled.min.y;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const report = inspect(model);
    prepareIdle();
    // Ground the posed mesh, not the T-pose bounds.
    model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
    const posed = new THREE.Box3().setFromObject(model, true);
    model.position.y -= posed.min.y;
    model.updateWorldMatrix(true, true);
    helper = new THREE.SkeletonHelper(model);
    helper.material.depthTest = false;
    helper.renderOrder = 10;
    helper.visible = document.querySelector('#skeleton').checked;
    scene.add(helper);
    model.visible = true;
    ready = true;
    message.textContent = '';
    if (report.some(row => row.bone === 'UNRESOLVED')) console.warn('Some bones unresolved. Review BONE_MAPPING for full rig coverage.');
  } catch (error) { model.visible = false; message.textContent = error.message; console.error(error); }
}, undefined, error => {
  message.textContent = 'Could not load public/model/chimpion.glb. Check the file and console.';
  console.error(error);
});
function jump() {
  if (!ready || !grounded || jumpStage) return;
  state = 'JUMP'; jumpStage = 'CROUCH'; stageTime = 0;
}
const controlKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight', 'Space'];
addEventListener('keydown', event => {
  if (!controlKeys.includes(event.code)) return;
  if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
  event.preventDefault();
  keys.add(event.code);
  forced = null;
  if (event.code === 'Space' && !event.repeat) jump();
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
document.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click', () => {
  if (!ready) return;
  if (button.dataset.state === 'JUMP') jump();
  else forced = button.dataset.state;
  button.blur();
}));
document.querySelector('#skeleton').addEventListener('change', event => { if (helper) helper.visible = event.target.checked; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
function update(dt) {
  elapsed += dt;
  const direction = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const desired = direction * (run ? 3.5 : 1.5);
  speed = THREE.MathUtils.damp(speed, forced ? 0 : desired, 9, dt);
  player.rotation.y += (Number(keys.has('KeyA')) - Number(keys.has('KeyD'))) * 2.3 * dt;
  if (jumpStage) {
    stageTime += dt;
    if (jumpStage === 'CROUCH' && stageTime >= 0.18) {
      jumpStage = 'TAKEOFF'; stageTime = 0; velocityY = 4.5; grounded = false;
    } else if (jumpStage === 'TAKEOFF' && stageTime >= 0.12) {
      jumpStage = 'AIRBORNE'; stageTime = 0;
    } else if (jumpStage === 'LAND' && stageTime >= 0.26) {
      jumpStage = ''; stageTime = 0;
    }
  }
  if (!grounded) {
    velocityY -= 12 * dt;
    player.position.y += velocityY * dt;
    if (player.position.y <= 0) {
      player.position.y = 0; velocityY = 0; grounded = true;
      jumpStage = 'LAND'; stageTime = 0;
    }
  }
  state = jumpStage ? (jumpStage === 'LAND' ? 'LAND' : 'JUMP')
    : forced || (Math.abs(speed) < 0.05 ? 'IDLE' : run ? 'RUN' : 'WALK');
  const gait = state === 'WALK' || state === 'RUN' ? (forced ? 1 : Math.min(Math.abs(speed) / (state === 'RUN' ? 3.5 : 1.5), 1)) : 0;
  phase += dt * (state === 'RUN' ? 12 : 7) * (speed < -0.05 ? -1 : 1);
  player.position.addScaledVector(v.set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)), speed * dt);
  applyPose(makePose(elapsed, gait), 1 - Math.exp(-14 * dt));
  model.updateWorldMatrix(true, true);
  targetCamera.set(0, 2.4, -4.2).applyAxisAngle(Y, player.rotation.y).add(player.position);
  camera.position.lerp(targetCamera, 1 - Math.exp(-5 * dt));
  camera.lookAt(v.copy(player.position).add(new THREE.Vector3(0, 1, 0)));
  sun.position.copy(player.position).add(new THREE.Vector3(5, 9, 4));
  sun.target.position.copy(player.position);
  ui.state.value = state; ui.speed.value = Math.abs(speed).toFixed(2); ui.grounded.value = String(grounded);
  document.querySelectorAll('[data-state]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === (forced || state))));
}
// Read-only snapshot for browser smoke checks. No rest-pose/debug reset action exists.
window.rigSandbox = () => ({
  ready, state, grounded, speed, jumpStage, visible: !!model?.visible,
  position: player.position.toArray(), boneCount: rest.size,
  mapping: Object.fromEntries(Object.entries(rig).map(([k, b]) => [k, b.name])),
  armsDown: ready && ['left', 'right'].every(side => worldDirection(rig[side + 'UpperArm'], rig[side + 'Forearm']).y < -0.4),
});
let previous = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(Math.max((now - previous) / 1000, 0), 0.033);
  previous = now;
  if (ready) update(dt);
  renderer.render(scene, camera);
});
