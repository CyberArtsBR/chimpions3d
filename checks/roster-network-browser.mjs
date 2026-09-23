import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {BUILT_IN_CHIMPION_NAMES} from '../src/roster.js';

const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
const allowed=new Set(BUILT_IN_CHIMPION_NAMES);

function makeTracker(page){
  const characterRequests=[];
  page.on('request',request=>{
    const url=request.url();
    if(url.includes('/model/characters/')&&/\.glb(?:$|\?)/i.test(url))characterRequests.push({url,method:request.method()});
  });
  return characterRequests;
}
function requestName(item){
  const pathname=decodeURIComponent(new URL(item.url).pathname);
  return path.basename(pathname,'.glb');
}
function assertAllowed(requests){
  for(const item of requests)assert(allowed.has(requestName(item)),'Deleted/unapproved character requested: '+item.url);
}
function requestBytes(requests){
  let total=0;
  for(const item of requests){
    const file=path.join('public','model','characters',requestName(item)+'.glb');
    if(fs.existsSync(file))total+=fs.statSync(file).size;
  }
  return total;
}

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={jump:{},dash:{},allowlist:BUILT_IN_CHIMPION_NAMES};
const localModel=fs.readFileSync('public/model/chimpion.glb');

try{
  const jump=await browser.newPage({viewport:{width:1280,height:800}});
  const jumpRequests=makeTracker(jump);
  await jump.goto(base+'/?test=1',{waitUntil:'domcontentloaded'});
  await jump.waitForFunction(()=>window.chimpJump?.().ready);
  report.jump.beforeSelection={requests:jumpRequests.length,bytes:requestBytes(jumpRequests)};
  assert(jumpRequests.length<=1,'Jump fresh load must not eagerly fetch multiple roster GLBs');
  assertAllowed(jumpRequests);

  await jump.getByRole('button',{name:'Choose chimp',exact:true}).click();
  await jump.locator('#collection-dialog').waitFor({state:'visible'});
  await jump.getByRole('searchbox',{name:'Search characters'}).waitFor({state:'visible'});
  await jump.waitForFunction(()=>document.querySelectorAll('#collection-dialog .avatar-option').length===10);
  assert.equal(await jump.locator('#collection-dialog .avatar-option').count(),10,'Jump selector must expose exactly 10 built-ins');
  assert.equal(await jump.locator('#collection-dialog .avatar-upload-option').count(),1,'Jump selector must expose local GLB upload');
  const openedCount=jumpRequests.length;
  report.jump.afterSelectorOpen={requests:openedCount,bytes:requestBytes(jumpRequests)};
  assert.equal(openedCount,report.jump.beforeSelection.requests,'Opening Jump selector must not fetch character GLBs');

  const initialJumpId=await jump.evaluate(()=>window.chimpJump().selectedId);
  const targetJump=initialJumpId==='12'?{id:'95',name:'The Heretic'}:{id:'12',name:'The Archon'};
  await jump.getByRole('button',{name:targetJump.name,exact:true}).click();
  await jump.locator('#confirm-chimpion').click();
  await jump.waitForFunction(id=>window.chimpJump().selectedId===id,targetJump.id);
  report.jump.afterBuiltInSelection={requests:jumpRequests.length,bytes:requestBytes(jumpRequests),selected:targetJump.name};
  assert(jumpRequests.length<=openedCount+1,'Selecting one Jump built-in must fetch at most one additional character GLB');
  assertAllowed(jumpRequests);

  const jumpBeforeLocal=jumpRequests.length;
  await jump.locator('#avatar-file').setInputFiles({name:'local-jump.glb',mimeType:'model/gltf-binary',buffer:localModel});
  await jump.waitForFunction(()=>window.chimpJump().selectedId==='local-custom'&&window.chimpJump().ready);
  report.jump.localUpload={characterRequestsAdded:jumpRequests.length-jumpBeforeLocal,serverUploadRequests:0};
  assert.equal(jumpRequests.length,jumpBeforeLocal,'Local Jump GLB must not request a server-side character model');
  await jump.close();

  const dash=await browser.newPage({viewport:{width:1280,height:800}});
  await dash.addInitScript(()=>{
    localStorage.setItem('chimpions-lab-avatar','69');
    const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
    window.__dashTestPad=pad;
  });
  const dashRequests=makeTracker(dash);
  await dash.goto(base+'/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await dash.waitForFunction(()=>window.chimpionsDash?.().ready&&window.chimpionsDash().rosterCount===10);
  assert.equal(await dash.evaluate(()=>window.chimpionsDash().selectedId),'12','Removed saved Dash avatar ID must migrate to The Archon');
  assert.equal(await dash.evaluate(()=>localStorage.getItem('chimpions-lab-avatar')),'12','Migrated Dash avatar ID must be saved');
  assert.deepEqual(await dash.locator('#lab-avatar option').allTextContents(),BUILT_IN_CHIMPION_NAMES,'Dash native selector must contain the canonical 10');
  report.dash.beforeSelection={requests:dashRequests.length,bytes:requestBytes(dashRequests)};
  assert(dashRequests.length<=1,'Dash fresh load must not eagerly fetch multiple roster GLBs');
  assertAllowed(dashRequests);

  await dash.locator('.dash-start-hotspot').click();
  await dash.locator('#dash-character-picker').waitFor({state:'visible'});
  await dash.waitForFunction(()=>document.querySelectorAll('#dash-character-picker .picker-option').length===10);
  assert.equal(await dash.locator('#dash-character-picker .picker-option').count(),10,'Dash picker must expose exactly 10 built-ins');
  assert.equal(await dash.locator('#dash-character-picker .picker-upload').count(),1,'Dash picker must expose local GLB upload');
  const dashOpened=dashRequests.length;
  report.dash.afterSelectorOpen={requests:dashOpened,bytes:requestBytes(dashRequests)};
  assert.equal(dashOpened,report.dash.beforeSelection.requests,'Opening Dash picker must not fetch character GLBs');

  await dash.getByRole('button',{name:'The Heretic',exact:true}).click();
  await dash.locator('.picker-play').click();
  await dash.waitForFunction(()=>window.chimpionsDash().state==='running'&&window.chimpionsDash().selectedId==='95');
  report.dash.afterBuiltInSelection={requests:dashRequests.length,bytes:requestBytes(dashRequests),selected:'The Heretic'};
  assert(dashRequests.length<=dashOpened+1,'Selecting one Dash built-in must fetch at most one additional character GLB');
  assertAllowed(dashRequests);

  await dash.evaluate(()=>{window.__dashTestPad.buttons[0].pressed=true;});
  await dash.waitForFunction(()=>window.chimpionsDash().y>0,{timeout:2500});
  await dash.evaluate(()=>{window.__dashTestPad.buttons[0].pressed=false;});
  await dash.waitForFunction(()=>window.chimpionsDash().grounded,{timeout:3500});
  await dash.keyboard.down('ArrowDown');
  await dash.waitForFunction(()=>window.chimpionsDash().sliding,{timeout:1000});
  await dash.keyboard.up('ArrowDown');

  await dash.locator('#dash-pause').click();
  await dash.waitForFunction(()=>window.chimpionsDash().state==='paused');
  await dash.locator('#dash-resume').click();
  await dash.waitForFunction(()=>window.chimpionsDash().state==='running');
  await dash.evaluate(()=>window.chimpionsDashTest.finishRun());
  await dash.waitForFunction(()=>window.chimpionsDash().state==='over');
  await dash.locator('#dash-retry').click();
  await dash.waitForFunction(()=>window.chimpionsDash().state==='running');

  await dash.evaluate(()=>window.chimpionsDashTest.quit());
  await dash.waitForFunction(()=>window.chimpionsDash().state==='menu');
  const dashBeforeLocal=dashRequests.length;
  await dash.locator('#dash-avatar-file').setInputFiles({name:'local-dash.glb',mimeType:'model/gltf-binary',buffer:localModel});
  await dash.waitForFunction(()=>window.chimpionsDash().selectedId==='local-custom'&&window.chimpionsDash().localAvatar&&window.chimpionsDash().ready);
  report.dash.localUpload={characterRequestsAdded:dashRequests.length-dashBeforeLocal,serverUploadRequests:0};
  assert.equal(dashRequests.length,dashBeforeLocal,'Local Dash GLB must not request a server-side character model');

  await dash.evaluate(()=>window.chimpionsDashTest.quit());
  await dash.locator('#dash-avatar-file').setInputFiles({name:'broken.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('broken')});
  await dash.waitForFunction(()=>document.getElementById('lab-message').textContent.includes('not a complete'));
  assert((await dash.evaluate(()=>window.chimpionsDash())).ready,'Invalid Dash GLB must preserve the previous valid avatar');
  assertAllowed(dashRequests);

  report.jump.totalCharacterRequests=report.jump.afterBuiltInSelection.requests;
  report.jump.totalCharacterBytes=report.jump.afterBuiltInSelection.bytes;
  report.dash.totalCharacterRequests=report.dash.afterBuiltInSelection.requests;
  report.dash.totalCharacterBytes=report.dash.afterBuiltInSelection.bytes;
  fs.writeFileSync('checks/roster-network-report.json',JSON.stringify(report,null,2));
  console.log('ROSTER_NETWORK_REPORT:'+JSON.stringify(report));
  console.log('PASS roster/network: Jump + Dash use exactly 10 built-ins, lazy-load one selected model, migrate stale IDs, and keep local GLBs off the network.');
}finally{
  await browser.close();
}
