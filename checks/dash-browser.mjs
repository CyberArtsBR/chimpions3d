import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,assertNoOverflow,writeReport,shot} from './dash-test-utils.mjs';

const {browser,page,pageErrors,consoleErrors}=await openBrowserPage({viewport:{width:1920,height:1080},gamepad:true});
const report={scope:'dash-browser',viewports:{},inputs:{},picker:{},quality:{}};
try{
  const boot=await waitForDash(page);assert.equal(boot.rosterCount,10);assert(boot.ready);assert.equal(new URL(page.url()).searchParams.get('dash'),'1');
  assert(await page.getByRole('button',{name:'Start Game'}).isVisible());assert(await page.getByRole('button',{name:'Back to the game selection'}).isVisible());
  report.viewports['1920x1080']=await assertNoOverflow(page,'1920x1080');await shot(page,'dash-menu-desktop.png');

  const start=page.getByRole('button',{name:'Start Game'});await start.focus();await page.keyboard.press('Enter');assert(await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');
  await start.focus();await page.keyboard.press('Space');assert(await page.getByRole('dialog').isVisible());await page.getByRole('button',{name:'Close character selection'}).click();
  await start.click();const dialog=page.getByRole('dialog');assert(await dialog.isVisible());await shot(page,'dash-picker-desktop.png');

  const search=page.getByRole('searchbox',{name:'Search characters'});await search.fill('Street');assert((await page.locator('.picker-option').count())>=1);await search.fill('');
  const options=page.locator('.picker-option');assert.equal(await options.count(),10);await options.nth(1).click();assert((await page.locator('.picker-current p').innerText()).length>0);
  const beforeRandom=await page.locator('.picker-current p').innerText();await page.getByRole('button',{name:'Random Chimpion'}).click();const afterRandom=await page.locator('.picker-current p').innerText();report.picker={beforeRandom,afterRandom,count:await options.count()};
  await page.getByRole('button',{name:/Play with selected Chimpion/}).click();await page.waitForFunction(()=>window.chimpionsDash().state==='running');await page.evaluate(()=>window.chimpionsDashTest.clearWorld());
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'),false,'start must release hidden button focus');await shot(page,'dash-gameplay-desktop.png');

  for(const code of ['Space','KeyW','ArrowUp']){await page.keyboard.down(code);await page.waitForTimeout(30);assert((await page.evaluate(()=>window.chimpionsDash().vy))>0,code+' must jump');await page.keyboard.up(code);await page.evaluate(()=>window.chimpionsDashTest.reset('key-'+Math.random(),0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());}
  for(const code of ['ArrowDown','KeyS','ShiftLeft']){await page.keyboard.down(code);await page.waitForTimeout(30);assert(await page.evaluate(()=>window.chimpionsDash().sliding),code+' must slide');await page.keyboard.up(code);await page.evaluate(()=>window.chimpionsDashTest.reset('slide-'+Math.random(),0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());}
  report.inputs.keyboard='pass';

  await page.mouse.move(500,500);await page.mouse.down({button:'left'});await page.waitForTimeout(30);assert((await page.evaluate(()=>window.chimpionsDash().vy))>0);await page.mouse.up({button:'left'});
  await page.evaluate(()=>window.chimpionsDashTest.reset('mouse-slide',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());await page.mouse.down({button:'right'});await page.waitForTimeout(30);assert(await page.evaluate(()=>window.chimpionsDash().sliding));await page.mouse.up({button:'right'});report.inputs.mouse='pass';

  await page.evaluate(()=>window.chimpionsDashTest.reset('pad',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());
  await page.evaluate(()=>window.__dashTestPad.buttons[0].pressed=true);await page.waitForTimeout(50);assert((await page.evaluate(()=>window.chimpionsDash().vy))>0);await page.evaluate(()=>window.__dashTestPad.buttons[0].pressed=false);
  await page.evaluate(()=>window.chimpionsDashTest.reset('pad-slide',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());await page.evaluate(()=>window.__dashTestPad.axes[1]=.9);await page.waitForTimeout(50);assert(await page.evaluate(()=>window.chimpionsDash().sliding));await page.evaluate(()=>window.__dashTestPad.axes[1]=0);report.inputs.gamepad='pass';

  await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.chimpionsDash().state==='paused');await shot(page,'dash-pause-desktop.png');await page.getByRole('button',{name:'RESUME'}).click();await page.waitForFunction(()=>window.chimpionsDash().state==='running');assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'),false,'resume must release button focus');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>window.chimpionsDash().state==='paused');await page.getByRole('button',{name:'RESUME'}).click();

  await page.evaluate(()=>window.chimpionsDashTest.finishRun());await page.waitForFunction(()=>window.chimpionsDash().state==='over');await shot(page,'dash-results-desktop.png');await page.getByRole('button',{name:'RUN AGAIN'}).click();await page.waitForFunction(()=>window.chimpionsDash().state==='running');
  await page.evaluate(()=>window.chimpionsDashTest.finishRun());await page.getByRole('button',{name:'Change Chimpion'}).click();await page.waitForFunction(()=>window.chimpionsDash().state==='menu');

  const selectedBefore=await page.evaluate(()=>window.chimpionsDash().selectedId);await page.setInputFiles('#dash-avatar-file',{name:'invalid.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('not a glb')});await page.waitForFunction(()=>document.querySelector('#lab-message').textContent.includes('Could not load'));assert.equal(await page.evaluate(()=>window.chimpionsDash().selectedId),selectedBefore,'invalid GLB must preserve previous avatar');
  await page.setInputFiles('#dash-avatar-file','public/model/chimpion.glb');await page.waitForFunction(()=>window.chimpionsDash().localAvatar===true,{timeout:90000});report.picker.localGlb='pass';

  for(const [w,h] of [[2560,1440],[1366,768],[1024,768]]){await page.setViewportSize({width:w,height:h});report.viewports[`${w}x${h}`]=await assertNoOverflow(page,`${w}x${h}`);}
  report.quality.available=await page.evaluate(()=>!!window.chimpionsDashQuality||!!document.querySelector('[data-quality],[name*=quality i]'));report.quality.note=report.quality.available?'quality UI detected; tier invariance belongs to performance branch contract':'LOW/BALANCED/HIGH/ULTRA/AUTO are not implemented on current main';

  const unnamed=await page.locator('button:visible').evaluateAll(btns=>btns.filter(b=>!(b.getAttribute('aria-label')||b.textContent.trim())).length);assert.equal(unnamed,0,'visible buttons need accessible names');
  assert.deepEqual(pageErrors,[]);report.consoleErrors=consoleErrors;
  writeReport('dash-browser-report.json',report);console.log('PASS dash desktop E2E: boot, picker, keyboard/mouse/gamepad, pause/restart, GLB fallback, responsive');
}finally{await browser.close();}
