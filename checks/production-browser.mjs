import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const base=(process.env.CHIMP_PRODUCTION_URL||'https://chimp-jump.onrender.com').replace(/\/$/,'');
const url=base+'/?test=1';
const origin=new URL(base).origin;
const expectedCommit=process.env.CHIMP_EXPECTED_COMMIT||'';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],sameOriginFailures=[];
const report={scope:'production-desktop-browser',url,viewport:{width:1440,height:900},checkpoints:{},sameOriginFailures};

page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)sameOriginFailures.push({url:response.url(),status:response.status()});});

async function waitForDeployment(){
  const deadline=Date.now()+10*60*1000;
  let last='';
  while(Date.now()<deadline){
    try{
      const stamp=Date.now();
      const versionResponse=await page.request.get(base+'/version.json?audit='+stamp);
      if(!versionResponse.ok())throw new Error('Waiting for deployed version manifest');
      const version=await versionResponse.json();
      if(!/^[a-f0-9]{40}$/.test(version.commit||''))throw new Error('Invalid deployed revision');
      if(expectedCommit&&version.commit!==expectedCommit)throw new Error('Waiting for '+expectedCommit+'; live revision is '+version.commit);
      report.version=version;
      const liveUrl=base+'/?test=1&revision='+encodeURIComponent(version.commit)+'&audit='+stamp;
      await page.goto(liveUrl,{waitUntil:'domcontentloaded',timeout:45000});
      const remaining=Math.max(1000,Math.min(45000,deadline-Date.now()));
      await page.waitForFunction(()=>window.chimpJump?.().ready&&document.querySelector('#jump-guide-button')&&document.body?.dataset?.mode==='menu',null,{timeout:remaining});
      const state=await page.evaluate(()=>({
        ready:!!window.chimpJump?.().ready,
        fieldGuide:!!document.querySelector('#jump-guide-button'),
        mode:document.body?.dataset?.mode||''
      }));
      report.liveUrl=liveUrl;
      return state;
    }catch(error){last=error.message;}
    if(Date.now()<deadline)await page.waitForTimeout(15000);
  }
  throw new Error('Timed out waiting for Render deployment. Last state: '+last);
}

async function shot(name){await page.screenshot({path:'checks/'+name,fullPage:false,timeout:90000});}
async function snap(name){const state=await page.evaluate(()=>window.chimpJump());report.checkpoints[name]=state;return state;}

try{
  report.deployment=await waitForDeployment();
  // Ignore transient errors from deployment polling; assertions below apply to the settled revision only.
  errors.length=0;sameOriginFailures.length=0;
  // Match the local browser gate: control frames deterministically so a headless/SwiftShader scheduler stall
  // cannot trigger the game's intentional safety auto-pause and masquerade as a production failure.
  await page.evaluate(()=>window.chimpJumpTest?.suspendRendering());
  await page.evaluate(()=>window.chimpJumpTest?.render());

  const menu=await snap('menu');
  assert.equal(menu.cameraZoom,1,'Production title screen must keep full-route camera state');
  assert.equal(menu.quality,'high','Desktop production should default to high detail');
  assert.equal(await page.getByRole('button',{name:'Field guide',exact:true}).isVisible(),true);
  assert.equal(await page.locator('#audio-settings').isVisible(),false);
  assert.equal(await page.locator('#background-style').isVisible(),false);
  await shot('production-menu-desktop.png');

  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  assert.equal(await page.locator('#jump-guide-dialog[open]').isVisible(),true);
  assert.equal(await page.locator('#jump-goals li').count(),6,'Production Field Guide must expose six expedition goals');
  await shot('production-guide-desktop.png');
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();

  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  assert(await page.locator('#selected-chimpion-meta').isVisible(),'Expanded picker must be deployed');
  await shot('production-picker-desktop.png');
  await page.evaluate(()=>window.chimpJumpTest.resumeRendering());
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:30000});
  await page.waitForFunction(()=>window.chimpJump?.().countdown===3,{timeout:5000});
  await page.waitForFunction(()=>window.chimpJump?.().cameraZoom>1.8,{timeout:5000});
  const countdownState=await snap('countdown');
  assert(countdownState.cameraZoom>1.8,'Production countdown must zoom in on the Chimpion');
  assert.equal(countdownState.time,0,'Production physics must remain frozen during countdown');
  await shot('production-countdown-desktop.png');
  await page.evaluate(()=>window.chimpJumpTest.resumeRendering());
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',{timeout:10000});
  await page.waitForFunction(()=>window.chimpJump?.().cameraZoom<1.05,{timeout:5000});
  await page.evaluate(()=>{window.chimpJumpTest.suspendRendering();window.chimpJumpTest.render();});
  const playing=await snap('playing');
  assert(playing.visible,'Production avatar must be visible');
  assert(playing.platformReady&&playing.backgroundReady,'Production authored scenery must be ready');
  assert(playing.visibleBranches>=4,'Production route branches must attach');
  assert.equal(playing.cameraZoom,1,'Fresh production run must start at full-route zoom');
  assert(Array.isArray(playing.platformTypes)&&typeof playing.wind==='number','Canopy gameplay expansion must be deployed');
  await shot('production-playing-desktop.png');

  await page.keyboard.down('ArrowLeft');
  await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
  assert(await page.evaluate(()=>window.chimpJump().yaw<-.6),'Production keyboard steering must turn left');
  await page.keyboard.up('ArrowLeft');

  await page.getByRole('button',{name:'Pause game'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='paused');
  await shot('production-pause-desktop.png');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing');
  await page.evaluate(()=>window.chimpJumpTest.render());

  await page.setViewportSize({width:1920,height:1080});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='paused');
  const layout=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  report.viewport1080p=layout;
  assert.equal(layout.scrollWidth,1920,'Production 1080p layout must not overflow horizontally');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing');
  await page.evaluate(()=>window.chimpJumpTest.render());
  await shot('production-playing-desktop-1080p.png');

  await snap('final');
  assert.deepEqual(errors,[],'Production browser must not raise page errors');
  assert.deepEqual(sameOriginFailures,[],'Production same-origin assets must not return HTTP errors');
  fs.writeFileSync('checks/production-browser-report.json',JSON.stringify(report,null,2));
  console.log('PASS production desktop browser: deployment, menu, Field Guide, gameplay, keyboard, pause and 1080p layout');
}finally{
  await browser.close();
}
