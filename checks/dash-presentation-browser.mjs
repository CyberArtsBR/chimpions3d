import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const targets=[
  ['1920x1080',1920,1080],
  ['1600x900',1600,900],
  ['1440x900',1440,900],
  ['1366x768',1366,768],
  ['tablet',1024,768],
  ['mobile-portrait',390,844],
  ['mobile-large',430,932],
  ['mobile-landscape',844,390],
  ['ultrawide',2560,1080]
];

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));

try{
  for(const [name,width,height] of targets){
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:4173/?dash=1&test=1',{waitUntil:'domcontentloaded'});
    const start=page.getByRole('button',{name:'START DASH',exact:true});
    const back=page.getByRole('button',{name:'Back to game selection'});
    await start.waitFor({state:'visible'});

    for(const control of [start,back]){
      const box=await control.boundingBox();
      assert(box,`${name}: control has no layout box`);
      assert(box.x>=-1&&box.y>=-1,`${name}: control starts outside viewport`);
      assert(box.x+box.width<=width+1,`${name}: control overflows viewport width`);
      assert(box.y+box.height<=height+1,`${name}: control overflows viewport height`);
      const style=await control.evaluate(el=>({opacity:getComputedStyle(el).opacity,color:getComputedStyle(el).color,pointer:getComputedStyle(el).pointerEvents}));
      assert.equal(style.opacity,'1',`${name}: entry control must not be transparent`);
      assert.notEqual(style.pointer,'none',`${name}: entry control must be interactive`);
    }

    await start.click();
    const dialog=page.getByRole('dialog',{name:'Choose your Chimpion'});
    await dialog.waitFor({state:'visible'});
    await page.getByRole('searchbox').waitFor({state:'visible'});
    await page.getByRole('button',{name:'RANDOM'}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'UPLOAD GLB'}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Close character selection'}).click();
  }

  await page.setViewportSize({width:1366,height:768});
  await page.goto('http://127.0.0.1:4173/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.chimpionsDashPresentationApi);
  await page.evaluate(()=>window.chimpionsDashPresentationApi.openSettings());
  const settings=page.getByRole('dialog',{name:'SETTINGS'});
  await settings.waitFor({state:'visible'});
  for(const label of ['QUALITY','MASTER','MUSIC','SFX','UI','AMBIENCE','MUTE','REDUCED MOTION','HIGH VISIBILITY','SCREEN SHAKE','HAPTICS / VIBRATION','LARGE TOUCH CONTROLS']){
    assert(await settings.getByText(label,{exact:true}).count(),`Missing settings label: ${label}`);
  }
  await page.keyboard.press('Escape');

  await page.evaluate(()=>window.chimpionsDashPresentationApi.setInputDevice('gamepad'));
  assert.match(await page.locator('#dash-input-prompt').textContent(),/A \/ D-PAD/);
  await page.evaluate(()=>window.chimpionsDashPresentationApi.setInputDevice('touch'));
  assert.equal(await page.locator('body').getAttribute('data-input-device'),'touch');

  assert.deepEqual(errors,[]);
  console.log('PASS dash presentation browser matrix');
}finally{
  await browser.close();
}
