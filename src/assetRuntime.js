import * as THREE from 'three';

const prefetched=new Set();

const telemetry={
  requests:0,
  completed:0,
  failed:0,
  aborted:0,
  active:0,
  transferredBytes:0,
  totalLoadMs:0,
  totalDecodeMs:0,
  maxLoadMs:0,
  maxDecodeMs:0,
  recent:[]
};

const now=()=>globalThis.performance?.now?.()??Date.now();
function pushRecent(entry){
  telemetry.recent.push(entry);
  if(telemetry.recent.length>24)telemetry.recent.splice(0,telemetry.recent.length-24);
}
function finish(kind,url,started,status,bytes=0){
  const durationMs=Math.max(0,now()-started);
  telemetry.active=Math.max(0,telemetry.active-1);
  if(status==='ok')telemetry.completed++;
  else if(status==='aborted')telemetry.aborted++;
  else telemetry.failed++;
  telemetry.transferredBytes+=Math.max(0,Number(bytes)||0);
  telemetry.totalLoadMs+=durationMs;
  telemetry.maxLoadMs=Math.max(telemetry.maxLoadMs,durationMs);
  pushRecent({kind,url:String(url),status,durationMs:Number(durationMs.toFixed(1)),bytes:Math.max(0,Number(bytes)||0)});
}

export async function fetchAssetBuffer(url,{signal,kind='asset'}={}){
  const started=now();telemetry.requests++;telemetry.active++;
  try{
    const response=await fetch(url,{signal,cache:'force-cache'});
    if(!response.ok)throw new Error(`Asset request failed (${response.status}) for ${url}`);
    const buffer=await response.arrayBuffer();
    finish(kind,url,started,'ok',buffer.byteLength);
    return buffer;
  }catch(error){
    finish(kind,url,started,error?.name==='AbortError'?'aborted':'error');
    throw error;
  }
}

export async function trackAssetDecode(kind,url,work){
  const started=now();let status='ok';
  try{return await work();}
  catch(error){status='error';throw error;}
  finally{
    const durationMs=Math.max(0,now()-started);
    telemetry.totalDecodeMs+=durationMs;
    telemetry.maxDecodeMs=Math.max(telemetry.maxDecodeMs,durationMs);
    pushRecent({kind:`${kind}:decode`,url:String(url),status,durationMs:Number(durationMs.toFixed(1)),bytes:0});
  }
}

export function createTrackedLoadingManager(kind='dependency'){
  const manager=new THREE.LoadingManager();
  const starts=new Map(),failed=new Set();
  manager.onStart=url=>{
    if(starts.has(url))return;
    starts.set(url,now());telemetry.requests++;telemetry.active++;
  };
  manager.onError=url=>{failed.add(url);};
  manager.onProgress=url=>{
    const started=starts.get(url);
    if(started===undefined)return;
    const durationMs=Math.max(0,now()-started),status=failed.has(url)?'error':'ok';
    telemetry.active=Math.max(0,telemetry.active-1);
    if(status==='ok')telemetry.completed++;else telemetry.failed++;
    telemetry.totalLoadMs+=durationMs;telemetry.maxLoadMs=Math.max(telemetry.maxLoadMs,durationMs);
    pushRecent({kind,url:String(url),status,durationMs:Number(durationMs.toFixed(1)),bytes:0});
    starts.delete(url);failed.delete(url);
  };
  return manager;
}

export function prefetchVisualAsset(url){
  if(typeof document==='undefined'||!url)return null;
  const key=String(url);
  if(prefetched.has(key))return null;
  prefetched.add(key);
  const link=document.createElement('link');
  link.rel='prefetch';
  link.as=/\.(?:glb|gltf)(?:\?|$)/i.test(key)?'fetch':'image';
  link.href=key;
  link.crossOrigin='anonymous';
  link.dataset.chimpPrefetch=key;
  document.head.append(link);
  return link;
}

export function versionedAssetUrl(url,hash){
  if(!hash)return url;
  const separator=String(url).includes('?')?'&':'?';
  return `${url}${separator}v=${String(hash).slice(0,16)}`;
}

export function assetRuntimeSnapshot(){
  const averageLoadMs=telemetry.completed?telemetry.totalLoadMs/telemetry.completed:0;
  return {
    requests:telemetry.requests,
    completed:telemetry.completed,
    failed:telemetry.failed,
    aborted:telemetry.aborted,
    active:telemetry.active,
    transferredBytes:telemetry.transferredBytes,
    averageLoadMs:Number(averageLoadMs.toFixed(1)),
    maxLoadMs:Number(telemetry.maxLoadMs.toFixed(1)),
    totalDecodeMs:Number(telemetry.totalDecodeMs.toFixed(1)),
    maxDecodeMs:Number(telemetry.maxDecodeMs.toFixed(1)),
    recent:telemetry.recent.slice()
  };
}
