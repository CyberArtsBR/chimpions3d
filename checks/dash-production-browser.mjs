import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,assertNoOverflow,writeReport,shot,productionBase,externalDashFailure} from './dash-test-utils.mjs';

const {browser,page,pageErrors,requestFailures}=await openBrowserPage({viewport:{width:1920,height:1080}});
const report={scope:'dash-production',url:productionBase,viewports:{},requests:[]};
try{
  const boot=await waitForDash(page,{test:false,url:productionBase});
  assert.equal(boot.rosterCount,10);
  assert(await page.getByRole('button',{name:'Start Game'}).isVisible());
  report.viewports.desktop=await assertNoOverflow(page,'production desktop');
  await shot(page,'production-dash-menu-desktop.png');

  await page.getByRole('button',{name:'Start Game'}).click();
  assert(await page.getByRole('dialog').isVisible());
  await shot(page,'production-dash-picker-desktop.png');
  await page.getByRole('button',{name:/Play with selected Chimpion/}).click();
  await page.waitForFunction(()=>window.chimpionsDash().state==='running',{timeout:90000});
  await page.keyboard.down('Space');await page.waitForTimeout(60);
  assert((await page.evaluate(()=>window.chimpionsDash().vy))>0,'production keyboard jump must work immediately after picker');
  await page.keyboard.up('Space');
  await shot(page,'production-dash-gameplay-desktop.png');

  await page.getByRole('button',{name:'Pause'}).click();
  await page.waitForFunction(()=>window.chimpionsDash().state==='paused');
  await page.getByRole('button',{name:'RESUME'}).click();
  await page.waitForFunction(()=>window.chimpionsDash().state==='running');

  await page.setViewportSize({width:390,height:844});
  report.viewports.mobile=await assertNoOverflow(page,'production mobile');
  assert(await page.locator('#touch-jump').isVisible());
  await shot(page,'production-dash-mobile.png');

  report.requests=requestFailures;
  const critical=requestFailures.filter(r=>new URL(r.url).origin===new URL(productionBase).origin||externalDashFailure(r));
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(critical,[],'production critical requests must not fail');
  writeReport('dash-production-browser-report.json',report);
  console.log('PASS Dash production audit: title, picker, gameplay, input, pause, desktop/mobile, HTTP/page errors');
}finally{await browser.close();}
