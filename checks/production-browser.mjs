import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const base=(process.env.CHIMP_PRODUCTION_URL||'https://chimp-jump.onrender.com').replace(/\/$/,'');
const expectedCommit=process.env.CHIMP_EXPECTED_COMMIT||'';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],consoleErrors=[],sameOriginFailures=[];
const origin=new URL(base).origin;
const report={status:'PASS',scope:'production-public-browser',base,checkpoints:{},sameOriginFailures};

page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)sameOriginFailures.push({url:response.url(),status:response.status()});});

async function shot(name){await page.screenshot({path:'checks/'+name,fullPage:false,animations:'disabled',timeout:90000});}
async function snap(name){const state=await page.evaluate(()=>window.chimpJump());report.checkpoints[name]=state;return state;}
async function waitVisualReady(){
  await page.waitForFunction(()=>window.chimpJump?.().ready&&window.chimpJump().platformReady&&window.chimpJump().backgroundReady&&document.body?.dataset?.mode==='menu',null,{timeout:45000});
  await page.evaluate(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    await Promise.all([...document.images].filter(img=>!img.hidden).map(async img=>{if(img.decode)try{await img.decode();}catch{}}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

try{
  const versionResponse=await page.request.get(base+'/version.json?audit='+Date.now());
  assert(versionResponse.ok(),'Production version manifest must be reachable');
  const version=await versionResponse.json();
  assert(/^[a-f0-9]{40}$/.test(version.commit||''),'Production version manifest must contain a full commit SHA');
  report.version=version;
  if(expectedCommit){
    report.revision={expected:expectedCommit,live:version.commit,exact:expectedCommit===version.commit};
    assert.equal(version.commit,expectedCommit,`Production revision drift: expected ${expectedCommit}, live ${version.commit}`);
  }

  const liveUrl=base+'/?play=jump&test=1&audit='+Date.now();
  report.liveUrl=liveUrl;
  await page.goto(liveUrl,{waitUntil:'domcontentloaded',timeout:45000});
  await waitVisualReady();

  assert.equal(await page.evaluate(()=>typeof window.chimpJumpTest),'undefined','Public production must not expose mutable chimpJumpTest even when query parameters are user-controlled');
  const diagnosticSafety=await page.evaluate(()=>{
    const before=window.chimpJump();
    const originalSeed=before.runSeed,originalHeight=before.height;
    const hasCallableValue=Object.values(before).some(value=>typeof value==='function');
    before.runSeed=0;before.height=999999;
    if(Array.isArray(before.platformTypes))before.platformTypes.push('__qa_mutation_probe__');
    const after=window.chimpJump();
    return {
      hasCallableValue,
      snapshotIsolated:after.runSeed===originalSeed&&after.height===originalHeight&&!after.platformTypes.includes('__qa_mutation_probe__')
    };
  });
  assert.equal(diagnosticSafety.hasCallableValue,false,'Readonly diagnostics must not expose callable mutation functions');
  assert.equal(diagnosticSafety.snapshotIsolated,true,'Mutating a diagnostics snapshot must not mutate live game state');
  report.publicMutationApi='absent';
  report.readonlyDiagnostics=diagnosticSafety;

  const menu=await snap('menu');
  assert.equal(menu.cameraZoom,1,'Production title screen must keep full-route camera state');
  assert(['balanced','high','ultra'].includes(menu.quality),'Production quality profile must be recognized');
  assert(await page.getByRole('button',{name:'Field guide',exact:true}).isVisible());
  await shot('production-menu-desktop.png');

  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  const guide=page.locator('#jump-guide-dialog[open]');
  await guide.waitFor({state:'visible'});
  assert.equal(await page.locator('#jump-goals li').count(),6,'Production Field Guide must expose six expedition goals');
  await shot('production-guide-desktop.png');
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();

  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
  await page.getByRole('searchbox',{name:'Search characters'}).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('#collection-dialog .avatar-option').length===10);
  assert(await page.locator('#selected-chimpion-meta').isVisible(),'Expanded picker must be deployed');
  assert.equal(await page.locator('#collection-dialog .avatar-option').count(),10,'Production picker must expose the canonical 10 Chimpions');
  await shot('production-picker-desktop.png');

  const firstPlayable=page.locator('#collection-dialog .avatar-option:not(:disabled)').first();
  await firstPlayable.click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:15000});
  await page.waitForFunction(()=>window.chimpJump?.().countdown===3&&!document.getElementById('countdown').hidden,{timeout:18000});
  const countdown=await snap('countdown');
  assert.equal(countdown.time,0,'Gameplay physics must remain frozen during countdown');
  await shot('production-countdown-desktop.png');

  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',{timeout:8000});
  const playing=await snap('playing');
  assert(playing.visible&&playing.platformReady&&playing.backgroundReady,'Production gameplay visuals must be ready');
  assert(playing.visibleBranches>=4,'Production route branches must attach');
  await shot('production-playing-desktop.png');

  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(()=>window.chimpJump().yaw<0,{timeout:2500});
  await page.keyboard.up('ArrowLeft');
  report.keyboardSteering=true;

  await page.getByRole('button',{name:'Pause game'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='paused');
  await shot('production-pause-desktop.png');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing');

  await page.waitForTimeout(1400);
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='paused',{timeout:3000});
  const layout=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  assert(layout.scrollWidth<=layout.innerWidth+1,'Production 1080p layout must not overflow horizontally');
  report.viewport1080p=layout;

  assert.deepEqual(errors,[],'Production browser must not raise page errors');
  assert.deepEqual(consoleErrors,[],'Production browser must not emit unexpected console.error');
  assert.deepEqual(sameOriginFailures,[],'Production same-origin assets must not return HTTP errors');
  report.consoleErrors=consoleErrors;
  fs.writeFileSync('checks/production-browser-report.json',JSON.stringify(report,null,2));
  console.log('PASS production public browser: version, visual readiness, no mutable QA hook, menu, guide, picker, countdown, gameplay, input, pause and 1080p');
}finally{
  await browser.close();
}
