import {
  DASH_QUALITY_PRESETS,
  detectDashHardwareTier,
  getDashQualityPreset,
  normalizeDashQualityRequest,
  readDashRequestedQuality,
  storeDashQuality
} from './dash/rendering/quality.js';

export const DASH_QUALITY_PROFILES=DASH_QUALITY_PRESETS;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const AUTO_DEGRADATION=Object.freeze([
  Object.freeze({dpr:1,vegetation:1,particles:1,foreground:1,shafts:1,shadowScale:1,shadows:true}),
  Object.freeze({dpr:1,vegetation:1,particles:.82,foreground:.9,shafts:1,shadowScale:1,shadows:true}),
  Object.freeze({dpr:1,vegetation:.84,particles:.75,foreground:.72,shafts:.67,shadowScale:1,shadows:true}),
  Object.freeze({dpr:1,vegetation:.84,particles:.72,foreground:.68,shafts:.67,shadowScale:.5,shadows:true}),
  Object.freeze({dpr:.88,vegetation:.8,particles:.68,foreground:.62,shafts:.5,shadowScale:.5,shadows:true}),
  Object.freeze({dpr:.84,vegetation:.7,particles:.6,foreground:.5,shafts:.34,shadowScale:.5,shadows:true}),
  Object.freeze({dpr:.8,vegetation:.65,particles:.55,foreground:.42,shafts:.2,shadowScale:.5,shadows:false}),
  Object.freeze({dpr:.72,vegetation:.58,particles:.5,foreground:.35,shafts:0,shadowScale:.5,shadows:false})
]);

function percentile(samples,count,p){
  if(!count)return 0;
  const values=new Array(count);
  for(let i=0;i<count;i++)values[i]=samples[i];
  values.sort((a,b)=>a-b);
  return values[Math.min(count-1,Math.max(0,Math.ceil(count*p)-1))]||0;
}

