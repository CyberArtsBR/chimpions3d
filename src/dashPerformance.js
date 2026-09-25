const ORDER=['LOW','BALANCED','HIGH','ULTRA'];
export const DASH_QUALITY_PROFILES=Object.freeze({
  LOW:Object.freeze({dprMin:.65,dprMax:1,shadowMap:512,idleFps:10,p95BudgetMs:28,avgBudgetMs:22}),
  BALANCED:Object.freeze({dprMin:.7,dprMax:1.25,shadowMap:512,idleFps:12,p95BudgetMs:24,avgBudgetMs:19}),
  HIGH:Object.freeze({dprMin:.8,dprMax:1.6,shadowMap:1024,idleFps:15,p95BudgetMs:21,avgBudgetMs:18}),
  ULTRA:Object.freeze({dprMin:1,dprMax:2,shadowMap:2048,idleFps:18,p95BudgetMs:19,avgBudgetMs:17})
});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validQuality=value=>{
  const q=String(value||'').toUpperCase();
  return q==='AUTO'||ORDER.includes(q)?q:'AUTO';
};
const mobileBaseline=()=>matchMedia?.('(pointer: coarse)')?.matches||innerWidth<760?'BALANCED':'HIGH';

function readSavedQuality(){
  try{return validQuality(localStorage.getItem('chimpions-dash-quality')||'AUTO');}catch{return 'AUTO';}
}
function percentile(samples,count,p){
  if(!count)return 0;
  const values=new Array(count);
  for(let i=0;i<count;i++)values[i]=samples[i];
  values.sort((a,b)=>a-b);
  return values[Math.min(count-1,Math.max(0,Math.ceil(count*p)-1))]||0;
}

