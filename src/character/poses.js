export const ANIMATION_STATES = Object.freeze({
  IDLE: 'IDLE',
  TAKEOFF: 'TAKEOFF',
  ASCEND: 'ASCEND',
  APEX: 'APEX',
  DESCEND: 'DESCEND',
  LAND: 'LAND',
  SPRING: 'SPRING',
  HAZARD: 'HAZARD',
  JETPACK: 'JETPACK',
  DYING: 'DYING',
  RESULT: 'RESULT',
});

export const LANDING_PROFILES = Object.freeze({
  PERFECT: Object.freeze({compression:0.44, correction:0.08, recovery:0.20}),
  CLEAN: Object.freeze({compression:0.62, correction:0.16, recovery:0.30}),
  EDGE: Object.freeze({compression:0.78, correction:0.54, recovery:0.42}),
  HARD: Object.freeze({compression:1.00, correction:0.30, recovery:0.60}),
});

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smooth01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function landingProfile(name) {
  return LANDING_PROFILES[String(name || 'CLEAN').toUpperCase()] || LANDING_PROFILES.CLEAN;
}
