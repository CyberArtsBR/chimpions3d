const NAMES=Object.freeze(['low','medium','high','cinematic-max']);

const LOW=Object.freeze({
  profile:'low',
  label:'Low',
  dprCap:1,
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

const MEDIUM=Object.freeze({
  profile:'medium',
  label:'Medium',
  dprCap:1.15,
  postProcessing:false,
  renderTargetType:'unsigned-byte',
  msaaSamples:0,
  shadows:true,
  shadowMapSize:1024,
  shadowBias:-.0005,
  shadowNormalBias:.04,
  highScenery:false,
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

const HIGH=Object.freeze({
  profile:'high',
  label:'High',
  dprCap:1.75,
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

const CINEMATIC_MAX=Object.freeze({
  profile:'cinematic-max',
  label:'Cinematic Max',
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
  bloomEnabled:true,
  bloomStrength:.42,
  bloomRadius:.40,
  bloomThreshold:1.65,
  colorGrading:true,
  colorGradeIntensity:.58,
  sharpenEnabled:true,
  sharpenStrength:.18,
  atmosphereEnabled:true,
  atmosphereStrength:.10,
  atmosphereResolutionScale:.5,
  lightShafts:true,
  lightShaftStrength:.075,
  depthOfField:'cinematic-only',
  dofStrength:.34,
  contactShadow:true
});

export const JUMP_QUALITY_PROFILES=Object.freeze({
  low:LOW,
  medium:MEDIUM,
  high:HIGH,
  'cinematic-max':CINEMATIC_MAX
});

export const JUMP_QUALITY_NAMES=NAMES;

export function resolveJumpQualityProfile(value,fallback='cinematic-max'){
  const normalized=String(value??'').trim().toLowerCase();
  if(normalized==='max'||normalized==='cinematic'||normalized==='ultra')return 'cinematic-max';
  if(normalized==='balanced')return 'medium';
  if(NAMES.includes(normalized))return normalized;
  return NAMES.includes(fallback)?fallback:'cinematic-max';
}

export function getJumpQualityProfile(value='cinematic-max'){
  return JUMP_QUALITY_PROFILES[resolveJumpQualityProfile(value)];
}

export function nextJumpQualityProfile(value='cinematic-max'){
  const current=resolveJumpQualityProfile(value);
  return NAMES[(NAMES.indexOf(current)+1)%NAMES.length];
}
