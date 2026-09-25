import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,assertNoHorizontalOverflow,writeReport} from './qa-browser-utils.mjs';

const requested=process.env.CHIMP_BROWSER||'firefox';
const {name,browser}=await launchBrowser(requested);
const page=await browser.newPage({viewport:{width:1280,height:800}});
const diag=attachPageDiagnostics(page);
try{
  await gotoJump(page,{test:false});
  await assertNoHorizontalOverflow(page,name+' menu');
  assert(await page.getByRole('button',{name:'LET’S JUMP',exact:true}).isVisible());
  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  assert(await page.locator('#jump-guide-dialog[open]').isVisible());
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  assert(await page.locator('#collection-dialog[open]').isVisible());
  assert.equal(await page.locator('#collection-dialog .avatar-option').count(),10);
  assert.deepEqual(diag.errors,[]);
  assert.deepEqual(diag.sameOriginFailures,[]);
  writeReport(`checks/cross-browser-${name}-report.json`,{status:'PASS',browser:name,errors:diag.errors,sameOriginFailures:diag.sameOriginFailures});
  console.log('PASS '+name+' core smoke');
}finally{await browser.close();}
