import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const viewports=[
  {width:390,height:844},
  {width:430,height:932},
  {width:768,height:1024},
  {width:1024,height:768},
  {width:1440,height:900},
  {width:1920,height:1080},
  {width:2560,height:1440}
];

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={viewports:[],deepChecks:{}};

async function menuCheck(viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/?play=jump&test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.uiReady==='true'&&document.body.dataset.menuReady==='true',{timeout:30000});

  const state=await page.evaluate(()=>{
    const play=document.getElementById('play')?.getBoundingClientRect();
    const tools=[...document.querySelectorAll('#jump-menu-tools button')].map(node=>node.getBoundingClientRect()).map(box=>({left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height}));
    return {
      uiReady:document.body.dataset.uiReady,
      menuReady:document.body.dataset.menuReady,
      mode:document.body.dataset.mode,
      play:play?{left:play.left,right:play.right,top:play.top,bottom:play.bottom,width:play.width,height:play.height}:null,
      tools,
      liveHud:[...document.querySelectorAll('#hud [aria-live]')].length,
      normalizedHook:typeof window.chimpJumpUX?.handleAction==='function'
    };
  });
  assert.equal(state.uiReady,'true');
  assert.equal(state.menuReady,'true');
  assert.equal(state.mode,'menu');
  assert(state.play&&state.play.width>=44&&state.play.height>=44,'Play control must remain a practical touch target');
  assert(state.play.right>0&&state.play.left<viewport.width&&state.play.bottom>0&&state.play.top<viewport.height,'Play control must intersect the viewport');
  assert.equal(state.liveHud,0,'Rapid HUD values must not be aria-live regions');
  assert.equal(state.normalizedHook,true,'Normalized UI action hook must be available');
  for(const tool of state.tools){
    assert(tool.height>=44,'Menu tools must be at least 44px high');
    assert(tool.left>=-1&&tool.right<=viewport.width+1,'Menu tools must stay inside the viewport');
  }

  const slug=`${viewport.width}x${viewport.height}`;
  await page.screenshot({path:`checks/premium-ux-menu-${slug}.png`,fullPage:false});
  report.viewports.push({viewport,...state,errors});
  assert.deepEqual(errors,[]);
  return {page,context};
}

try{
  let deepSession=null;
  for(const viewport of viewports){
    const session=await menuCheck(viewport);
    if(viewport.width===1440)deepSession=session;
    else await session.context.close();
  }

  assert(deepSession,'Desktop deep-check page was not created');
  const {page,context}=deepSession;

  await page.getByRole('button',{name:'Field Guide'}).click();
  const guide=page.locator('#jump-guide-dialog');
  await guide.waitFor({state:'visible'});
  assert.equal(await guide.getAttribute('aria-labelledby'),'jump-guide-title');
  for(const heading of ['Movement','Platforms','Hazards','Power-ups','Events','Scoring','Goals','Controls']){
    assert.equal(await guide.getByRole('heading',{name:heading}).count(),1,`Missing Field Guide category: ${heading}`);
  }
  await guide.getByRole('button',{name:'Close Field Guide'}).click();

  await page.getByRole('button',{name:'Options'}).click();
  const options=page.locator('#jump-settings-dialog');
  await options.waitFor({state:'visible'});
  assert.equal(await options.getAttribute('aria-labelledby'),'jump-settings-title');
  await page.locator('#jump-high-visibility').check();
  assert.equal(await page.locator('body').getAttribute('data-high-visibility'),'true');
  await page.locator('#jump-reduced-motion').check();
  assert.equal(await page.locator('body').getAttribute('data-reduced-motion'),'true');
  await page.locator('#jump-high-visibility').uncheck();
  await page.locator('#jump-reduced-motion').uncheck();
  await options.getByRole('button',{name:'Close Options'}).click();

  await page.waitForFunction(()=>window.chimpJump?.().ready,{timeout:30000});
  await page.locator('#play').click();
  const picker=page.locator('#collection-dialog');
  await picker.waitFor({state:'visible'});
  assert.equal(await picker.getAttribute('aria-label'),'Choose your chimp');
  assert.equal(await picker.getByRole('searchbox',{name:'Search characters'}).count(),1);
  const choices=picker.locator('.avatar-option:not([disabled])');
  assert(await choices.count()>1,'Character picker should expose more than one playable choice');
  await choices.first().focus();
  const firstName=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));
  await page.keyboard.press('ArrowRight');
  const secondName=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));
  assert.notEqual(secondName,firstName,'Arrow-key grid navigation should move character focus');
  await page.keyboard.press('Escape');
  await picker.waitFor({state:'hidden'});

  await page.evaluate(()=>document.body.dataset.mode='paused');
  const pause=page.locator('#jump-pause-actions');
  await pause.waitFor({state:'visible'});
  for(const label of ['Resume','Restart Run','Field Guide','Quit / Home']){
    assert.equal(await pause.getByRole('button',{name:label}).count(),1,`Missing pause action: ${label}`);
  }
  report.deepChecks={
    guideCategories:8,
    settings:true,
    characterPickerKeyboard:true,
    pauseActions:true,
    normalizedActionHook:true
  };
  await context.close();

  fs.writeFileSync('checks/premium-ux-browser-report.json',JSON.stringify(report,null,2));
  console.log('PREMIUM_UX_BROWSER_REPORT:'+JSON.stringify(report));
  console.log('PASS premium UX: readiness, responsive menu, dialogs, accessibility preferences, picker navigation and pause actions');
}finally{
  await browser.close();
}
