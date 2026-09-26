import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,firefox,webkit} from '@playwright/test';

export const BASE=(process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
export const VIEWPORTS=[
  {name:'mobile-390x844',width:390,height:844},
  {name:'mobile-430x932',width:430,height:932},
  {name:'tablet-768x1024',width:768,height:1024},
  {name:'desktop-1440x900',width:1440,height:900},
  {name:'desktop-1920x1080',width:1920,height:1080},
  {name:'desktop-2560x1440',width:2560,height:1440},
];

export async function launchBrowser(name=process.env.CHIMP_BROWSER||'chromium'){
  const engines={chromium,firefox,webkit};
  assert(engines[name],`Unsupported browser: ${name}`);
  const options=name==='chromium'
    ?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
    :name==='firefox'
      ?{firefoxUserPrefs:{'webgl.force-enabled':true,'webgl.disabled':false}}
      :{};
  return {name,browser:await engines[name].launch(options)};
}

export function attachPageDiagnostics(page){
  const errors=[],consoleErrors=[],failedRequests=[],sameOriginFailures=[];
  const origin=new URL(BASE).origin;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText||'unknown'}));
  page.on('response',response=>{
    if(response.url().startsWith(origin)&&response.status()>=400)sameOriginFailures.push({url:response.url(),status:response.status()});
  });
  return {errors,consoleErrors,failedRequests,sameOriginFailures};
}

export async function waitForVisualReadiness(page,{timeout=45000,requireAuthored=true}={}){
  await page.waitForFunction(requireAuthored=>{
    const s=window.chimpJump?.();
    if(!s?.ready||!s.uiReady||document.body?.dataset?.uiReady!=='true'||document.body?.dataset?.mode!=='menu')return false;
    const requiredControls=['jump-guide-button','jump-options-button','play'];
    if(!requiredControls.every(id=>{const element=document.getElementById(id);return element&&!element.disabled&&element.getClientRects().length>0;}))return false;
    // Heavy authored environment assets are intentionally deferred until run start.
    // Menu readiness still requires the lightweight world plus all P0 controls.
    if(!requireAuthored)return true;
    return !!s.treeVisible;
  },requireAuthored,{timeout});
  await page.evaluate(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    const images=[...document.images].filter(img=>!img.hidden);
    await Promise.all(images.map(async img=>{
      if(!img.complete)await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});
      if(img.decode)try{await img.decode();}catch{}
    }));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

export async function gotoJump(page,{test=true,query='',requireAuthored=true}={}){
  const params=new URLSearchParams(query);
  if(test)params.set('test','1');
  else if(!params.has('play')&&!params.has('dash'))params.set('play','jump');
  await page.goto(BASE+'/?'+params.toString(),{waitUntil:'domcontentloaded',timeout:45000});
  await waitForVisualReadiness(page,{requireAuthored});
}

export async function assertNoHorizontalOverflow(page,label='page'){
  const layout=await page.evaluate(()=>({
    innerWidth,innerHeight,
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight
  }));
  assert(layout.scrollWidth<=layout.innerWidth+1,`${label}: horizontal overflow ${layout.scrollWidth} > ${layout.innerWidth}`);
  return layout;
}

export async function startSelectedRun(page,{fastForward=true}={}){
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
  const confirm=page.locator('#confirm-chimpion');
  await confirm.waitFor({state:'visible'});
  await confirm.click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:10000});
  if(fastForward){
    const hasHook=await page.evaluate(()=>typeof window.chimpJumpTest==='object');
    assert(hasHook,'QA browser build must expose chimpJumpTest only when VITE_CHIMP_QA_HOOKS=1');
    await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
    await page.waitForFunction(()=>['playing','paused'].includes(window.chimpJump?.().mode),{timeout:10000});
    if(await page.evaluate(()=>window.chimpJump?.().mode==='paused')){
      await page.locator('#jump-resume').click();
      await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',{timeout:5000});
    }
    await page.waitForFunction(()=>{
      const state=window.chimpJump?.();
      return !['high','ultra'].includes(state?.quality)||(state.platformReady&&state.backgroundReady);
    },{timeout:45000});
  }
}

export function writeReport(path,data){
  fs.mkdirSync('checks',{recursive:true});
  fs.writeFileSync(path,JSON.stringify(data,null,2));
}
