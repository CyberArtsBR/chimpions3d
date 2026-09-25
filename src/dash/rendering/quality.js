export const DASH_QUALITY_PRESETS={
  LOW:{name:'LOW',pixelRatio:1,shadowMap:512,shadows:false,farCount:18,midCount:12,detailCount:18,foregroundCount:0,particleCount:36,streakCount:4,lightShafts:0},
  BALANCED:{name:'BALANCED',pixelRatio:1.25,shadowMap:1024,shadows:true,farCount:28,midCount:20,detailCount:28,foregroundCount:8,particleCount:64,streakCount:8,lightShafts:1},
  HIGH:{name:'HIGH',pixelRatio:1.6,shadowMap:1024,shadows:true,farCount:40,midCount:30,detailCount:42,foregroundCount:16,particleCount:104,streakCount:12,lightShafts:3},
  ULTRA:{name:'ULTRA',pixelRatio:2,shadowMap:2048,shadows:true,farCount:56,midCount:42,detailCount:58,foregroundCount:24,particleCount:160,streakCount:18,lightShafts:5}
};

const valid=name=>Object.prototype.hasOwnProperty.call(DASH_QUALITY_PRESETS,String(name||'').toUpperCase());

export function resolveDashQuality(){
  let requested='';
  try{requested=new URLSearchParams(globalThis.location?.search||'').get('quality')||globalThis.localStorage?.getItem('chimpions-dash-quality')||'';}catch{}
  requested=String(requested).toUpperCase();
  if(valid(requested))return requested;
  const nav=globalThis.navigator||{},memory=Number(nav.deviceMemory||0),cores=Number(nav.hardwareConcurrency||0);
  const mobile=globalThis.matchMedia?.('(pointer:coarse)').matches||Math.min(globalThis.innerWidth||9999,globalThis.innerHeight||9999)<700;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||mobile&&((memory&&memory<=4)||(cores&&cores<=4)))return'LOW';
  if(mobile)return'BALANCED';
  if((memory&&memory>=12)&&(cores&&cores>=8))return'ULTRA';
  if((memory&&memory>=8)||(cores&&cores>=8))return'HIGH';
  return'BALANCED';
}

export function getDashQualityPreset(name){
  return DASH_QUALITY_PRESETS[valid(name)?String(name).toUpperCase():'BALANCED'];
}

export function storeDashQuality(name){
  const key=String(name||'').toUpperCase();
  if(!valid(key))throw new Error('Dash quality must be LOW, BALANCED, HIGH, or ULTRA.');
  try{globalThis.localStorage?.setItem('chimpions-dash-quality',key);}catch{}
  return key;
}
