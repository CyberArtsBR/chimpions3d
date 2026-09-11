import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => console.log('BROWSER', msg.type(), msg.text()));
try {
  for (let attempt = 0; ; attempt++) {
    try { await page.goto('http://127.0.0.1:4173'); break; }
    catch (e) { if (attempt === 20) throw e; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  await page.waitForFunction(() => window.rigSandbox?.().ready, { timeout: 30000 });
  const snap = () => page.evaluate(() => window.rigSandbox());
  let s = await snap();
  console.log('INITIAL RIG', JSON.stringify(s));
  assert(s.visible && s.armsDown && s.boneCount > 0);
  assert.equal(s.state, 'IDLE');
  assert.equal(Object.keys(s.mapping).length, 19, 'Actual rig should map all 19 slots');
  await page.screenshot({path:'checks/idle.png'});
  await page.getByRole('button', {name:'Walk',exact:true}).click();
  await page.waitForFunction(() => window.rigSandbox().state === 'WALK');
  await page.waitForTimeout(350);
  assert((await snap()).armsDown);
  await page.screenshot({path:'checks/walk.png'});
  await page.getByRole('button', {name:'Run',exact:true}).click();
  await page.waitForFunction(() => window.rigSandbox().state === 'RUN');
  await page.waitForTimeout(350);
  await page.screenshot({path:'checks/run.png'});
  await page.getByRole('button', {name:'Jump',exact:true}).click();
  await page.waitForFunction(() => !window.rigSandbox().grounded);
  assert((await snap()).position[1] > 0);
  await page.screenshot({path:'checks/jump.png'});
  await page.waitForFunction(() => window.rigSandbox().state === 'LAND');
  await page.waitForFunction(() => window.rigSandbox().state === 'RUN');
  assert((await snap()).grounded);
  await page.getByLabel('Show Skeleton').check();
  await page.screenshot({path:'checks/skeleton.png'});
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.rigSandbox().position[2] > 0.2);
  await page.keyboard.up('w');
  assert((await snap()).position[2] > 0.1);
  await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
  await page.keyboard.down('a'); await page.waitForTimeout(250); await page.keyboard.up('a');
  await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.rigSandbox().state === 'RUN');
  await page.keyboard.up('Shift'); await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.rigSandbox().state === 'IDLE');
  assert.deepEqual(errors, []);
  console.log('PASS: production model loads, complete mapping, lowered idle arms, all states, jump/land, controls, skeleton.');
} finally {
  await page.screenshot({path:'checks/final.png'});
  for (const name of ['idle','walk','run','jump','skeleton']) {
    if (fs.existsSync('checks/' + name + '.png')) console.log(name.toUpperCase() + '_IMAGE_BASE64:' + fs.readFileSync('checks/' + name + '.png').toString('base64'));
  }
  await browser.close();
}
