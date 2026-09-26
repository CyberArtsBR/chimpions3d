import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {LUTPass} from 'three/addons/postprocessing/LUTPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

const AtmosphereShader={
  uniforms:{
    tDiffuse:{value:null},
    fogColor:{value:new THREE.Color(0x91b6a0)},
    strength:{value:.1},
    shafts:{value:.075},
    night:{value:0},
    time:{value:0},
    reducedMotion:{value:0}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec3 fogColor;
    uniform float strength,shafts,night,time,reducedMotion;
    varying vec2 vUv;
    void main(){
      vec4 base=texture2D(tDiffuse,vUv);
      float center=abs(vUv.x-.5)*2.0;
      float edge=smoothstep(.32,1.0,center);
      float canopy=smoothstep(.18,.98,vUv.y)*(1.0-smoothstep(.80,1.0,vUv.y));
      float routeClear=1.0-smoothstep(.12,.46,center);
      float fog=(.22+.78*edge)*canopy*(1.0-routeClear*.78)*strength;
      vec2 sunUv=vec2(.18,.90);
      vec2 delta=vUv-sunUv;
      float dist=length(delta);
      float angle=atan(delta.y,delta.x);
      float phase=reducedMotion>.5?0.0:time*.14;
      float bands=.55+.45*sin(angle*18.0+phase);
      float ray=smoothstep(.78,.05,dist)*pow(max(0.0,bands),3.0)*shafts*(1.0-night*.72);
      vec3 mist=mix(fogColor,vec3(1.0,.93,.78),ray*.75);
      vec3 color=mix(base.rgb,mist,clamp(fog+ray,0.0,.18));
      gl_FragColor=vec4(color,base.a);
    }
  `
};

const SharpenShader={
  uniforms:{
    tDiffuse:{value:null},
    resolution:{value:new THREE.Vector2(1,1)},
    strength:{value:.18}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;
    void main(){
      vec2 px=1.0/max(resolution,vec2(1.0));
      vec4 c=texture2D(tDiffuse,vUv);
      vec3 n=texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb;
      vec3 s=texture2D(tDiffuse,vUv-vec2(0.0,px.y)).rgb;
      vec3 e=texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb;
      vec3 w=texture2D(tDiffuse,vUv-vec2(px.x,0.0)).rgb;
      vec3 avg=(n+s+e+w)*.25;
      float luma=dot(c.rgb,vec3(.2126,.7152,.0722));
      float adaptive=1.0-smoothstep(.88,1.6,luma);
      vec3 result=c.rgb+(c.rgb-avg)*strength*adaptive;
      gl_FragColor=vec4(max(result,vec3(0.0)),c.a);
    }
  `
};

const CinematicDofShader={
  uniforms:{
    tDiffuse:{value:null},
    resolution:{value:new THREE.Vector2(1,1)},
    strength:{value:0}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;
    void main(){
      vec2 px=1.0/max(resolution,vec2(1.0));
      vec2 focus=vec2(.5,.55);
      float blur=smoothstep(.34,.82,length((vUv-focus)*vec2(.82,1.0)))*strength;
      vec4 c=texture2D(tDiffuse,vUv);
      vec4 sum=c*4.0;
      sum+=texture2D(tDiffuse,vUv+vec2(px.x,0.0)*2.0);
      sum+=texture2D(tDiffuse,vUv-vec2(px.x,0.0)*2.0);
      sum+=texture2D(tDiffuse,vUv+vec2(0.0,px.y)*2.0);
      sum+=texture2D(tDiffuse,vUv-vec2(0.0,px.y)*2.0);
      vec4 softened=sum/8.0;
      gl_FragColor=mix(c,softened,clamp(blur,0.0,.55));
    }
  `
};

function makeLut(size=16,variant=0){
  const data=new Uint8Array(size*size*size*4);
  let offset=0;
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let r=x/(size-1),g=y/(size-1),b=z/(size-1);
    const l=r*.2126+g*.7152+b*.0722;
    if(variant===0){
      r*=1.035;g*=1.018;b*=.985;
      b+=Math.max(0,.45-l)*.025;
    }else if(variant===1){
      r*=.985;g*=1.035;b*=1.02;
      b+=Math.max(0,.55-l)*.035;
    }else if(variant===2){
      r*=1.07;g*=1.012;b*=.95;
      b+=Math.max(0,.45-l)*.018;
    }else{
      r*=.94;g*=1.00;b*=1.085;
      r+=Math.max(0,l-.72)*.025;
    }
    const contrast=1.035;
    r=(r-.5)*contrast+.5;
    g=(g-.5)*contrast+.5;
    b=(b-.5)*contrast+.5;
    data[offset++]=Math.round(clamp(r,0,1)*255);
    data[offset++]=Math.round(clamp(g,0,1)*255);
    data[offset++]=Math.round(clamp(b,0,1)*255);
    data[offset++]=255;
  }
  const texture=new THREE.Data3DTexture(data,size,size,size);
  texture.format=THREE.RGBAFormat;
  texture.type=THREE.UnsignedByteType;
  texture.minFilter=THREE.LinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.unpackAlignment=1;
  texture.needsUpdate=true;
  return texture;
}

function makeContactShadow(){
  const size=64,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(size/2,size/2,2,size/2,size/2,size/2);
  gradient.addColorStop(0,'rgba(13,30,24,.58)');
  gradient.addColorStop(.48,'rgba(22,44,34,.26)');
  gradient.addColorStop(1,'rgba(22,44,34,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.42),material);
  mesh.name='chimp-contact-shadow';mesh.position.z=.34;mesh.renderOrder=3;mesh.visible=false;
  return mesh;
}

function targetTypeLabel(type){
  if(type===THREE.HalfFloatType)return 'half-float';
  if(type===THREE.UnsignedByteType)return 'unsigned-byte';
  return 'default';
}

export function createJumpRenderPipeline({renderer,scene,camera,sun,width=innerWidth,height=innerHeight}={}){
  let settings=null,composer=null,rootTarget=null,renderPass=null,ssaoPass=null,bloomPass=null,lutPass=null,atmospherePass=null,dofPass=null,sharpenPass=null,outputPass=null;
  let viewportWidth=Math.max(1,width|0),viewportHeight=Math.max(1,height|0),activeTheme=0,builds=0;
  const luts=[0,1,2,3].map(index=>makeLut(16,index));
  const contactShadow=makeContactShadow();scene.add(contactShadow);

  function disposeComposer(){
    for(const pass of [ssaoPass,bloomPass,lutPass,atmospherePass,dofPass,sharpenPass,outputPass,renderPass])try{pass?.dispose?.();}catch{}
    try{composer?.dispose?.();}catch{}
    composer=rootTarget=renderPass=ssaoPass=bloomPass=lutPass=atmospherePass=dofPass=sharpenPass=outputPass=null;
  }

  function refreshAnisotropy(){
    if(!settings)return;
    const supported=Math.max(1,Number(renderer.capabilities.getMaxAnisotropy?.())||1);
    const target=Math.max(1,Math.min(supported,Math.round(settings.maxAnisotropy||1)));
    const seen=new Set();
    scene.traverse(object=>{
      const materials=object?.material?(Array.isArray(object.material)?object.material:[object.material]):[];
      for(const material of materials)for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','bumpMap','aoMap','alphaMap']){
        const texture=material?.[key];
        if(texture?.isTexture)seen.add(texture);
      }
    });
    for(const texture of seen){
      if(texture.anisotropy!==target){texture.anisotropy=target;texture.needsUpdate=true;}
    }
    return {requested:target,supported,textures:seen.size};
  }

  function applyShadows(){
    const enabled=!!settings?.shadows;
    renderer.shadowMap.enabled=enabled;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    sun.castShadow=enabled;
    if(!enabled)return;
    const size=Math.max(512,Math.min(2048,Math.round(settings.shadowMapSize||1024)));
    const changed=sun.shadow.mapSize.x!==size||sun.shadow.mapSize.y!==size;
    sun.shadow.mapSize.set(size,size);
    sun.shadow.bias=Number(settings.shadowBias)||-.0005;
    sun.shadow.normalBias=Math.max(0,Number(settings.shadowNormalBias)||.04);
    sun.shadow.radius=settings.profile==='cinematic-max'?2:1;
    if(changed&&sun.shadow.map){sun.shadow.map.dispose?.();sun.shadow.map=null;}
    renderer.shadowMap.needsUpdate=true;
  }

  function buildComposer(){
    disposeComposer();
    if(!settings?.postProcessing)return;
    const gl=renderer.getContext();
    const canHalf=renderer.capabilities.isWebGL2&&!!gl.getExtension('EXT_color_buffer_float');
    const type=settings.renderTargetType==='half-float'&&canHalf?THREE.HalfFloatType:THREE.UnsignedByteType;
    rootTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    rootTarget.samples=0;
    composer=new EffectComposer(renderer,rootTarget);
    renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);

    if(settings.ambientOcclusion&&renderer.capabilities.isWebGL2){
      ssaoPass=new SSAOPass(scene,camera,1,1,16);
      ssaoPass.kernelRadius=settings.aoKernelRadius||6;
      ssaoPass.minDistance=settings.aoMinDistance||.0025;
      ssaoPass.maxDistance=settings.aoMaxDistance||.085;
      composer.addPass(ssaoPass);
    }

    if(settings.bloomEnabled){
      bloomPass=new UnrealBloomPass(new THREE.Vector2(1,1),settings.bloomStrength||.42,settings.bloomRadius||.4,settings.bloomThreshold||1.65);
      composer.addPass(bloomPass);
    }

    if(settings.colorGrading&&renderer.capabilities.isWebGL2){
      lutPass=new LUTPass({lut:luts[activeTheme],intensity:settings.colorGradeIntensity||.58});
      composer.addPass(lutPass);
    }

    if(settings.atmosphereEnabled||settings.lightShafts){
      atmospherePass=new ShaderPass(AtmosphereShader);
      atmospherePass.uniforms.strength.value=settings.atmosphereEnabled?settings.atmosphereStrength||.1:0;
      atmospherePass.uniforms.shafts.value=settings.lightShafts?settings.lightShaftStrength||.075:0;
      composer.addPass(atmospherePass);
    }

    if(settings.depthOfField==='cinematic-only'){
      dofPass=new ShaderPass(CinematicDofShader);
      dofPass.enabled=false;
      composer.addPass(dofPass);
    }

    if(settings.sharpenEnabled){
      sharpenPass=new ShaderPass(SharpenShader);
      sharpenPass.uniforms.strength.value=settings.sharpenStrength||.18;
      composer.addPass(sharpenPass);
    }

    outputPass=new OutputPass();composer.addPass(outputPass);
    builds++;
    resize(viewportWidth,viewportHeight);
  }

  function resize(width,height){
    viewportWidth=Math.max(1,Math.floor(width||1));viewportHeight=Math.max(1,Math.floor(height||1));
    if(!composer)return;
    const dpr=renderer.getPixelRatio();
    composer.setPixelRatio(dpr);
    composer.setSize(viewportWidth,viewportHeight);
    if(ssaoPass){
      const scale=clamp(settings.aoResolutionScale||.5,.25,1);
      ssaoPass.setSize(Math.max(1,Math.round(viewportWidth*dpr*scale)),Math.max(1,Math.round(viewportHeight*dpr*scale)));
    }
    const resolution=new THREE.Vector2(Math.max(1,viewportWidth*dpr),Math.max(1,viewportHeight*dpr));
    sharpenPass?.uniforms?.resolution?.value.copy(resolution);
    dofPass?.uniforms?.resolution?.value.copy(resolution);
  }

  function applyQuality(next){
    const previous=settings?.profile;
    settings=next;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,settings.dprCap||1));
    applyShadows();
    if(previous!==settings.profile||!!composer!==!!settings.postProcessing)buildComposer();
    else{
      if(bloomPass){
        bloomPass.strength=settings.bloomStrength||0;
        bloomPass.radius=settings.bloomRadius||0;
        bloomPass.threshold=settings.bloomThreshold||1.65;
      }
      if(lutPass)lutPass.intensity=settings.colorGradeIntensity||.58;
      if(sharpenPass)sharpenPass.uniforms.strength.value=settings.sharpenStrength||.18;
      if(atmospherePass){
        atmospherePass.uniforms.strength.value=settings.atmosphereEnabled?settings.atmosphereStrength||.1:0;
        atmospherePass.uniforms.shafts.value=settings.lightShafts?settings.lightShaftStrength||.075:0;
      }
      resize(viewportWidth,viewportHeight);
    }
    contactShadow.visible=false;
    refreshAnisotropy();
  }

  function updateFrame({mode='playing',themeIndex=0,night=0,time=0,reducedMotion=false,fogColor=null,playerX=0,playerY=0,groundY=null,landing=0}={}){
    activeTheme=Math.max(0,Math.min(3,Math.trunc(themeIndex)||0));
    if(lutPass&&lutPass.lut!==luts[activeTheme])lutPass.lut=luts[activeTheme];
    if(atmospherePass){
      if(fogColor)atmospherePass.uniforms.fogColor.value.copy(fogColor);
      atmospherePass.uniforms.night.value=clamp(night,0,1);
      atmospherePass.uniforms.time.value=time;
      atmospherePass.uniforms.reducedMotion.value=reducedMotion?1:0;
      atmospherePass.uniforms.shafts.value=reducedMotion?0:(settings.lightShafts?settings.lightShaftStrength||.075:0);
    }
    if(dofPass){
      const cinematic=!reducedMotion&&(mode==='starting'||mode==='dying');
      dofPass.enabled=cinematic;
      dofPass.uniforms.strength.value=cinematic?(settings.dofStrength||.34):0;
    }
    if(settings?.contactShadow&&Number.isFinite(groundY)&&mode!=='dying'){
      const gap=Math.max(0,playerY-groundY);
      const proximity=1-clamp(gap/1.55,0,1);
      contactShadow.visible=proximity>.025;
      contactShadow.position.set(playerX,groundY+.035,.34);
      contactShadow.scale.set(1+gap*.18,.82+gap*.08,1);
      contactShadow.material.opacity=(.08+.13*proximity+.06*clamp(landing,0,1))*proximity;
    }else contactShadow.visible=false;
  }

  function render(dt=0){
    if(composer)composer.render(dt);
    else renderer.render(scene,camera);
  }

  function getDiagnostics(){
    const dpr=renderer.getPixelRatio(),aoScale=ssaoPass?clamp(settings?.aoResolutionScale||.5,.25,1):0;
    return {
      graphicsProfile:settings?.profile||'unknown',
      rendererDpr:dpr,
      postProcessingEnabled:!!composer,
      renderTargetType:composer?targetTypeLabel(rootTarget?.texture?.type):'default-framebuffer',
      renderTargetSamples:composer?rootTarget?.samples||0:null,
      postResolution:composer?1:0,
      anisotropyRequested:Math.min(Number(renderer.capabilities.getMaxAnisotropy?.())||1,settings?.maxAnisotropy||1),
      ambientOcclusionEnabled:!!ssaoPass,
      aoResolutionScale:aoScale,
      shadowEnabled:!!renderer.shadowMap.enabled,
      shadowMapSize:sun.castShadow?sun.shadow.mapSize.x:0,
      contactShadowEnabled:!!settings?.contactShadow,
      bloomEnabled:!!bloomPass,
      bloomStrength:bloomPass?.strength||0,
      colorGradingEnabled:!!lutPass,
      sharpenEnabled:!!sharpenPass,
      atmosphereEnabled:!!atmospherePass&&!!settings?.atmosphereEnabled,
      atmosphereResolutionScale:settings?.atmosphereResolutionScale||0,
      lightShaftsEnabled:!!atmospherePass&&!!settings?.lightShafts,
      depthOfFieldEnabled:!!dofPass?.enabled,
      pipelineBuilds:builds
    };
  }

  function dispose(){
    disposeComposer();
    contactShadow.geometry.dispose();
    contactShadow.material.map?.dispose?.();
    contactShadow.material.dispose();
    scene.remove(contactShadow);
    for(const lut of luts)lut.dispose();
  }

  return {applyQuality,resize,updateFrame,render,refreshAnisotropy,getDiagnostics,dispose};
}
