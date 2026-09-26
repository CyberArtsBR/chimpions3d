import * as THREE from 'three';
import {JUMP} from './physics.js';
import {validateGLB} from './upload.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterAnimator} from './character/CharacterAnimator.js';
import {mapHumanoidRig, mapSecondaryMotionBones, prepareAnimationRig} from './character/rigUtils.js';
import {createTrackedLoadingManager,fetchAssetBuffer,trackAssetDecode} from './assetRuntime.js';

const MODEL_YAW = 0; // Set Math.PI only for a deliberately reversed authored model.

// Public stage vocabulary kept here for legacy audits/integration discovery.
// Runtime behavior is implemented by CharacterAnimator/poses; this list is descriptive only.
export const CHARACTER_ANIMATION_STAGES = Object.freeze([
  'IDLE','TAKEOFF','ASCEND','APEX','DESCEND','LAND',
  'SPRING','HAZARD','JETPACK','DYING','RESULT',
]);
const TEST_MODE = typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('test')
  && (import.meta.env.DEV || import.meta.env.VITE_CHIMP_QA_HOOKS === '1')
  && ['localhost','127.0.0.1'].includes(location.hostname);
let testHarnessOwner = null;

// Public compatibility contract for audit tooling and later game.js integration.
export const JUMP_ANIMATION_STAGES = Object.freeze(['TAKEOFF','ASCEND','APEX','DESCEND','LAND']);

function avatarStats(model) {
  let triangles = 0;
  let skinned = 0;
  const textures = new Set();

  model.traverse(object => {
    if (object.isSkinnedMesh) skinned++;
    if (!object.isMesh) return;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material || {})) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  if (!skinned) throw new Error('The avatar has no skinned mesh.');
  if (triangles > 300000) throw new Error('Use an avatar below 300,000 triangles for this browser test.');

  let pixels = 0;
  for (const texture of textures) {
    const image = texture.source?.data;
    pixels += (image?.width || 0) * (image?.height || 0);
  }
  if (pixels > 48 * 1024 * 1024) {
    throw new Error('Avatar textures are too large. Try 2K or smaller textures.');
  }

  return {triangles, skinned, textures};
}

function normalizeModel(model) {
  model.rotation.y += MODEL_YAW;
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model, true);
  const height = box.max.y - box.min.y;
  if (!(height > 0) || !Number.isFinite(height)) throw new Error('Invalid avatar dimensions');

  model.scale.multiplyScalar(1.45 / height);
  model.updateWorldMatrix(true, true);
  box.setFromObject(model, true);

  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;

  model.traverse(object => {
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.castShadow = object.isSkinnedMesh;
    object.receiveShadow = false;
  });
}

function settleModelFloor(model) {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model, true);
  if (![box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite)) {
    throw new Error('Avatar bounds became non-finite while preparing the skeleton.');
  }
  model.position.y -= box.min.y;
  model.updateWorldMatrix(true, true);
}

function installTestHarness(controller, animator) {
  if (!TEST_MODE) return;
  testHarnessOwner = controller;
  globalThis.__chimpCharacterAnimationTest = {
    exercise: () => animator.debugExercise(),
    diagnostics: () => animator.getDiagnostics(),
    events: () => animator.peekEvents(),
    state: () => animator.state,
  };
}

