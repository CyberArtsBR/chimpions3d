export const DASH_QUALITY_ORDER=Object.freeze(['LOW','BALANCED','HIGH','ULTRA']);

export const DASH_QUALITY_PRESETS=Object.freeze({
  LOW:Object.freeze({
    name:'LOW',dprMin:.65,dprMax:1,shadowMap:512,shadows:false,
    farCount:18,midCount:12,detailCount:18,foregroundCount:0,particleCount:36,streakCount:4,lightShafts:0,mistCount:0,
    idleFps:10,p95BudgetMs:28,avgBudgetMs:22
  }),
  BALANCED:Object.freeze({
    name:'BALANCED',dprMin:.7,dprMax:1.25,shadowMap:512,shadows:true,
    farCount:28,midCount:20,detailCount:28,foregroundCount:8,particleCount:64,streakCount:8,lightShafts:1,mistCount:1,
    idleFps:12,p95BudgetMs:24,avgBudgetMs:19
  }),
  HIGH:Object.freeze({
    name:'HIGH',dprMin:.8,dprMax:1.6,shadowMap:1024,shadows:true,
    farCount:40,midCount:30,detailCount:42,foregroundCount:16,particleCount:104,streakCount:12,lightShafts:3,mistCount:2,
    idleFps:15,p95BudgetMs:21,avgBudgetMs:18
  }),
  ULTRA:Object.freeze({
    name:'ULTRA',dprMin:1,dprMax:2,shadowMap:2048,shadows:true,
    farCount:56,midCount:42,detailCount:58,foregroundCount:24,particleCount:160,streakCount:18,lightShafts:5,mistCount:3,
    idleFps:18,p95BudgetMs:19,avgBudgetMs:17
  })
});

const validTier=name=>Object.prototype.hasOwnProperty.call(DASH_QUALITY_PRESETS,String(name||'').toUpperCase());

export function normalizeDashQualityRequest(name){
  const key=String(name||'').toUpperCase();
  return key==='AUTO'||validTier(key)?key:'AUTO';
}

export function readDashRequestedQuality(){
  let requested='';
  try{
    requested=new URLSearchParams(globalThis.location?.search||'').get('quality')||globalThis.localStorage?.getItem('chimpions-dash-quality')||'AUTO';
  }catch{}
  return normalizeDashQualityRequest(requested);
}

export function detectDashHardwareTier(){
  const nav=globalThis.navigator||{},memory=Number(nav.deviceMemory||0),cores=Number(nav.hardwareConcurrency||0);
  const mobile=globalThis.matchMedia?.('(pointer:coarse)').matches||Math.min(globalThis.innerWidth||9999,globalThis.innerHeight||9999)<700;
  if(mobile&&((memory&&memory<=4)||(cores&&cores<=4)))return'LOW';
  if(mobile)return'BALANCED';
  if((memory&&memory>=12)&&(cores&&cores>=8))return'ULTRA';
  if((memory&&memory>=8)||(cores&&cores>=8))return'HIGH';
  return'BALANCED';
}

export function resolveDashQuality(requested=readDashRequestedQuality()){
  const normalized=normalizeDashQualityRequest(requested);
  return normalized==='AUTO'?detectDashHardwareTier():normalized;
}

export function getDashQualityPreset(name){
  return DASH_QUALITY_PRESETS[validTier(name)?String(name).toUpperCase():'BALANCED'];
}

export function storeDashQuality(name){
  const key=normalizeDashQualityRequest(name);
  try{globalThis.localStorage?.setItem('chimpions-dash-quality',key);}catch{}
  return key;
}
