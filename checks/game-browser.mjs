import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.addInitScript(()=>{
  const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  window.__chimpTestPad=pad;
});
const errors=[];
const report={scope:'desktop-browser',viewport:{width:1440,height:900},checkpoints:{},renderStats:{}};

page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')console.log('[browser console]',message.text());});

async function screenshot(name){
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await page.evaluate(()=>window.chimpJumpTest.render());
  await page.screenshot({path:'checks/'+name,timeout:90000});
}

async function snapshot(label){
  const state=await page.evaluate(()=>window.chimpJump());
  report.checkpoints[label]=state;
  return state;
}

try{
  await page.goto(base+'/?test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpJump?.().ready);
  assert((await page.evaluate(()=>window.chimpJump())).visible);
  assert.equal(await page.evaluate(()=>window.chimpJump().selectedId),'steamboat-willie','Steamboat Willie must load as the default player');
  assert.equal(await page.evaluate(()=>window.chimpJump().bones),19,'Default Willie rig must expose the full 19-bone gameplay skeleton');
  assert.equal(await page.evaluate(()=>window.chimpJump().characterScale),1.3);
  assert.equal((await page.evaluate(()=>window.chimpJump())).quality,'high');

  await page.waitForFunction(()=>window.chimpJump().platformReady&&window.chimpJump().backgroundReady);
  assert.equal(await page.evaluate(()=>window.chimpJump().cameraZoom),1,'Menu camera must retain the full-route view');
  assert(await page.getByRole('button',{name:'Field guide',exact:true}).isVisible(),'Field guide must be visible on desktop');
  assert.equal(await page.locator('#audio-settings').isVisible(),false,'Title screen must hide Audio settings');
  assert.equal(await page.locator('#background-style').isVisible(),false,'Title screen must hide Scenery settings');

  await screenshot('game-menu-desktop.png');
  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  await page.getByLabel('Reduced motion').check();
  assert.equal(await page.evaluate(()=>document.body.dataset.reducedMotion),'true');
  await page.getByLabel('Reduced motion').uncheck();
  await page.getByLabel('High-visibility HUD').check();
  assert.equal(await page.evaluate(()=>document.body.dataset.highVisibility),'true');
  await page.getByLabel('High-visibility HUD').uncheck();
  await screenshot('game-guide-desktop.png');
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();

  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  assert(await page.locator('#selected-chimpion-meta').isVisible(),'Desktop picker must expose selected Chimpion metadata');
  await screenshot('game-picker-desktop.png');
  const pickerLayout=await page.locator('.selection-actions').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
  assert(pickerLayout.split(' ').length>=3,'Desktop picker must use the expanded preview/info/play layout');
  const picker=await page.evaluate(()=>{
    const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
    return {preview:box('selected-preview'),copy:box('selected-chimpion'),play:box('confirm-chimpion'),random:box('random-chimpion')};
  });
  assert(picker.preview.right<=picker.copy.x&&picker.copy.right<=picker.play.x,'Preview, description and play action must occupy separate columns');
  assert(picker.play.bottom<=picker.random.y,'Random must sit below the play action');
  assert(await page.locator('.avatar-option .avatar-portrait').first().isVisible(),'A portrait or initials must reserve a visible card preview');
  const selectable=page.locator('.avatar-option:not(:disabled)');
  await selectable.first().focus();
  const firstLabel=await selectable.first().innerText();
  await page.evaluate(()=>{window.__chimpTestPad.axes[1]=1;});
  await page.waitForTimeout(120);
  await page.evaluate(()=>{window.__chimpTestPad.axes[1]=0;});
  await page.waitForTimeout(100);
  const focusedLabel=await page.evaluate(()=>document.activeElement?.innerText||'');
  const fifthLabel=await selectable.nth(4).innerText();
  assert.notEqual(firstLabel,fifthLabel,'Desktop picker fixture must contain at least five distinct choices');
  assert.equal(focusedLabel,fifthLabel,'Gamepad down must move one four-column desktop row');
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>window.chimpJump().mode==='starting');
  await page.evaluate(()=>window.chimpJumpTest.render());
  const countdownState=await page.evaluate(()=>window.chimpJump());
  assert.equal(countdownState.countdown,3,'Fresh run must open with a 3-to-0 countdown');
  assert.equal(countdownState.time,0,'Physics must stay frozen during the countdown');
  assert(countdownState.cameraZoom>1.8,'Countdown must focus the camera on the Chimpion');
  assert(await page.locator('#countdown').isVisible(),'Countdown must be visible before the run starts');
  await screenshot('game-countdown-desktop.png');
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  const playing=await snapshot('fresh-run');
  assert(playing.visibleBranches>=4,'Generated branches must attach when gameplay begins');
  assert(playing.authoredBranches>0,'Authored branch assets must render during gameplay');
  assert.equal(playing.cameraZoom,1,'Gameplay camera must settle to the complete route view');
  assert(Array.isArray(playing.platformTypes)&&playing.platformTypes.includes('solid'),'Expansion telemetry must expose live platform types');
  assert(!('wind' in playing));
  assert.equal(await page.locator('#wind').count(),0,'Removed wind HUD must not remain');
  assert.equal(typeof playing.hazardCount,'number');
  assert(playing.musicPlaybackRate>=.98&&playing.musicPlaybackRate<=1.06,'Reactive music rate stays subtle');

  // Deterministic visual fixture: render every new branch family plus one thorn pod in-frame.
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    const base=id=>({id,x:0,baseX:0,y:0,width:2.05,type:'solid',coin:true,route:'reward',reward:2,fragile:false,broken:false,phase:.5,moveSpeed:1,moveRange:0,vanishAt:null});
    g.platforms.push(
      {...base(9501),id:9501,x:-4.4,baseX:-4.4,y:2.4,type:'leaf',moveRange:1.05},
      {...base(9502),id:9502,x:0,baseX:0,y:5.0,type:'vanish'},
      {...base(9503),id:9503,x:4.2,baseX:4.2,y:7.4,type:'swing',moveRange:1.35}
    );
    g.hazards=[{id:9501,type:'thorn-pod',x:2.0,baseX:2.0,y:2.9,radius:.42,range:.24,speed:.9,phase:.2}];
  });
  await screenshot('game-canopy-mechanics-desktop.png');
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();g.platforms=g.platforms.filter(p=>p.id<9500);g.hazards=[];
    window.chimpJumpTest.render();
  });

  await page.keyboard.down('ArrowLeft');
  await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
  assert(await page.evaluate(()=>window.chimpJump().yaw<-.6),'Left key must turn the character');
  await page.keyboard.up('ArrowLeft');

  await page.keyboard.down('ArrowRight');
  await page.mouse.move(120,430);
  await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
  assert(await page.evaluate(()=>window.chimpJump().yaw>.6),'Right key must turn the character');
  assert(await page.evaluate(()=>window.chimpJump().vx>0),'Mouse movement must not release or override a held keyboard direction');
  await page.keyboard.up('ArrowRight');

  // Timed canopy events must surface in the desktop HUD without changing the core safe-route physics.
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();g.time=44.99;g.event=null;g.eventIndex=0;g.nextEventAt=45;g.nextJetAt=Infinity;
    window.chimpJumpTest.step(2);
  });
  assert(['banana-bloom','spring-fever'].includes(await page.evaluate(()=>window.chimpJump().event)));
  assert(await page.locator('#canopy-event').isVisible(),'Canopy event badge must be visible during an active event');
  await screenshot('game-canopy-event-desktop.png');
  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.time=0;g.event=null;g.eventIndex=0;g.nextEventAt=45;g.nextJetAt=30;});

  await screenshot('game-playing-desktop.png');
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForFunction(()=>window.chimpJump().mode==='paused');
  assert.equal(await page.evaluate(()=>window.chimpJump().mode),'paused','Desktop resize must safely auto-pause an active run');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  report.viewport1080p=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  await screenshot('game-playing-desktop-1080p.png');

  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>window.chimpJump().mode==='paused');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  await page.getByRole('button',{name:'Pause game'}).click();
  const pausedAt=await page.evaluate(()=>window.chimpJump().time);
  await page.evaluate(()=>window.chimpJumpTest.step(60));
  assert.equal(await page.evaluate(()=>window.chimpJump().time),pausedAt,'Pause must freeze game time');
  await screenshot('game-pause-desktop.png');
  await page.getByRole('button',{name:'KEEP CLIMBING'}).click();

  // Long-session desktop pacing check using a deterministic safe bounce fixture.
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=100;g.hazards=[];
    g.platforms=[{id:9000,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  });
  const paceSamples=[];
  for(const seconds of [30,60,90,120]){
    await page.evaluate(()=>window.chimpJumpTest.step(1800));
    const state=await page.evaluate(()=>window.chimpJump());
    paceSamples.push({seconds,pace:state.pace,theme:state.theme,drawCalls:state.drawCalls,triangles:state.triangles});
  }
  report.paceSamples=paceSamples;
  for(let i=1;i<paceSamples.length;i++)assert(paceSamples[i].pace>=paceSamples[i-1].pace,'Pace must not regress over a long run');
  assert(Math.abs(paceSamples.at(-1).pace-(.92+2.08*120/300))<.001,'Long-session fixture must reach the full simulated 120 seconds');
  await screenshot('game-long-run-desktop.png');

  const failedSeed=await page.evaluate(()=>window.chimpJump().runSeed);
  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  assert.equal(await page.evaluate(()=>window.chimpJump().mode),'over');
  await screenshot('game-results-desktop.png');

  await page.getByRole('button',{name:'Replay this trail',exact:true}).click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  assert.equal(await page.evaluate(()=>window.chimpJump().runSeed),failedSeed,'Practice replay must reproduce the same route seed');
  assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Jungle Morning');

  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.getByRole('button',{name:'Try Again'}).click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  // Local GLB validation stays fully inside the desktop browser.
  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.locator('#choose-again').click();
  await page.keyboard.press('Escape');
  const modelBytes=fs.readFileSync('public/model/chimpion.glb');
  let external=0;
  page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external++;});
  await page.locator('#avatar-file').setInputFiles({name:'my-chimp.glb',mimeType:'model/gltf-binary',buffer:modelBytes});
  await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('local file')&&window.chimpJump().ready);
  assert((await page.evaluate(()=>window.chimpJump())).visible);
  assert.equal(await page.evaluate(()=>window.chimpJump().characterScale),1.3);

  await page.locator('#avatar-file').setInputFiles({name:'broken.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('broken')});
  await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('not a complete'));
  assert((await page.evaluate(()=>window.chimpJump())).ready,'Invalid upload must preserve avatar');

  const jsonLength=modelBytes.readUInt32LE(12);
  const json=JSON.parse(modelBytes.subarray(20,20+jsonLength).toString());
  for(const node of json.nodes)if(node.name&&/arm/i.test(node.name))node.name='unmapped_'+node.name.replace(/arm/ig,'limb');
  const encoded=Buffer.from(JSON.stringify(json));
  const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);
  encoded.copy(padded);
  const altered=Buffer.concat([modelBytes.subarray(0,12),Buffer.alloc(8),padded,modelBytes.subarray(20+jsonLength)]);
  altered.writeUInt32LE(altered.length,8);
  altered.writeUInt32LE(padded.length,12);
  altered.writeUInt32LE(0x4e4f534a,16);
  await page.locator('#avatar-file').setInputFiles({name:'unsupported-rig.glb',mimeType:'model/gltf-binary',buffer:altered});
  await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('previous avatar'));
  assert((await page.evaluate(()=>window.chimpJump())).visible);
  assert.equal(external,0,'Local avatar must not trigger external requests');

  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  // Performance/stability: repeated desktop restarts must not leak renderer resources.
  await page.waitForTimeout(100);
  const before=await page.evaluate(()=>{window.chimpJumpTest.render();return window.chimpJump();});
  for(let i=0;i<12;i++){
    await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
    await page.waitForFunction(()=>window.chimpJump().mode==='over'&&document.getElementById('results-dialog')?.open);
    // Real pointer activation is already covered above. The stress loop exercises restart/resource cleanup,
    // so dispatch the same button handler directly instead of waiting on modal paint stability 12 times.
    await page.evaluate(()=>document.getElementById('try-again').click());
    await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  }
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>{window.chimpJumpTest.render();return window.chimpJump();});
  report.renderStats={before,after};
  assert(after.geometries<=before.geometries+3,'Geometry count must remain bounded after repeated desktop restarts');
  assert(after.textures<=before.textures+1,'Texture count must remain bounded after repeated desktop restarts');

  // Catalog search remains functional after the stress cycle.
  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.route('https://cdn.helius-rpc.com/**',route=>route.abort());
  await page.locator('#choose-again').click();
  await page.getByRole('searchbox',{name:'Search characters'}).fill('The Aviator');
  assert(await page.getByRole('button',{name:'The Aviator · GLB coming soon',exact:true}).isDisabled());
  assert.equal(await page.locator('.avatar-option').count(),1);
  await page.getByRole('searchbox',{name:'Search characters'}).fill('Silver Chimp');
  await page.getByRole('button',{name:'Silver Chimp',exact:true}).click();
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));if((await page.evaluate(()=>window.chimpJump().mode))==='starting')await page.evaluate(()=>window.chimpJumpTest.finishCountdown());await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  await page.waitForFunction(()=>window.chimpJump().ready);
  assert(await page.locator('#avatar-list').isHidden());

  await snapshot('final');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('checks/game-browser-report.json',JSON.stringify(report,null,2));
  console.log('RENDER_STATS:'+JSON.stringify(after));
  console.log('PASS desktop browser: onboarding, field guide, full-route camera, keyboard/mouse independence, pause, 120s pacing, replay seed, local GLB validation, 1080p layout and bounded renderer resources');
}finally{
  try{await screenshot('game-final-desktop.png');}catch{}
  await browser.close();
}
