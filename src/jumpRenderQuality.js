const NAMES=Object.freeze(['balanced','high','ultra']);

const BALANCED=Object.freeze({
  profile:'balanced',
  label:'Balanced',
  dprFloor:1.00,
  dprCap:1.10,
  postProcessing:false,
  renderTargetType:'unsigned-byte',
  msaaSamples:0,
  shadows:false,
  shadowMapSize:0,
  shadowBias:-.0005,
  shadowNormalBias:.04,
  highScenery:false,
  maxAnisotropy:2,
  ambientOcclusion:false,
  aoResolutionScale:.5,
  bloomEnabled:false,
  colorGrading:false,
  sharpenEnabled:false,
  atmosphereEnabled:false,
  lightShafts:false,
  depthOfField:'off',
  contactShadow:false
});

const HIGH=Object.freeze({
  profile:'high',
  label:'High',
  dprFloor:1.00,
  dprCap:1.50,
  postProcessing:false,
  renderTargetType:'unsigned-byte',
  msaaSamples:0,
  shadows:true,
  shadowMapSize:1024,
  shadowBias:-.0005,
  shadowNormalBias:.04,
  highScenery:true,
  maxAnisotropy:4,
  ambientOcclusion:false,
  aoResolutionScale:.5,
  bloomEnabled:false,
  colorGrading:false,
  sharpenEnabled:false,
  atmosphereEnabled:false,
  lightShafts:false,
  depthOfField:'off',
  contactShadow:false
});

const ULTRA=Object.freeze({
  profile:'ultra',
  label:'Ultra',
  dprFloor:1.60,
  dprCap:1.60,
  postProcessing:true,
  renderTargetType:'half-float',
  msaaSamples:0,
  postResolutionScale:1,
  shadows:true,
  shadowMapSize:2048,
  shadowBias:-.00042,
  shadowNormalBias:.032,
  highScenery:true,
  maxAnisotropy:8,
  ambientOcclusion:true,
  aoResolutionScale:.50,
  aoKernelRadius:6,
  aoMinDistance:.0025,
  aoMaxDistance:.085,
  bloomEnabled:false,
  bloomStrength:0,
  bloomRadius:0,
  bloomThreshold:1.65,
  colorGrading:true,
  colorGradeIntensity:.58,
  sharpenEnabled:true,
  sharpenStrength:.22,
  atmosphereEnabled:false,
  atmosphereStrength:0,
  atmosphereResolutionScale:.5,
  lightShafts:false,
  lightShaftStrength:0,
  depthOfField:'cinematic-only',
  dofStrength:.34,
  contactShadow:true
});

export const JUMP_QUALITY_PROFILES=Object.freeze({
  balanced:BALANCED,
  high:HIGH,
  ultra:ULTRA
});

export const JUMP_QUALITY_NAMES=NAMES;

// Compatibility aliases only affect visuals. Physics, collision, route generation,
// scoring, input and leaderboard behavior never read this module.
const LEGACY_ALIASES=Object.freeze({
  low:'balanced',
  medium:'balanced',
  max:'ultra',
  cinematic:'ultra',
  'cinematic-max':'ultra'
});

export function resolveJumpQualityProfile(value,fallback='high'){
  const normalized=String(value??'').trim().toLowerCase();
  const migrated=LEGACY_ALIASES[normalized]||normalized;
  if(NAMES.includes(migrated))return migrated;
  const fallbackName=LEGACY_ALIASES[String(fallback??'').trim().toLowerCase()]||String(fallback??'').trim().toLowerCase();
  return NAMES.includes(fallbackName)?fallbackName:'high';
}

export function getJumpQualityProfile(value='high'){
  return JUMP_QUALITY_PROFILES[resolveJumpQualityProfile(value)];
}

export function nextJumpQualityProfile(value='high'){
  const current=resolveJumpQualityProfile(value);
  return NAMES[(NAMES.indexOf(current)+1)%NAMES.length];
}