export function createDashPerformanceController({renderer,scene,keyLight,getRuntimeStats}){
  const queryQuality=new URLSearchParams(location.search).get('quality');
  let requested=validQuality(queryQuality||readSavedQuality());
  let autoTier=mobileBaseline();
  let autoStep=0;
  let lastEvaluation=0,lastAdjustment=0,badWindows=0,goodWindows=0;
  let invalidated=true,lastRenderAt=-Infinity,renderedFrames=0,skippedFrames=0;
  const samples=new Float32Array(240);
  let sampleCount=0,sampleIndex=0,averageMs=0,p95Ms=0;
  let appliedKey='';

  function baseTier(){return requested==='AUTO'?autoTier:requested;}
  function effective(){
    const tier=baseTier(),profile=DASH_QUALITY_PROFILES[tier];
    const auto=requested==='AUTO';
    const step=auto?autoStep:0;
    const secondaryParticles=auto?step<1:tier!=='LOW';
    const vegetation=auto?(step<2?'full':'reduced'):(tier==='LOW'?'reduced':'full');
    const shadowMap=auto&&step>=3?Math.max(256,profile.shadowMap>>1):profile.shadowMap;
    const postprocessing=auto?step<4:!['LOW','BALANCED'].includes(tier);
    const dprScale=auto&&step>=5?clamp(1-.12*(step-4),.64,1):1;
    const dprMax=Math.max(profile.dprMin,profile.dprMax*dprScale);
    return {tier,profile,secondaryParticles,vegetation,shadowMap,postprocessing,dprScale,dprMax};
  }

  function apply(reason='quality'){
    const q=effective();
    const targetDpr=clamp(Math.min(devicePixelRatio||1,q.dprMax),q.profile.dprMin,q.dprMax);
    const key=[q.tier,requested,autoStep,q.shadowMap,q.postprocessing,q.vegetation,q.secondaryParticles,targetDpr.toFixed(3)].join('|');
    if(key===appliedKey)return;
    appliedKey=key;
    if(Math.abs(renderer.getPixelRatio()-targetDpr)>.01)renderer.setPixelRatio(targetDpr);
    renderer.shadowMap.enabled=q.shadowMap>0;
    if(keyLight){
      keyLight.castShadow=q.shadowMap>0;
      if(keyLight.shadow.mapSize.width!==q.shadowMap||keyLight.shadow.mapSize.height!==q.shadowMap){
        keyLight.shadow.map?.dispose?.();
        keyLight.shadow.map=null;
        keyLight.shadow.mapSize.set(q.shadowMap,q.shadowMap);
      }
    }
    document.body.dataset.dashQuality=q.tier.toLowerCase();
    document.body.dataset.dashSecondaryParticles=q.secondaryParticles?'on':'off';
    document.body.dataset.dashVegetation=q.vegetation;
    document.body.dataset.dashPostprocessing=q.postprocessing?'on':'off';
    invalidated=true;
    window.dispatchEvent(new CustomEvent('chimpions-dash-quality-change',{detail:{
      requested,tier:q.tier,autoStep,reason,dpr:targetDpr,
      secondaryParticles:q.secondaryParticles,vegetation:q.vegetation,
      shadowMap:q.shadowMap,postprocessing:q.postprocessing
    }}));
  }

  function recalcWindow(){
    if(!sampleCount){averageMs=0;p95Ms=0;return;}
    let total=0;
    for(let i=0;i<sampleCount;i++)total+=samples[i];
    averageMs=total/sampleCount;
    p95Ms=percentile(samples,sampleCount,.95);
  }

  function evaluate(now){
    if(requested!=='AUTO'||sampleCount<60||now-lastEvaluation<2500)return;
    lastEvaluation=now;recalcWindow();
    const q=effective(),p=q.profile;
    const stressed=p95Ms>p.p95BudgetMs||averageMs>p.avgBudgetMs;
    const healthy=p95Ms<p.p95BudgetMs*.74&&averageMs<p.avgBudgetMs*.78;
    badWindows=stressed?badWindows+1:0;
    goodWindows=healthy?goodWindows+1:0;
    if(now-lastAdjustment<5000)return;
    if(badWindows>=2&&autoStep<7){
      autoStep++;badWindows=0;goodWindows=0;lastAdjustment=now;apply('adaptive-down');
    }else if(goodWindows>=4&&autoStep>0){
      autoStep--;badWindows=0;goodWindows=0;lastAdjustment=now;apply('adaptive-up');
    }
  }

  function observeFrame(frameMs,state,now=performance.now()){
    if(state!=='running'||frameMs<=0||frameMs>250)return;
    samples[sampleIndex]=frameMs;
    sampleIndex=(sampleIndex+1)%samples.length;
    sampleCount=Math.min(samples.length,sampleCount+1);
    if(sampleCount===samples.length&&sampleIndex!==0){
      // Keep the percentile buffer contiguous without allocating on the hot path.
      const copy=samples.slice(sampleIndex);
      samples.copyWithin(copy.length,0,sampleIndex);
      samples.set(copy,0);
      sampleIndex=0;
    }
    evaluate(now);
  }

  function shouldRender(now,state){
    if(document.hidden){skippedFrames++;return false;}
    if(state==='running'||invalidated)return true;
    const fps=state==='paused'?8:effective().profile.idleFps;
    if(now-lastRenderAt>=1000/fps)return true;
    skippedFrames++;return false;
  }
  function markRendered(now){lastRenderAt=now;invalidated=false;renderedFrames++;}
  function invalidate(){invalidated=true;}
  function resetFrameWindow(){sampleCount=0;sampleIndex=0;averageMs=0;p95Ms=0;badWindows=0;goodWindows=0;}

  function setQuality(value,{persist=true}={}){
    requested=validQuality(value);
    if(requested==='AUTO'){autoTier=mobileBaseline();autoStep=0;resetFrameWindow();}
    if(persist)try{localStorage.setItem('chimpions-dash-quality',requested);}catch{}
    apply('manual');
    return requested;
  }

  function diagnostics(){
    recalcWindow();
    let sceneObjects=0,instancedMeshes=0,particles=0;
    scene.traverse(object=>{
      sceneObjects++;
      if(object.isInstancedMesh)instancedMeshes++;
      if(object.isPoints)particles+=object.geometry?.attributes?.position?.count||0;
    });
    const runtime=getRuntimeStats?.()||{};
    const info=renderer.info;
    const q=effective();
    return {
      requestedQuality:requested,qualityTier:q.tier,autoStep,
      dpr:renderer.getPixelRatio(),dprMax:q.dprMax,
      averageFrameMs:Number(averageMs.toFixed(2)),p95FrameMs:Number(p95Ms.toFixed(2)),
      frameSamples:sampleCount,renderedFrames,skippedFrames,
      renderer:{calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures},
      sceneObjects,instancedMeshes,particles,
      secondaryParticles:q.secondaryParticles,vegetation:q.vegetation,shadowMap:q.shadowMap,postprocessing:q.postprocessing,
      ...runtime
    };
  }

  apply('startup');
  return {observeFrame,shouldRender,markRendered,invalidate,setQuality,diagnostics,resetFrameWindow,get requestedQuality(){return requested;}};
}
