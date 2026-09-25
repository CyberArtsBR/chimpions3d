import * as THREE from 'three';
import {BONE_KEYS, validateFiniteSkeleton} from './rigUtils.js';
import {ANIMATION_STATES, clamp, clamp01, damp, landingProfile, smooth01} from './poses.js';

const BONE_INDEX = Object.freeze(Object.fromEntries(BONE_KEYS.map((key, index) => [key, index])));
const EMPTY_INPUT = Object.freeze({});
const PI = Math.PI;

const ROTATION_LIMIT = Object.freeze({
  hips:0.60, spine:0.68, chest:0.72, neck:0.52, head:0.58,
  leftShoulder:0.85, rightShoulder:0.85,
  leftUpperArm:1.62, rightUpperArm:1.62,
  leftForearm:1.50, rightForearm:1.50,
  leftHand:0.72, rightHand:0.72,
  leftThigh:1.42, rightThigh:1.42,
  leftShin:1.62, rightShin:1.62,
  leftFoot:0.92, rightFoot:0.92,
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function eventStrength(value) {
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  return clamp01(Math.abs(finite(value)));
}

function eventDirection(value, fallback = 1) {
  if (value === 'left') return -1;
  if (value === 'right') return 1;
  const number = finite(value, fallback);
  return number < 0 ? -1 : number > 0 ? 1 : fallback;
}

function resultKind(value) {
  if (!value) return '';
  const kind = String(value).trim().toUpperCase().replace(/[ -]+/g, '_');
  if (kind === 'NEW_PERSONAL_BEST' || kind === 'PERSONAL_BEST' || kind === 'PB') return 'PERSONAL_BEST';
  if (kind === 'HIGH_BANANA' || kind === 'HIGH_BANANAS' || kind === 'BANANAS') return 'HIGH_BANANA';
  return 'RESULT';
}

export class CharacterAnimator {
  constructor({visual, model, rigEntries, bones, launchVelocity = 12}) {
    this.visual = visual;
    this.model = model;
    this.rigEntries = rigEntries;
    this.bones = bones;
    this.launchVelocity = Math.max(1, finite(launchVelocity, 12));

    this.pose = new Float32Array(BONE_KEYS.length * 3);
    this.targetQuaternion = new THREE.Quaternion();
    this.deltaQuaternion = new THREE.Quaternion();

    this.state = ANIMATION_STATES.IDLE;
    this.stateAge = 0;
    this.bodyOffset = 0;
    this.scaleXZ = 1;
    this.scaleY = 1;
    this.visualLeanZ = 0;
    this.visualPitchX = 0;
    this.secondaryLag = 0;
    this.previousVelocityY = 0;
    this.velocityInitialized = false;

    this.hazardAge = 999;
    this.hazardDirection = 1;
    this.hazardStrength = 0;
    this.hazardSignal = 0;

    this.wrapAge = 999;
    this.wrapDirection = 1;
    this.wrapSignal = 0;

    this.springAge = 999;
    this.springStrength = 0;
    this.springSignal = 0;

    this.landingAge = 999;
    this.landingImpact = 0;
    this.landingQuality = 'CLEAN';
    this.landingDirection = 1;
    this.landingPlatformType = '';
    this.landingSignal = 0;

    this.jetpackBlend = 0;
    this.jetpackStrength = 0;
    this.dyingAge = 0;
    this.resultAge = 0;
    this.result = '';

    this.targetOffset = 0;
    this.targetScaleXZ = 1;
    this.targetScaleY = 1;
    this.targetLeanZ = 0;
    this.targetPitchX = 0;

    this.resetImmediate();
  }

  _slot(key) {
    return BONE_INDEX[key] * 3;
  }

  _set(key, x = 0, y = 0, z = 0) {
    const index = this._slot(key);
    this.pose[index] = x;
    this.pose[index + 1] = y;
    this.pose[index + 2] = z;
  }

  _add(key, x = 0, y = 0, z = 0) {
    const index = this._slot(key);
    this.pose[index] += x;
    this.pose[index + 1] += y;
    this.pose[index + 2] += z;
  }

  _changeState(next) {
    if (next === this.state) return;
    this.state = next;
    this.stateAge = 0;
  }

  _captureEvents(dt, input, velocityX) {
    const hazard = eventStrength(input.hazardHit);
    if (hazard > 0.001 && this.hazardSignal <= 0.001) {
      this.hazardAge = 0;
      this.hazardStrength = hazard;
      this.hazardDirection = eventDirection(input.hazardDirection, velocityX < 0 ? -1 : 1);
    }
    this.hazardSignal = hazard;
    this.hazardAge += dt;

    const wrap = input.wrapEvent ? 1 : 0;
    if (wrap && !this.wrapSignal) {
      this.wrapAge = 0;
      this.wrapDirection = eventDirection(input.wrapEvent, velocityX < 0 ? -1 : 1);
    }
    this.wrapSignal = wrap;
    this.wrapAge += dt;

    const spring = eventStrength(input.springActive);
    if (spring > 0.001 && this.springSignal <= 0.001) {
      this.springAge = 0;
      this.springStrength = Math.max(spring, clamp01(finite(input.jetpackStrength, 0)));
    }
    this.springSignal = spring;
    this.springAge += dt;

    const landing = eventStrength(input.landingImpact);
    if (landing > 0.001 && this.landingSignal <= 0.001) {
      this.landingAge = 0;
      this.landingImpact = landing;
      this.landingQuality = String(input.landingQuality || 'CLEAN').toUpperCase();
      this.landingDirection = velocityX < -0.08 ? -1 : velocityX > 0.08 ? 1 : this.landingDirection;
      this.landingPlatformType = String(input.platformType || '').toLowerCase();
    }
    this.landingSignal = landing;
    this.landingAge += dt;
  }

  _selectState(input, velocityY, landingAnticipation, platformType) {
    if (input.dying) return ANIMATION_STATES.DYING;
    if (this.result) return ANIMATION_STATES.RESULT;
    if (this.hazardAge < 0.52) return ANIMATION_STATES.HAZARD;
    if (this.jetpackBlend > 0.08) return ANIMATION_STATES.JETPACK;
    if (this.springAge < 0.44 || (platformType === 'spring' && landingAnticipation > 0.34)) {
      return ANIMATION_STATES.SPRING;
    }
    const profile = landingProfile(this.landingQuality);
    if (this.landingAge < profile.recovery + 0.18) return ANIMATION_STATES.LAND;
    if (input.active === false) return ANIMATION_STATES.IDLE;

    const bounceAge = Math.max(0, finite(input.bounceAge, 1));
    if (bounceAge < 0.16 && velocityY > 0.3) return ANIMATION_STATES.TAKEOFF;
    if (velocityY > 1.15) return ANIMATION_STATES.ASCEND;
    if (Math.abs(velocityY) <= 1.15) return ANIMATION_STATES.APEX;
    if (velocityY < -0.3) return ANIMATION_STATES.DESCEND;
    return ANIMATION_STATES.IDLE;
  }

  update(dt, time, input = EMPTY_INPUT) {
    dt = clamp(finite(dt, 0), 0, 0.05);
    time = finite(time, 0);
    if (dt <= 0) return this.state;

    const velocityY = finite(input.velocityY, 0);
    const velocityX = finite(input.velocityX, 0);
    const landingAnticipation = clamp01(finite(input.landingAnticipation, 0));
    const platformType = String(input.platformType || '').toLowerCase();
    const reducedMotion = !!input.reducedMotion;
    const reduction = reducedMotion ? 0.42 : 1;

    this._captureEvents(dt, input, velocityX);

    const jetTarget = input.jetpackActive ? clamp01(finite(input.jetpackStrength, 1)) : 0;
    this.jetpackBlend = damp(this.jetpackBlend, jetTarget, input.jetpackActive ? 12 : 7, dt);
    this.jetpackStrength = damp(this.jetpackStrength, jetTarget, 9, dt);

    const nextResult = resultKind(input.result);
    if (nextResult !== this.result) {
      this.result = nextResult;
      this.resultAge = 0;
    } else if (this.result) {
      this.resultAge += dt;
    }

    if (input.dying) this.dyingAge += dt;
    else this.dyingAge = 0;

    const nextState = this._selectState(input, velocityY, landingAnticipation, platformType);
    this._changeState(nextState);
    this.stateAge += dt;

    this.pose.fill(0);
    this.targetOffset = 0;
    this.targetScaleXZ = 1;
    this.targetScaleY = 1;
    this.targetLeanZ = 0;
    this.targetPitchX = 0;

    switch (this.state) {
      case ANIMATION_STATES.TAKEOFF:
        this._poseTakeoff(time, input.bounceAge, reduction);
        break;
      case ANIMATION_STATES.ASCEND:
        this._poseAscend(time, velocityY, reduction);
        break;
      case ANIMATION_STATES.APEX:
        this._poseApex(time, velocityY, reduction);
        break;
      case ANIMATION_STATES.DESCEND:
        this._poseDescend(time, velocityY, landingAnticipation, reduction);
        break;
      case ANIMATION_STATES.LAND:
        this._poseLanding(time, reduction);
        break;
      case ANIMATION_STATES.SPRING:
        this._poseSpring(time, landingAnticipation, platformType, reduction);
        break;
      case ANIMATION_STATES.HAZARD:
        this._poseHazard(time, reduction);
        break;
      case ANIMATION_STATES.JETPACK:
        this._poseJetpack(time, reduction);
        break;
      case ANIMATION_STATES.DYING:
        this._poseDying(time, reduction);
        break;
      case ANIMATION_STATES.RESULT:
        this._poseResult(time, reduction);
        break;
      default:
        this._poseIdle(time, reduction);
        break;
    }

    this._applyPlatformReaction(time, platformType || this.landingPlatformType, landingAnticipation, velocityX, reduction);
    this._applyHorizontalBalance(velocityX, reduction);
    this._applyWrapReaction(reduction);
    this._applySecondaryMotion(velocityY, reducedMotion, dt);
    this._applyPose(dt, reducedMotion);

    return this.state;
  }

  _poseIdle(time, reduction) {
    const breath = Math.sin(time * 1.35);
    const weight = Math.sin(time * 0.47 + 0.8);
    const micro = Math.sin(time * 0.71 + 1.9);
    const subtle = reduction;

    this._set('hips', 0.016 * weight * subtle, 0.010 * micro * subtle, 0.012 * weight * subtle);
    this._set('spine', -0.012 + 0.008 * breath * subtle, -0.008 * weight * subtle, 0);
    this._set('chest', 0.010 * breath * subtle, 0.012 * weight * subtle, -0.008 * weight * subtle);
    this._set('neck', -0.008 + 0.005 * breath * subtle, 0.006 * micro * subtle, 0);
    this._set('head', 0.010 * micro * subtle, 0.016 * weight * subtle, -0.006 * weight * subtle);

    this._set('leftShoulder', 0.003 * breath * subtle, 0, -0.020 - 0.006 * weight * subtle);
    this._set('rightShoulder', -0.002 * breath * subtle, 0, 0.016 - 0.004 * weight * subtle);
    this._set('leftUpperArm', 0.012 * weight * subtle, 0, 0.008 * breath * subtle);
    this._set('rightUpperArm', -0.009 * weight * subtle, 0, -0.006 * breath * subtle);
    this._set('leftForearm', -0.13 - 0.014 * micro * subtle, 0, 0);
    this._set('rightForearm', -0.115 + 0.010 * micro * subtle, 0, 0);
    this._set('leftHand', 0.025 + 0.012 * breath * subtle, 0.008 * weight * subtle, 0);
    this._set('rightHand', 0.018 - 0.010 * breath * subtle, -0.006 * weight * subtle, 0);

    this._set('leftThigh', -0.020 - 0.015 * weight * subtle, 0, 0.008 * weight * subtle);
    this._set('rightThigh', -0.020 + 0.010 * weight * subtle, 0, -0.006 * weight * subtle);
    this._set('leftShin', 0.055 + 0.014 * weight * subtle, 0, 0);
    this._set('rightShin', 0.050 - 0.010 * weight * subtle, 0, 0);

    this.targetOffset = 0.004 * breath * subtle;
  }

  _poseTakeoff(time, bounceAge, reduction) {
    const p = clamp01(Math.max(0, finite(bounceAge, 0)) / 0.16);
    const compression = 1 - smooth01(p / 0.44);
    const push = Math.sin(PI * clamp01(p));
    const extension = smooth01((p - 0.25) / 0.75);
    const asym = Math.sin(time * 3.1) * 0.025 * reduction;

    this._set('hips', 0.19 * compression - 0.055 * extension, 0, 0);
    this._set('spine', 0.15 * compression - 0.090 * extension, 0, 0);
    this._set('chest', 0.075 * compression - 0.060 * extension, 0, 0);
    this._set('neck', -0.015 * extension, 0, 0);
    this._set('head', -0.035 * extension, 0, 0);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      this._set(side + 'Shoulder', -0.035 * extension, 0, sign * 0.028 * push);
      this._set(side + 'UpperArm', 0.22 * compression - 0.92 * extension + sign * asym, 0, sign * 0.035 * push);
      this._set(side + 'Forearm', -0.18 - 0.26 * extension, 0, 0);
      this._set(side + 'Hand', 0.030 + 0.055 * extension, 0, sign * 0.018 * extension);
      this._set(side + 'Thigh', -0.68 * compression - 0.10 * push + sign * asym, 0, 0);
      this._set(side + 'Shin', 1.12 * compression + 0.10 * push, 0, 0);
      this._set(side + 'Foot', -0.44 * compression + 0.10 * extension, 0, 0);
    }

    this.targetOffset = -0.145 * compression + 0.045 * extension;
    this.targetScaleXZ = 1 + 0.030 * compression - 0.010 * extension;
    this.targetScaleY = 1 - 0.050 * compression + 0.028 * extension;
  }

  _poseAscend(time, velocityY, reduction) {
    const rise = clamp01(velocityY / this.launchVelocity);
    const recover = 1 - rise;
    const delayed = Math.sin(time * 2.3 + 0.7) * 0.030 * reduction;

    this._set('hips', -0.045 * rise + 0.018 * recover, 0, 0);
    this._set('spine', -0.082 * rise + 0.018 * recover, 0, 0);
    this._set('chest', -0.050 * rise, 0, 0);
    this._set('neck', 0.014 * recover, 0, 0);
    this._set('head', -0.025 * rise + 0.015 * recover, 0, 0);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      this._set(side + 'Shoulder', -0.060 * rise, 0, sign * 0.045);
      this._set(side + 'UpperArm', -0.88 * rise - 0.48 * recover + sign * delayed, 0, sign * 0.050);
      this._set(side + 'Forearm', -0.34 + 0.12 * recover, 0, 0);
      this._set(side + 'Hand', 0.065 * rise, 0, sign * 0.022);
      this._set(side + 'Thigh', -0.12 - 0.12 * recover + sign * delayed, 0, 0);
      this._set(side + 'Shin', 0.16 + 0.26 * recover, 0, 0);
      this._set(side + 'Foot', 0.070 * rise - 0.080 * recover, 0, 0);
    }

    this.targetOffset = 0.035 * rise;
    this.targetScaleXZ = 0.992;
    this.targetScaleY = 1.018;
  }

  _poseApex(time, velocityY, reduction) {
    const hang = 1 - clamp01(Math.abs(velocityY) / 1.2);
    const delayed = Math.sin(time * 2.05 + 1.1) * 0.045 * reduction;
    const opposite = Math.sin(time * 1.55 + 2.4) * 0.028 * reduction;

    this._set('hips', 0.025 * hang, delayed * 0.18, 0);
    this._set('spine', 0.040 * hang, -delayed * 0.16, 0);
    this._set('chest', 0.028 * hang, delayed * 0.22, 0);
    this._set('neck', 0.020 * hang, -opposite * 0.18, 0);
    this._set('head', 0.036 * hang, opposite * 0.30, 0);

    this._set('leftShoulder', -0.035, 0, 0.082 * hang);
    this._set('rightShoulder', -0.028, 0, -0.068 * hang);
    this._set('leftUpperArm', -0.58 + delayed, 0, 0.075);
    this._set('rightUpperArm', -0.50 - delayed * 0.75, 0, -0.062);
    this._set('leftForearm', -0.30 - opposite, 0, 0);
    this._set('rightForearm', -0.25 + opposite * 0.70, 0, 0);
    this._set('leftHand', 0.055, 0.018 * delayed, 0);
    this._set('rightHand', 0.040, -0.014 * delayed, 0);

    this._set('leftThigh', -0.24 + delayed * 0.35, 0, 0.030);
    this._set('rightThigh', -0.19 - delayed * 0.28, 0, -0.025);
    this._set('leftShin', 0.48 - delayed * 0.30, 0, 0);
    this._set('rightShin', 0.40 + delayed * 0.24, 0, 0);
    this._set('leftFoot', -0.16, 0, 0);
    this._set('rightFoot', -0.12, 0, 0);

    this.targetOffset = -0.030 * hang;
  }

  _poseDescend(time, velocityY, landingAnticipation, reduction) {
    const fall = clamp01(-velocityY / this.launchVelocity);
    const prep = landingAnticipation;
    const asym = Math.sin(time * 2.4) * 0.030 * reduction;

    this._set('hips', 0.045 + 0.10 * prep, 0, 0);
    this._set('spine', 0.055 + 0.060 * prep, 0, 0);
    this._set('chest', 0.050 + 0.030 * prep, 0, 0);
    this._set('neck', -0.010 - 0.018 * prep, 0, 0);
    this._set('head', 0.020 + 0.020 * prep, 0, 0);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      this._set(side + 'Shoulder', -0.025, 0, sign * (0.055 + 0.050 * prep));
      this._set(side + 'UpperArm', -0.34 + 0.16 * prep + sign * asym, 0, sign * (0.050 + 0.050 * prep));
      this._set(side + 'Forearm', -0.20 - 0.12 * prep, 0, 0);
      this._set(side + 'Hand', 0.025, 0, sign * 0.018 * prep);
      this._set(side + 'Thigh', -0.16 - 0.32 * prep + sign * asym * 0.5, 0, sign * 0.018 * fall);
      this._set(side + 'Shin', 0.40 + 0.52 * prep, 0, 0);
      this._set(side + 'Foot', -0.12 - 0.24 * prep, 0, 0);
    }

    this.targetOffset = -0.028 * fall - 0.050 * prep;
  }

  _poseLanding(time, reduction) {
    const profile = landingProfile(this.landingQuality);
    const impact = clamp01(this.landingImpact);
    const recovery = Math.max(0.18, profile.recovery);
    const compression = profile.compression * (0.45 + 0.55 * impact) *
      Math.exp(-this.landingAge / (0.11 + profile.recovery * 0.16));
    const recoverPhase = smooth01(this.landingAge / recovery);
    const correction = profile.correction * Math.sin(PI * clamp01(this.landingAge / recovery)) *
      this.landingDirection * reduction;
    const hardDelay = this.landingQuality === 'HARD' ? 1 - smooth01((this.landingAge - 0.10) / 0.28) : 0;

    this._set('hips', 0.22 * compression + 0.055 * hardDelay, 0, correction * 0.20);
    this._set('spine', 0.18 * compression + 0.040 * hardDelay, 0, correction * 0.28);
    this._set('chest', 0.11 * compression, 0, -correction * 0.20);
    this._set('neck', -0.030 * compression, 0, -correction * 0.12);
    this._set('head', -0.045 * compression, 0, -correction * 0.22);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      const edge = correction * sign;
      this._set(side + 'Shoulder', 0.035 * compression, 0, sign * 0.045 * compression + edge * 0.08);
      this._set(side + 'UpperArm', 0.18 * compression + edge * 0.46, 0, sign * 0.050 * compression);
      this._set(side + 'Forearm', -0.18 - 0.28 * compression - Math.abs(edge) * 0.20, 0, 0);
      this._set(side + 'Hand', 0.020 + 0.040 * compression, 0, edge * 0.08);
      this._set(side + 'Thigh', -0.62 * compression - 0.08 * hardDelay, 0, edge * 0.05);
      this._set(side + 'Shin', 1.02 * compression + 0.12 * hardDelay, 0, 0);
      this._set(side + 'Foot', -0.36 * compression + 0.08 * recoverPhase, 0, 0);
    }

    this.targetOffset = -0.155 * compression - 0.035 * hardDelay;
    this.targetScaleXZ = 1 + 0.035 * compression;
    this.targetScaleY = 1 - 0.060 * compression;
  }

  _poseSpring(time, landingAnticipation, platformType, reduction) {
    const pre = platformType === 'spring' ? landingAnticipation : 0;
    const releasing = this.springAge < 0.44;
    const release = releasing ? 1 - smooth01(this.springAge / 0.13) : 0;
    const reaction = releasing ? Math.sin(PI * clamp01((this.springAge - 0.035) / 0.34)) : 0;
    const compression = releasing ? 0 : pre;
    const strength = Math.max(0.65, this.springStrength || 0.65);

    this._set('hips', 0.25 * compression - 0.085 * release, 0, 0);
    this._set('spine', 0.19 * compression - 0.12 * release + 0.04 * reaction, 0, 0);
    this._set('chest', 0.12 * compression - 0.08 * release + 0.06 * reaction, 0, 0);
    this._set('neck', -0.03 * release, 0, 0);
    this._set('head', -0.055 * release + 0.025 * reaction * reduction, 0, 0);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      const stagger = sign * Math.sin(time * 3.3) * 0.025 * reduction;
      this._set(side + 'Shoulder', -0.08 * release, 0, sign * 0.09 * reaction);
      this._set(side + 'UpperArm', 0.22 * compression - 1.08 * release + 0.34 * reaction + stagger, 0, sign * 0.11 * reaction);
      this._set(side + 'Forearm', -0.24 - 0.28 * release - 0.12 * reaction, 0, 0);
      this._set(side + 'Hand', 0.065 * release, 0, sign * 0.035 * reaction);
      this._set(side + 'Thigh', -0.78 * compression - 0.08 * release, 0, 0);
      this._set(side + 'Shin', 1.28 * compression + 0.06 * reaction, 0, 0);
      this._set(side + 'Foot', -0.48 * compression + 0.12 * release, 0, 0);
    }

    this.targetOffset = -0.19 * compression + 0.060 * release * strength;
    this.targetScaleXZ = 1 + 0.045 * compression - 0.018 * release;
    this.targetScaleY = 1 - 0.075 * compression + 0.038 * release;
  }

  _poseHazard(time, reduction) {
    const decay = 1 - smooth01(this.hazardAge / 0.52);
    const recoil = decay * this.hazardStrength * this.hazardDirection;
    const follow = Math.sin(PI * clamp01(this.hazardAge / 0.52)) * this.hazardStrength * reduction;

    this._set('hips', 0.055 * follow, 0, -0.26 * recoil);
    this._set('spine', 0.090 * follow, 0, -0.36 * recoil);
    this._set('chest', -0.045 * follow, 0, -0.42 * recoil);
    this._set('neck', 0.035 * follow, 0, 0.16 * recoil);
    this._set('head', 0.055 * follow, 0, 0.24 * recoil);

    this._set('leftUpperArm', -0.42 - 0.34 * recoil, 0, 0.18 * recoil);
    this._set('rightUpperArm', -0.42 + 0.34 * recoil, 0, 0.18 * recoil);
    this._set('leftForearm', -0.34 - 0.18 * follow, 0, 0);
    this._set('rightForearm', -0.34 - 0.18 * follow, 0, 0);
    this._set('leftThigh', -0.16 + 0.15 * recoil, 0, 0);
    this._set('rightThigh', -0.16 - 0.15 * recoil, 0, 0);
    this._set('leftShin', 0.44 + 0.18 * follow, 0, 0);
    this._set('rightShin', 0.44 + 0.12 * follow, 0, 0);

    this.targetLeanZ = -0.10 * recoil;
    this.targetOffset = -0.025 * follow;
  }

  _poseJetpack(time, reduction) {
    const boost = this.jetpackBlend * Math.max(0.35, this.jetpackStrength);
    const stabilization = Math.sin(time * 2.4) * 0.025 * boost * reduction;

    this._set('hips', -0.055 * boost, 0, stabilization * 0.30);
    this._set('spine', -0.105 * boost, 0, -stabilization * 0.45);
    this._set('chest', -0.080 * boost, 0, stabilization * 0.35);
    this._set('neck', -0.028 * boost, 0, 0);
    this._set('head', -0.085 * boost, 0, -stabilization * 0.25);

    for (const side of ['left','right']) {
      const sign = side === 'left' ? 1 : -1;
      this._set(side + 'Shoulder', -0.035 * boost, 0, sign * 0.055 * boost);
      this._set(side + 'UpperArm', -0.26 * boost + sign * stabilization, 0, sign * 0.11 * boost);
      this._set(side + 'Forearm', -0.24 - 0.12 * boost, 0, 0);
      this._set(side + 'Hand', 0.025, 0, sign * 0.025 * boost);
      this._set(side + 'Thigh', 0.14 * boost + sign * stabilization * 0.5, 0, 0);
      this._set(side + 'Shin', 0.24 + 0.18 * boost, 0, 0);
      this._set(side + 'Foot', 0.12 * boost, 0, 0);
    }

    this.targetPitchX = -0.035 * boost;
    this.targetOffset = 0.018 * boost;
  }

  _poseDying(time, reduction) {
    const loss = smooth01(this.dyingAge / 0.24);
    const instability = smooth01(this.dyingAge / 1.15);
    const sway = Math.sin(this.dyingAge * 5.2 + 0.4) * instability * reduction;
    const counter = Math.sin(this.dyingAge * 6.7 + 1.8) * instability * reduction;

    this._set('hips', 0.10 * loss + 0.10 * counter, 0.12 * sway, 0.24 * sway);
    this._set('spine', 0.14 * loss - 0.16 * counter, -0.10 * sway, 0.34 * sway);
    this._set('chest', -0.08 * loss + 0.18 * counter, 0.08 * sway, 0.38 * sway);
    this._set('neck', 0.08 * counter, 0, -0.18 * sway);
    this._set('head', 0.12 * counter, -0.08 * sway, -0.26 * sway);

    this._set('leftUpperArm', -0.80 + 0.42 * sway, 0, 0.20 * counter);
    this._set('rightUpperArm', -0.68 - 0.38 * sway, 0, -0.22 * counter);
    this._set('leftForearm', -0.48 - 0.22 * counter, 0, 0);
    this._set('rightForearm', -0.42 + 0.20 * counter, 0, 0);
    this._set('leftHand', 0.12 * counter, 0, 0.08 * sway);
    this._set('rightHand', -0.10 * counter, 0, -0.08 * sway);

    this._set('leftThigh', -0.20 + 0.34 * counter, 0, 0.08 * sway);
    this._set('rightThigh', -0.22 - 0.28 * counter, 0, -0.08 * sway);
    this._set('leftShin', 0.54 - 0.20 * sway, 0, 0);
    this._set('rightShin', 0.48 + 0.24 * sway, 0, 0);
    this._set('leftFoot', -0.10 + 0.10 * counter, 0, 0);
    this._set('rightFoot', -0.08 - 0.10 * counter, 0, 0);

    this.targetLeanZ = 0.16 * sway;
    this.targetPitchX = 0.06 * counter;
  }

  _poseResult(time, reduction) {
    const age = this.resultAge;
    const settle = smooth01(age / 0.30);
    const pulse = Math.sin(Math.min(age, 2.2) * PI * 1.35) * Math.exp(-age * 0.8) * reduction;

    if (this.result === 'PERSONAL_BEST') {
      this._set('spine', -0.075 * settle, 0, 0);
      this._set('chest', -0.10 * settle, 0, 0);
      this._set('head', -0.035 * settle, 0.04 * pulse, 0);
      this._set('leftUpperArm', -1.18 * settle, 0, 0.14);
      this._set('rightUpperArm', -1.10 * settle, 0, -0.14);
      this._set('leftForearm', -0.44, 0, 0);
      this._set('rightForearm', -0.40, 0, 0);
      this.targetOffset = 0.025 * settle;
      return;
    }

    if (this.result === 'HIGH_BANANA') {
      this._set('chest', -0.045 * settle, 0.06 * pulse, 0);
      this._set('head', -0.020 * settle, -0.08 * pulse, 0);
      this._set('leftUpperArm', -0.74 * settle + 0.12 * pulse, 0, 0.10);
      this._set('rightUpperArm', -0.34 * settle - 0.10 * pulse, 0, -0.08);
      this._set('leftForearm', -0.52, 0, 0);
      this._set('rightForearm', -0.28, 0, 0);
      return;
    }

    this._set('hips', 0.018 * pulse, 0, 0);
    this._set('spine', -0.025 * settle, 0, 0);
    this._set('chest', -0.035 * settle, 0, 0);
    this._set('head', -0.015 * settle, 0.025 * pulse, 0);
    this._set('leftUpperArm', -0.22 * settle, 0, 0.04);
    this._set('rightUpperArm', -0.16 * settle, 0, -0.03);
    this._set('leftForearm', -0.25, 0, 0);
    this._set('rightForearm', -0.20, 0, 0);
  }

  _applyHorizontalBalance(velocityX, reduction) {
    const lean = clamp(velocityX / 8, -1, 1) * reduction;
    this._add('hips', 0, 0.020 * lean, -0.060 * lean);
    this._add('spine', 0, -0.018 * lean, -0.095 * lean);
    this._add('chest', 0, 0.030 * lean, 0.044 * lean);
    this._add('neck', 0, -0.016 * lean, 0.025 * lean);
    this._add('head', 0, -0.022 * lean, 0.040 * lean);

    this._add('leftShoulder', 0, 0, 0.035 * lean);
    this._add('rightShoulder', 0, 0, 0.035 * lean);
    this._add('leftUpperArm', -0.10 * lean, 0, 0.04 * lean);
    this._add('rightUpperArm', 0.10 * lean, 0, 0.04 * lean);

    this.targetLeanZ += -0.075 * lean;
  }

  _applyPlatformReaction(time, platformType, contact, velocityX, reduction) {
    const blend = clamp01(contact + (this.state === ANIMATION_STATES.LAND ? 0.35 : 0));
    if (blend <= 0.001) return;

    if (platformType === 'leaf') {
      const sway = Math.sin(time * 2.1) * 0.055 * blend * reduction;
      this._add('spine', 0, 0, sway);
      this._add('chest', 0, 0, -sway * 0.7);
      this._add('leftUpperArm', -0.12 * blend, 0, 0.08 * blend);
      this._add('rightUpperArm', -0.12 * blend, 0, -0.08 * blend);
    } else if (platformType === 'swing') {
      const stabilize = (Math.sin(time * 2.8) * 0.08 + clamp(velocityX / 8, -1, 1) * 0.06) * blend * reduction;
      this._add('hips', 0, 0, -stabilize);
      this._add('spine', 0, 0, -stabilize * 1.25);
      this._add('chest', 0, 0, stabilize * 0.75);
      this._add('leftUpperArm', -stabilize * 1.5, 0, 0);
      this._add('rightUpperArm', stabilize * 1.5, 0, 0);
    } else if (platformType === 'moving') {
      const motion = clamp(velocityX / 8, -1, 1) * 0.075 * blend * reduction;
      this._add('hips', 0, 0, -motion);
      this._add('spine', 0, 0, -motion);
      this._add('chest', 0, 0, motion * 0.55);
    }
  }

  _applyWrapReaction(reduction) {
    if (this.wrapAge >= 0.34) return;
    const pulse = Math.sin(PI * clamp01(this.wrapAge / 0.34)) * this.wrapDirection * reduction;
    this._add('hips', 0, 0.07 * pulse, -0.035 * pulse);
    this._add('chest', 0, -0.09 * pulse, 0.028 * pulse);
    this._add('head', 0, 0.05 * pulse, 0);
    this._add('leftUpperArm', -0.045 * pulse, 0, 0);
    this._add('rightUpperArm', 0.045 * pulse, 0, 0);
  }

  _applySecondaryMotion(velocityY, reducedMotion, dt) {
    if (!this.velocityInitialized) {
      this.previousVelocityY = velocityY;
      this.velocityInitialized = true;
    }
    const impulse = clamp((velocityY - this.previousVelocityY) * 0.034, -0.14, 0.14);
    this.secondaryLag = damp(this.secondaryLag, impulse, 7.5, dt);
    this.previousVelocityY = velocityY;

    const scale = reducedMotion ? 0.20 : 1;
    const lag = this.secondaryLag * scale;
    this._add('chest', -0.30 * lag, 0, 0);
    this._add('neck', -0.36 * lag, 0, 0);
    this._add('head', -0.48 * lag, 0, 0);
    this._add('leftUpperArm', 0.52 * lag, 0, 0);
    this._add('rightUpperArm', 0.52 * lag, 0, 0);
    this._add('leftHand', 0.24 * lag, 0, 0);
    this._add('rightHand', 0.24 * lag, 0, 0);
    this._add('hips', 0.12 * lag, 0, 0);
  }

  _applyPose(dt, reducedMotion) {
    const response = reducedMotion ? 15 : (
      this.state === ANIMATION_STATES.TAKEOFF ||
      this.state === ANIMATION_STATES.LAND ||
      this.state === ANIMATION_STATES.SPRING ||
      this.state === ANIMATION_STATES.HAZARD ? 22 : 14
    );
    const alpha = 1 - Math.exp(-response * dt);

    for (const entry of this.rigEntries) {
      const index = this._slot(entry.key);
      const limit = ROTATION_LIMIT[entry.key] || 1.2;
      let x = clamp(finite(this.pose[index]), -limit, limit);
      let y = clamp(finite(this.pose[index + 1]), -limit, limit);
      let z = clamp(finite(this.pose[index + 2]), -limit, limit);

      this.targetQuaternion.copy(entry.base);
      if (x) this.targetQuaternion.multiply(this.deltaQuaternion.setFromAxisAngle(entry.axes[0], x));
      if (y) this.targetQuaternion.multiply(this.deltaQuaternion.setFromAxisAngle(entry.axes[1], y));
      if (z) this.targetQuaternion.multiply(this.deltaQuaternion.setFromAxisAngle(entry.axes[2], z));
      this.targetQuaternion.normalize();
      entry.bone.quaternion.slerp(this.targetQuaternion, alpha).normalize();
    }

    this.bodyOffset = damp(this.bodyOffset, this.targetOffset, response, dt);
    this.scaleXZ = damp(this.scaleXZ, this.targetScaleXZ, response, dt);
    this.scaleY = damp(this.scaleY, this.targetScaleY, response, dt);
    this.visualLeanZ = damp(this.visualLeanZ, this.targetLeanZ, reducedMotion ? 12 : 9, dt);
    this.visualPitchX = damp(this.visualPitchX, this.targetPitchX, reducedMotion ? 12 : 9, dt);

    this.visual.position.x = 0;
    this.visual.position.y = finite(this.bodyOffset);
    this.visual.position.z = 0;
    this.visual.scale.set(
      clamp(finite(this.scaleXZ, 1), 0.82, 1.18),
      clamp(finite(this.scaleY, 1), 0.82, 1.18),
      clamp(finite(this.scaleXZ, 1), 0.82, 1.18),
    );
    this.visual.rotation.x = clamp(finite(this.visualPitchX), -0.12, 0.12);
    this.visual.rotation.z = clamp(finite(this.visualLeanZ), -0.20, 0.20);
  }

  resetImmediate() {
    this.pose.fill(0);
    for (const entry of this.rigEntries) entry.bone.quaternion.copy(entry.base).normalize();

    this.state = ANIMATION_STATES.IDLE;
    this.stateAge = 0;
    this.bodyOffset = 0;
    this.scaleXZ = 1;
    this.scaleY = 1;
    this.visualLeanZ = 0;
    this.visualPitchX = 0;
    this.secondaryLag = 0;
    this.previousVelocityY = 0;
    this.velocityInitialized = false;

    this.hazardAge = 999;
    this.hazardStrength = 0;
    this.hazardSignal = 0;
    this.wrapAge = 999;
    this.wrapSignal = 0;
    this.springAge = 999;
    this.springStrength = 0;
    this.springSignal = 0;
    this.landingAge = 999;
    this.landingImpact = 0;
    this.landingSignal = 0;
    this.jetpackBlend = 0;
    this.jetpackStrength = 0;
    this.dyingAge = 0;
    this.resultAge = 0;
    this.result = '';

    this.targetOffset = 0;
    this.targetScaleXZ = 1;
    this.targetScaleY = 1;
    this.targetLeanZ = 0;
    this.targetPitchX = 0;

    this.visual.position.set(0,0,0);
    this.visual.scale.set(1,1,1);
    this.visual.rotation.x = 0;
    this.visual.rotation.z = 0;
  }

  getDiagnostics() {
    const skeleton = validateFiniteSkeleton(this.bones);
    const visualValues = [
      this.visual.position.x,this.visual.position.y,this.visual.position.z,
      this.visual.rotation.x,this.visual.rotation.y,this.visual.rotation.z,
      this.visual.scale.x,this.visual.scale.y,this.visual.scale.z,
    ];
    const visualFinite = visualValues.every(Number.isFinite);
    return {
      state:this.state,
      skeleton,
      visualFinite,
      visible:this.model.visible,
      visualScale:[this.visual.scale.x,this.visual.scale.y,this.visual.scale.z],
    };
  }

  debugExercise() {
    const dt = 1 / 60;
    let time = 0;
    let maxQuaternionNormError = 0;
    let maxVisualScaleDeviation = 0;
    let maxBoneScaleDelta = 0;
    const failures = [];
    const states = [];

    const baseScales = this.bones.map(bone => bone.scale.clone());

    const check = label => {
      const diagnostics = this.getDiagnostics();
      if (!diagnostics.skeleton.ok) failures.push(label + ': ' + diagnostics.skeleton.reason + ' (' + diagnostics.skeleton.bone + ')');
      if (!diagnostics.visualFinite) failures.push(label + ': non-finite visual transform');
      if (!diagnostics.visible) failures.push(label + ': model became invisible');
      maxQuaternionNormError = Math.max(maxQuaternionNormError, diagnostics.skeleton.maxQuaternionNormError || 0);
      maxVisualScaleDeviation = Math.max(
        maxVisualScaleDeviation,
        Math.abs(this.visual.scale.x - 1),
        Math.abs(this.visual.scale.y - 1),
        Math.abs(this.visual.scale.z - 1),
      );
      for (let index = 0; index < this.bones.length; index++) {
        maxBoneScaleDelta = Math.max(maxBoneScaleDelta, this.bones[index].scale.distanceTo(baseScales[index]));
      }
    };

    const run = (label, expected, frames, configure) => {
      const seen = new Set();
      for (let frame = 0; frame < frames; frame++) {
        const input = {
          active:true, velocityY:0, velocityX:0, bounceAge:1,
          landingAnticipation:0, landingImpact:0, platformType:'',
          springActive:false, hazardHit:false, hazardDirection:1,
          jetpackActive:false, jetpackStrength:1, wrapEvent:null,
          dying:false, reducedMotion:false, landingQuality:'CLEAN', result:'',
        };
        configure(input, frame, frames);
        this.update(dt, time, input);
        time += dt;
        seen.add(this.state);
        check(label);
      }
      const observed = [...seen];
      states.push({label, expected, observed});
      if (!seen.has(expected)) failures.push(label + ': expected state ' + expected + ', observed ' + observed.join(','));
    };

    this.resetImmediate();
    run('IDLE', ANIMATION_STATES.IDLE, 45, input => { input.active = false; });
    run('TAKEOFF', ANIMATION_STATES.TAKEOFF, 9, (input, frame) => {
      input.velocityY = 12 - frame * 0.15;
      input.bounceAge = frame * dt;
    });
    run('ASCEND', ANIMATION_STATES.ASCEND, 24, (input, frame, frames) => {
      input.velocityY = 9 - frame / frames * 5;
      input.bounceAge = 0.28 + frame * dt;
    });
    run('APEX', ANIMATION_STATES.APEX, 24, (input, frame, frames) => {
      input.velocityY = 0.9 - frame / frames * 1.8;
      input.bounceAge = 0.65;
    });
    run('DESCEND', ANIMATION_STATES.DESCEND, 24, (input, frame, frames) => {
      input.velocityY = -3 - frame / frames * 6;
      input.bounceAge = 0.9;
      input.landingAnticipation = frame / frames * 0.75;
    });
    run('LAND', ANIMATION_STATES.LAND, 30, (input, frame) => {
      input.active = false;
      input.velocityY = 0;
      input.landingImpact = frame === 0 ? 0.72 : 0;
      input.landingQuality = 'CLEAN';
      input.platformType = 'leaf';
    });
    run('HARD LAND', ANIMATION_STATES.LAND, 42, (input, frame) => {
      input.active = false;
      input.landingImpact = frame === 0 ? 1 : 0;
      input.landingQuality = 'HARD';
      input.platformType = 'moving';
    });
    run('SPRING', ANIMATION_STATES.SPRING, 36, (input, frame) => {
      input.velocityY = frame < 10 ? -2 : 16;
      input.bounceAge = frame < 10 ? 1 : (frame - 10) * dt;
      input.platformType = 'spring';
      input.landingAnticipation = frame < 10 ? 0.92 : 0;
      input.springActive = frame === 10;
    });
    run('HAZARD', ANIMATION_STATES.HAZARD, 28, (input, frame) => {
      input.velocityY = -4;
      input.bounceAge = 0.8;
      input.hazardHit = frame === 0;
      input.hazardDirection = -1;
    });
    run('JETPACK', ANIMATION_STATES.JETPACK, 42, input => {
      input.velocityY = 18;
      input.bounceAge = 0.4;
      input.jetpackActive = true;
      input.jetpackStrength = 0.9;
      input.velocityX = 3.4;
    });
    run('DYING', ANIMATION_STATES.DYING, 54, input => {
      input.velocityY = -10;
      input.dying = true;
      input.velocityX = -2.5;
    });

    this.resetImmediate();
    let maxResetAngularError = 0;
    for (const entry of this.rigEntries) {
      maxResetAngularError = Math.max(maxResetAngularError, entry.bone.quaternion.angleTo(entry.base));
    }
    check('RESET');

    if (maxQuaternionNormError > 1e-4) failures.push('quaternion normalization drift exceeds 1e-4');
    if (maxVisualScaleDeviation > 0.20) failures.push('visual squash/stretch exceeded safety envelope');
    if (maxBoneScaleDelta > 1e-7) failures.push('animation modified authored bone scale');
    if (maxResetAngularError > 1e-6) failures.push('pose did not reset to basis transforms');

    return {
      ok:failures.length === 0,
      states,
      failures,
      maxQuaternionNormError,
      maxVisualScaleDeviation,
      maxBoneScaleDelta,
      maxResetAngularError,
      boneCount:this.bones.length,
    };
  }
}