export function createDashPerformanceController({renderer,scene,keyLight,getRuntimeStats}){
  let requested=readDashRequestedQuality();
  const hardwareTier=detectDashHardwareTier();
  let autoStep=0;
  let accessibility={reducedMotion:false,highVisibility:false};
  let lastEvaluation=0,lastAdjustment=0,badWindows=0,goodWindows=0;
  let invalidated=true,lastRenderAt=-Infinity,renderedFrames=0,skippedFrames=0;
  const samples=new Float32Array(240);
  let sampleCount=0,sampleIndex=0,averageMs=0,p95Ms=0;
  let appliedKey='';

  function baseTier(){return requested==='AUTO'?hardwareTier:requested;}
  function effective(){
    const tier=baseTier(),profile=getDashQualityPreset(tier);
    const auto=requested==='AUTO',step=auto?autoStep:0,degrade=AUTO_DEGRADATION[step]||AUTO_DEGRADATION.at(-1);
    let vegetationDensity=auto?degrade.vegetation:1;
    let particleDensity=auto?degrade.particles:1;
    let foregroundDensity=auto?degrade.foreground:1;
    let lightShaftDensity=auto?degrade.shafts:1;
    if(accessibility.reducedMotion){
      particleDensity=Math.min(particleDensity,.42);
      foregroundDensity=Math.min(foregroundDensity,.45);
      lightShaftDensity=0;
    }
    if(accessibility.highVisibility){
      foregroundDensity=Math.min(foregroundDensity,.38);
      particleDensity=Math.min(particleDensity,.72);
    }
    const shadowEnabled=!!profile.shadows&&(!auto||degrade.shadows);
    const rawShadow=shadowEnabled?Math.max(256,Math.round(profile.shadowMap*(auto?degrade.shadowScale:1)/256)*256):0;
    const dprScale=auto?degrade.dpr:1;
    const dprMax=Math.max(profile.dprMin,profile.dprMax*dprScale);
    const secondaryParticles=particleDensity>.58&&!accessibility.reducedMotion;
    return {
      requested,hardwareTier,tier,profile,autoStep:step,
      dprScale,dprMax,shadowEnabled,shadowMap:rawShadow,
      vegetationDensity,particleDensity,foregroundDensity,lightShaftDensity,
      secondaryParticles,accessibility:{...accessibility}
    };
  }

  function apply(reason='quality'){
    const q=effective();
    const deviceDpr=Number(globalThis.devicePixelRatio)||1;
    const targetDpr=clamp(Math.min(deviceDpr,q.dprMax),q.profile.dprMin,q.dprMax);
    const key=[
      q.requested,q.hardwareTier,q.tier,q.autoStep,targetDpr.toFixed(3),q.shadowEnabled?q.shadowMap:0,
      q.vegetationDensity.toFixed(2),q.particleDensity.toFixed(2),q.foregroundDensity.toFixed(2),
      q.lightShaftDensity.toFixed(2),q.accessibility.reducedMotion?1:0,q.accessibility.highVisibility?1:0
    ].join('|');
    if(key===appliedKey)return q;
    appliedKey=key;

    if(Math.abs(renderer.getPixelRatio()-targetDpr)>.01)renderer.setPixelRatio(targetDpr);
    renderer.shadowMap.enabled=q.shadowEnabled;
    renderer.shadowMap.needsUpdate=true;
    if(keyLight){
      keyLight.castShadow=q.shadowEnabled;
      if(!q.shadowEnabled){
        keyLight.shadow.map?.dispose?.();
        keyLight.shadow.map=null;
      }else if(keyLight.shadow.mapSize.width!==q.shadowMap||keyLight.shadow.mapSize.height!==q.shadowMap){
        keyLight.shadow.map?.dispose?.();
        keyLight.shadow.map=null;
        keyLight.shadow.mapSize.set(q.shadowMap,q.shadowMap);
      }
    }

    document.body.dataset.dashQuality=q.tier.toLowerCase();
    document.body.dataset.dashSecondaryParticles=q.secondaryParticles?'on':'off';
    document.body.dataset.dashVegetation=q.vegetationDensity<.8?'reduced':'full';
    delete document.body.dataset.dashPostprocessing;
    invalidated=true;
    const detail={...q,dpr:targetDpr,reason};
    window.dispatchEvent(new CustomEvent('chimpions-dash-quality-change',{detail}));
    return detail;
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
    const healthy=p95Ms<p.p95BudgetMs*.72&&averageMs<p.avgBudgetMs*.76;
    badWindows=stressed?badWindows+1:0;
    goodWindows=healthy?goodWindows+1:0;
    const sinceAdjustment=now-lastAdjustment;
    if(badWindows>=2&&autoStep<AUTO_DEGRADATION.length-1&&sinceAdjustment>=5000){
      autoStep++;badWindows=0;goodWindows=0;lastAdjustment=now;apply('adaptive-down');
    }else if(goodWindows>=6&&autoStep>0&&sinceAdjustment>=10000){
      autoStep--;badWindows=0;goodWindows=0;lastAdjustment=now;apply('adaptive-up');
    }
  }

  function observeFrame(frameMs,state,now=performance.now()){
    if(state!=='running'||frameMs<=0||frameMs>250)return;
    samples[sampleIndex]=frameMs;
    sampleIndex=(sampleIndex+1)%samples.length;
    sampleCount=Math.min(samples.length,sampleCount+1);
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
    requested=normalizeDashQualityRequest(value);
    autoStep=0;resetFrameWindow();
    if(persist)storeDashQuality(requested);
    apply('manual');
    return requested;
  }

  function setAccessibility(next={}){
    const reducedMotion=!!next.reducedMotion,highVisibility=!!next.highVisibility;
    if(reducedMotion===accessibility.reducedMotion&&highVisibility===accessibility.highVisibility)return effective();
    accessibility={reducedMotion,highVisibility};
    return apply('accessibility');
  }

  function reapply(reason='reapply'){appliedKey='';return apply(reason);}
  function qualityState(){const q=effective();return {...q,dpr:renderer.getPixelRatio()};}

  function diagnostics(){
    recalcWindow();
    let sceneObjects=0,instancedMeshes=0,particles=0;
    scene.traverse(object=>{
      sceneObjects++;
      if(object.isInstancedMesh)instancedMeshes++;
      if(object.isPoints)particles+=object.geometry?.drawRange?.count||object.geometry?.attributes?.position?.count||0;
    });
    const runtime=getRuntimeStats?.()||{},info=renderer.info,q=effective(),caps=renderer.capabilities||{};
    return {
      requestedQuality:requested,resolvedHardwareTier:hardwareTier,qualityTier:q.tier,autoStep,
      dpr:renderer.getPixelRatio(),dprMax:q.dprMax,
      budget:{averageFrameMs:q.profile.avgBudgetMs,p95FrameMs:q.profile.p95BudgetMs,idleFps:q.profile.idleFps},
      averageFrameMs:Number(averageMs.toFixed(2)),p95FrameMs:Number(p95Ms.toFixed(2)),
      frameSamples:sampleCount,renderedFrames,skippedFrames,
      renderer:{
        calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,
        webgl2:!!caps.isWebGL2,maxTextureSize:caps.maxTextureSize||0
      },
      sceneObjects,instancedMeshes,particles,
      shadowEnabled:q.shadowEnabled,shadowMap:q.shadowMap,
      vegetationDensity:q.vegetationDensity,particleDensity:q.particleDensity,foregroundDensity:q.foregroundDensity,
      secondaryParticles:q.secondaryParticles,accessibility:{...q.accessibility},
      postprocessing:'disabled-direct-render',
      ...runtime
    };
  }

  apply('startup');
  return {
    observeFrame,shouldRender,markRendered,invalidate,setQuality,setAccessibility,reapply,qualityState,diagnostics,resetFrameWindow,
    get requestedQuality(){return requested;}
  };
}
