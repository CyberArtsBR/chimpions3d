import * as THREE from 'three';

export const BONE_KEYS = Object.freeze([
  'hips','spine','chest','neck','head',
  'leftShoulder','leftUpperArm','leftForearm','leftHand',
  'rightShoulder','rightUpperArm','rightForearm','rightHand',
  'leftThigh','leftShin','leftFoot',
  'rightThigh','rightShin','rightFoot',
]);

export const REQUIRED_BONES = Object.freeze([
  'hips',
  'leftUpperArm','leftForearm','rightUpperArm','rightForearm',
  'leftThigh','leftShin','leftFoot',
  'rightThigh','rightShin','rightFoot',
]);

export const DEFAULT_BONE_MAPPING = Object.freeze(Object.fromEntries(BONE_KEYS.map(key => [key, null])));

const ARM_REST_ANGLE = THREE.MathUtils.degToRad(22);
const WORLD_X = new THREE.Vector3(1,0,0);
const WORLD_Y = new THREE.Vector3(0,1,0);
const WORLD_Z = new THREE.Vector3(0,0,1);
const SECONDARY_TOKENS = Object.freeze(['ear','tail','hat','cap','bandana','ponytail','accessory','strap']);

const ALIASES = Object.freeze({
  hips: ['hips','hip','pelvis'],
  spine: ['spine','spine0','spine1','spine01','lowerspine','abdomen'],
  chest: ['chest','upperchest','spine2','spine02','spine3','upperbody'],
  neck: ['neck','neck1','necktwist01'],
  head: ['head'],
  Shoulder: ['shoulder','clavicle','collar'],
  UpperArm: ['upperarm','arm','uparm'],
  Forearm: ['forearm','lowerarm','elbow'],
  Hand: ['hand','wrist'],
  Thigh: ['thigh','upleg','upperleg'],
  Shin: ['shin','calf','leg','lowerleg','knee'],
  Foot: ['foot','ankle'],
});

function nameParts(name) {
  let normalized = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/mixamorig\d*[:_ ]*/g, '')
    .replace(/cc[_ ]*base[_ ]*/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = normalized ? normalized.split(/\s+/) : [];
  let side = words.includes('left') || words.includes('l') ? 'left'
    : words.includes('right') || words.includes('r') ? 'right' : '';
  let core = words
    .filter(word => !['left','right','l','r','bone','def','bip','bip001','j'].includes(word))
    .join('');
  if (!side && /^(left|right)/.test(core)) {
    side = core.startsWith('left') ? 'left' : 'right';
    core = core.slice(side.length);
  }
  if (!side && /(left|right)$/.test(core)) {
    side = core.endsWith('left') ? 'left' : 'right';
    core = core.slice(0, -side.length);
  }
  return {side, core};
}

export function isDescendant(child, ancestor) {
  if (!child || !ancestor) return false;
  for (let parent = child.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true;
  }
  return false;
}

function printBoneHierarchy(root) {
  console.group('GLB bone hierarchy (all bones)');
  const visit = (object, depth = 0) => {
    if (object.isBone) console.log('  '.repeat(depth) + object.name);
    for (const child of object.children) visit(child, depth + (object.isBone ? 1 : 0));
  };
  visit(root);
  console.groupEnd();
}

export function mapHumanoidRig(root, overrides = {}) {
  const mapping = {...DEFAULT_BONE_MAPPING, ...overrides};
  const bones = [];
  root.traverse(object => {
    if (object.isBone) bones.push(object);
  });
  if (!bones.length) throw new Error('GLB has no bones.');

  printBoneHierarchy(root);

  const rig = Object.create(null);
  const used = new Set();
  const report = [];

  for (const key of BONE_KEYS) {
    const side = key.startsWith('left') ? 'left' : key.startsWith('right') ? 'right' : '';
    const kind = side ? key.slice(side.length) : key;
    const manual = mapping[key];
    let matches = bones.filter(bone => {
      if (manual) return bone.name === manual;
      const parsed = nameParts(bone.name);
      return parsed.side === side && ALIASES[kind]?.includes(parsed.core);
    });

    if (!manual && key === 'hips' && matches.length > 1) {
      matches = matches.filter(bone => matches.every(other => other === bone || isDescendant(other, bone)));
    }
    if (!manual && matches.length > 1 && (key === 'spine' || key === 'chest')) {
      matches = matches.filter(bone => matches.every(other => other === bone ||
        (key === 'spine' ? isDescendant(other, bone) : isDescendant(bone, other))));
    }

    const bone = matches.length === 1 && !used.has(matches[0]) ? matches[0] : null;
    if (bone) {
      rig[key] = bone;
      used.add(bone);
    }
    report.push({
      slot: key,
      bone: bone?.name || 'UNRESOLVED',
      candidates: matches.map(candidate => candidate.name).join(', '),
      source: manual ? 'manual' : 'automatic',
    });
  }

  console.table(report);
  console.log('Manual overrides can be passed as the second argument to loadCharacter().');

  const missing = REQUIRED_BONES.filter(key => !rig[key]);
  if (missing.length) {
    throw new Error('Could not map: ' + missing.join(', ') + '. Use a compatible humanoid rig or configure bone overrides.');
  }
  if (!bones.some(bone => bone.parent)) {
    throw new Error('Bone hierarchy is invalid; character remains hidden.');
  }
  for (const side of ['left','right']) {
    if (!isDescendant(rig[side + 'Forearm'], rig[side + 'UpperArm'])) {
      throw new Error(side + ' forearm must descend from upper arm. Correct the bone mapping.');
    }
    if (!isDescendant(rig[side + 'Shin'], rig[side + 'Thigh'])) {
      throw new Error(side + ' shin must descend from thigh. Correct the bone mapping.');
    }
  }

  return {rig, bones, report};
}