export async function loadCharacter(url, overrides = {}, {signal} = {}) {
  const localUpload=url instanceof ArrayBuffer;
  const manager=createTrackedLoadingManager(localUpload?'avatar-upload-dependency':'avatar-dependency');
  if (localUpload) {
    validateGLB(url);
    manager.setURLModifier(value => {
      if (!value.startsWith('blob:') && !value.startsWith('data:')) {
        throw new Error('External avatar resources are not supported.');
      }
      return value;
    });
  }

  const loader = new GLTFLoader(manager);
  let gltf;
  if(localUpload){
    gltf=await trackAssetDecode('avatar-upload','local-glb',()=>loader.parseAsync(url,''));
  }else{
    const absolute=new URL(String(url),globalThis.location?.href||'http://localhost/').href;
    const slash=absolute.lastIndexOf('/');
    const resourcePath=slash>=0?absolute.slice(0,slash+1):'';
    const bytes=await fetchAssetBuffer(absolute,{signal,kind:'avatar'});
    if(signal?.aborted)throw new DOMException('Avatar request was cancelled.','AbortError');
    gltf=await trackAssetDecode('avatar',absolute,()=>loader.parseAsync(bytes,resourcePath));
  }

  const model = gltf.scene;
  model.visible = false;

  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);
  visual.add(model);

  try {
    const stats = avatarStats(model);
    normalizeModel(model);

    const {rig, bones, report} = mapHumanoidRig(model, overrides);
    const rigEntries = prepareAnimationRig(model, rig);
    const secondaryEntries = mapSecondaryMotionBones(model, rigEntries);
    const animator = new CharacterAnimator({
      visual,
      model,
      rigEntries,
      secondaryEntries,
      bones,
      launchVelocity:JUMP,
    });

    model.traverse(object => {
      if (object.isSkinnedMesh) object.skeleton.update();
    });
    settleModelFloor(model);
    model.visible = true;

    const legacyInput = {
      active:false,
      velocityY:0,
      velocityX:0,
      bounceAge:1,
      landingAnticipation:0,
      landingImpact:0,
      platformType:'',
      platformVelocityX:0,
      springActive:false,
      springStrength:1,
      hazardHit:false,
      hazardDirection:1,
      jetpackActive:false,
      jetpackStrength:1,
      wrapEvent:null,
      dying:false,
      reducedMotion:false,
      landingQuality:'CLEAN',
      result:'',
    };

    const controller = {
      root,
      model,
      boneCount:bones.length,
      mappedBoneCount:rigEntries.length,
      secondaryBoneCount:secondaryEntries.length,
      triangles:stats.triangles,
      rigReport:report,

      /**
       * Backward-compatible adapter for the current game.js call site.
       * New integrations should prefer updateAnimation(dt, time, input).
       */
      update(dt, time, velocity, bounceAge, active, feel = {}) {
        const landing = Number.isFinite(feel.landing) ? Math.max(0, Math.min(1, feel.landing)) : 0;
        legacyInput.active = !!active;
        legacyInput.velocityY = Number.isFinite(velocity) ? velocity : 0;
        legacyInput.velocityX = Number.isFinite(feel.vx) ? feel.vx : 0;
        legacyInput.bounceAge = Number.isFinite(bounceAge) ? Math.max(0, bounceAge) : 1;
        legacyInput.landingAnticipation = landing;
        legacyInput.landingImpact = Number.isFinite(feel.landingImpact)
          ? Math.max(0, Math.min(1, feel.landingImpact))
          : Math.max(0, Math.min(1, (landing - 0.84) / 0.16));
        legacyInput.platformType = feel.platformType || '';
        legacyInput.platformVelocityX = Number.isFinite(feel.platformVelocityX) ? feel.platformVelocityX : 0;
        legacyInput.springActive = feel.springActive || false;
        legacyInput.springStrength = Number.isFinite(feel.springStrength) ? feel.springStrength : 1;
        legacyInput.hazardHit = feel.hazardHit || false;
        legacyInput.hazardDirection = feel.hazardDirection ?? 1;
        legacyInput.jetpackActive = !!feel.jetpackActive;
        legacyInput.jetpackStrength = Number.isFinite(feel.jetpackStrength) ? feel.jetpackStrength : 1;
        legacyInput.wrapEvent = feel.wrapEvent || null;
        legacyInput.dying = !!feel.dying;
        legacyInput.reducedMotion = !!feel.reducedMotion;
        legacyInput.landingQuality = feel.landingQuality || 'CLEAN';
        legacyInput.result = feel.resultType || feel.result || '';
        return animator.update(dt, time, legacyInput);
      },

      /**
       * Preferred animation-only API. The caller owns gameplay/physics and passes
       * read-only motion facts/events; this method only changes bones and visual.
       */
      updateAnimation(dt, time, input = {}) {
        return animator.update(dt, time, input);
      },

      resetAnimation() {
        animator.resetImmediate();
      },

      get animationState() {
        return animator.state;
      },

      getAnimationDiagnostics() {
        return animator.getDiagnostics();
      },

      consumeAnimationEvents() {
        return animator.consumeEvents();
      },

      peekAnimationEvents() {
        return animator.peekEvents();
      },
    };

    installTestHarness(controller, animator);
    return controller;
  } catch (error) {
    disposeCharacter({root});
    throw error;
  }
}

export function disposeCharacter(character) {
  if (!character?.root) return;
  if (testHarnessOwner === character) {
    testHarnessOwner = null;
    if (TEST_MODE) delete globalThis.__chimpCharacterAnimationTest;
  }

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();

  character.root.traverse(object => {
    if (object.skeleton) skeletons.add(object.skeleton);
    if (object.geometry) geometries.add(object.geometry);
    const source = object.material
      ? (Array.isArray(object.material) ? object.material : [object.material])
      : [];
    for (const material of source) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    texture.dispose();
    texture.source?.data?.close?.();
  }
  for (const skeleton of skeletons) skeleton.dispose();
}
