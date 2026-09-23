import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const report=[];
try{
 await page.goto('http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready&&window.chimpJump().platformReady);
 await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
 const entries=JSON.parse(fs.readFileSync('public/avatars.json','utf8')).filter(e=>e.url);
 for(const entry of entries.slice(0,Number(process.env.CHIMP_TEST_AVATAR_LIMIT)||entries.length)){
  await page.evaluate(id=>window.chimpJumpTest.selectAvatar(id),entry.id);
  await page.evaluate(()=>window.chimpJumpTest.render());
  const state=await page.evaluate(()=>window.chimpJump());
  assert(state.ready&&state.visible&&state.selectedId===entry.id,entry.name+': '+await page.locator('#avatar-status').textContent());
  assert(state.bones>=19,entry.name+' skeleton');
  report.push({name:entry.name,id:entry.id,bones:state.bones});
 }
 // Exercise the visible drawer, canonical roster, upload action and keyboard focus.
 await page.route('https://cdn.helius-rpc.com/**',r=>r.abort());
 await page.getByRole('button',{name:'Choose chimp',exact:true}).click();
 assert.equal(await page.locator('#collection-dialog .avatar-option').count(),10,'Selector must expose exactly 10 built-in Chimpions');
 assert.equal(await page.locator('#collection-dialog .avatar-upload-option').count(),1,'Selector must expose one local GLB action');
 await page.getByRole('searchbox',{name:'Search characters'}).fill('The Ordained');
 assert.equal(await page.locator('#collection-dialog .avatar-option').count(),0,'Removed Chimpions must not reappear through characters.json');
 await page.keyboard.press('Escape');
 await page.locator('#collection-dialog').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.activeElement===document.getElementById('choose'));
 // Desktop detail switch uses fallback, then reuses existing loaded geometry.
 await page.getByRole('button',{name:/Detail:/}).click();
 assert.equal(await page.evaluate(()=>window.chimpJump().quality),'balanced');
 assert.equal(await page.evaluate(()=>window.chimpJump().authoredBranches),0);
 await page.getByRole('button',{name:/Detail:/}).click();
 assert.equal(await page.evaluate(()=>window.chimpJump().quality),'high');
 await page.evaluate(()=>window.chimpJumpTest.render());
 assert((await page.evaluate(()=>window.chimpJump())).authoredBranches>0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('checks/collection-report.json',JSON.stringify(report,null,2));
 console.log('PASS collection: '+report.length+' approved avatars loaded and rendered; 10-character selector, local upload action, focus and quality controls verified.');
}finally{await browser.close();}