function worldDirection(fromBone, toBone, output, fromPosition, toPosition) {
  fromBone.getWorldPosition(fromPosition);
  toBone.getWorldPosition(toPosition);
  return output.copy(toPosition).sub(fromPosition).normalize();
}

export function prepareAnimationRig(model, rig) {
  const authoredBases = new Map();
  model.traverse(object => {
    if (object.isBone) authoredBases.set(object, object.quaternion.clone().normalize());
  });

  const direction = new THREE.Vector3();
  const fromPosition = new THREE.Vector3();
  const toPosition = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const parentWorld = new THREE.Quaternion();
  const boneWorld = new THREE.Quaternion();
  const correction = new THREE.Quaternion();

  try {
    for (const side of ['left','right']) {
      const arm = rig[side + 'UpperArm'];
      const forearm = rig[side + 'Forearm'];
      model.updateWorldMatrix(true, true);
      worldDirection(arm, forearm, direction, fromPosition, toPosition);
      if (direction.lengthSq() < 0.5) {
        throw new Error('Arm has zero length; cannot safely prepare animation rig.');
      }
      desired.set(
        (side === 'left' ? 1 : -1) * Math.sin(ARM_REST_ANGLE),
        -Math.cos(ARM_REST_ANGLE),
        0.04,
      ).normalize();
      arm.parent.getWorldQuaternion(parentWorld);
      arm.getWorldQuaternion(boneWorld);
      correction.setFromUnitVectors(direction, desired);
      arm.quaternion.copy(parentWorld.invert().multiply(correction).multiply(boneWorld)).normalize();
    }

    model.updateWorldMatrix(true, true);

    const entries = [];
    for (const key of BONE_KEYS) {
      const bone = rig[key];
      if (!bone) continue;
      const worldInverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
      entries.push({
        key,
        bone,
        base: bone.quaternion.clone().normalize(),
        authoredBase: authoredBases.get(bone)?.clone() || bone.quaternion.clone().normalize(),
        axes: [
          WORLD_X.clone().applyQuaternion(worldInverse).normalize(),
          WORLD_Y.clone().applyQuaternion(worldInverse).normalize(),
          WORLD_Z.clone().applyQuaternion(worldInverse).normalize(),
        ],
      });
    }

    for (const side of ['left','right']) {
      model.updateWorldMatrix(true, true);
      worldDirection(rig[side + 'UpperArm'], rig[side + 'Forearm'], direction, fromPosition, toPosition);
      if (direction.y > -0.6) {
        throw new Error('Idle arm validation failed. Character stays hidden; review bone mapping.');
      }
    }

    return entries;
  } finally {
    for (const [bone, authoredBase] of authoredBases) {
      bone.quaternion.copy(authoredBase).normalize();
    }
    model.updateWorldMatrix(true, true);
  }
}

export function mapSecondaryMotionBones(root, rigEntries = [], maxBones = 12) {
  const excluded = new Set(rigEntries.map(entry => entry.bone));
  const selected = [];

  root.traverse(object => {
    if (!object.isBone || excluded.has(object) || selected.length >= maxBones) return;
    const words = String(object.name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (!SECONDARY_TOKENS.some(token => words.some(word => word === token || word.startsWith(token)))) return;
    if (selected.some(entry => isDescendant(object, entry.bone))) return;

    selected.push({
      bone: object,
      base: object.quaternion.clone().normalize(),
      phase: selected.length % 2 === 0 ? 1 : -1,
    });
  });

  return selected;
}

export function validateFiniteSkeleton(bones) {
  let maxQuaternionNormError = 0;
  let maxScale = 0;
  for (const bone of bones) {
    const q = bone.quaternion;
    const values = [q.x,q.y,q.z,q.w,bone.position.x,bone.position.y,bone.position.z,bone.scale.x,bone.scale.y,bone.scale.z];
    if (!values.every(Number.isFinite)) return {ok:false, reason:'non-finite transform', bone:bone.name};
    const norm = Math.hypot(q.x,q.y,q.z,q.w);
    maxQuaternionNormError = Math.max(maxQuaternionNormError, Math.abs(1 - norm));
    maxScale = Math.max(maxScale, Math.abs(bone.scale.x), Math.abs(bone.scale.y), Math.abs(bone.scale.z));
  }
  return {ok:true, maxQuaternionNormError, maxScale};
}
