import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
// Explicit simulation steps keep slow software-rendered CI frames from pausing input tests.
async function screenshot(options){
 await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
 await page.evaluate(()=>window.chimpJumpTest.render());
 await page.screenshot(options);
}
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
try{
 await page.goto('http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready);
 assert((await page.evaluate(()=>window.chimpJump())).visible);
 assert.equal(await page.evaluate(()=>window.chimpJump().characterScale),1.3);
 assert.equal((await page.evaluate(()=>window.chimpJump())).quality,'high');
 await page.waitForFunction(()=>window.chimpJump().platformReady&&window.chimpJump().backgroundReady);
 assert.equal(await page.evaluate(()=>window.chimpJump().cameraZoom),1,'Menu camera must retain the full-route view');
 await page.getByRole('button',{name:'Field guide',exact:true}).click();
 await page.getByLabel('Reduced motion').check();
 assert.equal(await page.evaluate(()=>document.body.dataset.reducedMotion),'true');
 await page.getByLabel('Reduced motion').uncheck();
 await page.getByRole('button',{name:'Close field guide',exact:true}).click();
 await screenshot({path:'checks/game-menu.png'});
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.locator('#confirm-chimpion').click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 await page.evaluate(()=>window.chimpJumpTest.render());
 assert((await page.evaluate(()=>window.chimpJump())).visibleBranches>=4,'Generated branches must attach when gameplay begins');
 assert((await page.evaluate(()=>window.chimpJump())).authoredBranches>0,'Authored branch assets must render during gameplay');
 await page.keyboard.down('ArrowLeft');
 await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
 assert(await page.evaluate(()=>window.chimpJump().yaw<-.6),'Left key must turn the character');
 await page.keyboard.up('ArrowLeft');
 const left=await page.evaluate(()=>window.chimpJump());assert(left.x<0);
 await page.keyboard.down('ArrowRight');
 await page.mouse.move(80,400);
 await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
 assert(await page.evaluate(()=>window.chimpJump().yaw>.6),'Right key must turn the character');
 assert(await page.evaluate(()=>window.chimpJump().vx>0),'Mouse movement must not release or override a held keyboard direction');
 await page.keyboard.up('ArrowRight');
 assert.equal(await page.evaluate(()=>window.chimpJump().cameraZoom),1,'Fresh gameplay must start with the complete route visible');
 await screenshot({path:'checks/game-playing.png'});
 await page.getByRole('button',{name:'Pause game'}).click();
 const time=await page.evaluate(()=>window.chimpJump().time);
 await page.evaluate(()=>window.chimpJumpTest.step(60));
 assert.equal(await page.evaluate(()=>window.chimpJump().time),time);
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 // Keep a stationary, safe bounce fixture to inspect active-time theme changes.
 await page.evaluate(()=>{
  const g=window.chimpJumpTest.game();g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=100;
  g.platforms=[{id:9000,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  window.chimpJumpTest.step(1801);
 });
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Emerald Mist');
 await screenshot({path:'checks/game-theme.png'});
 const failedSeed=await page.evaluate(()=>window.chimpJump().runSeed);
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
 assert.equal(await page.evaluate(()=>window.chimpJump().mode),'over');
 await page.getByRole('button',{name:'Replay this trail',exact:true}).click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 assert.equal(await page.evaluate(()=>window.chimpJump().runSeed),failedSeed,'Practice replay must reproduce the same route seed');
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Jungle Morning');
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
 await page.getByRole('button',{name:'Try Again'}).click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 await page.getByRole('button',{name:'Move right',exact:true}).click();
 await screenshot({path:'checks/game-mobile.png'});

 // Upload the actual GLB through the file input; its bytes must stay local.
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
 await page.locator('#choose-again').click();
 await page.keyboard.press('Escape');
 const modelBytes=fs.readFileSync('public/model/chimpion.glb');
 let external=0;page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external++;});
 await page.locator('#avatar-file').setInputFiles({name:'my-chimp.glb',mimeType:'model/gltf-binary',buffer:modelBytes});
 await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('local file')&&window.chimpJump().ready);
 assert((await page.evaluate(()=>window.chimpJump())).visible);
 assert.equal(await page.evaluate(()=>window.chimpJump().characterScale),1.3);
 await page.locator('#avatar-file').setInputFiles({name:'broken.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('broken')});
 await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('not a complete'));
 assert((await page.evaluate(()=>window.chimpJump())).ready,'Invalid upload must preserve avatar');
 // Valid GLB container, deliberately unresolvable arm mapping: never reveal it.
 const jsonLength=modelBytes.readUInt32LE(12);
 const json=JSON.parse(modelBytes.subarray(20,20+jsonLength).toString());
 for(const node of json.nodes)if(node.name&&/arm/i.test(node.name))node.name='unmapped_'+node.name.replace(/arm/ig,'limb');
 const encoded=Buffer.from(JSON.stringify(json));const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
 const altered=Buffer.concat([modelBytes.subarray(0,12),Buffer.alloc(8),padded,modelBytes.subarray(20+jsonLength)]);
 altered.writeUInt32LE(altered.length,8);altered.writeUInt32LE(padded.length,12);altered.writeUInt32LE(0x4e4f534a,16);
 await page.locator('#avatar-file').setInputFiles({name:'unsupported-rig.glb',mimeType:'model/gltf-binary',buffer:altered});
 await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('previous avatar'));
 assert((await page.evaluate(()=>window.chimpJump())).visible);
 assert.equal(await page.evaluate(()=>window.chimpJump().characterScale),1.3);
 assert.equal(external,0,'Local avatar must not trigger external requests');
 assert(await page.getByRole('button',{name:/Detail:/}).isDisabled());
 const quality=await page.evaluate(()=>window.chimpJump().quality);assert.equal(quality,'balanced');
 assert.equal(await page.evaluate(()=>window.chimpJump().authoredBranches),0);
 assert.equal(await page.evaluate(()=>window.chimpJump().backgroundReady),false);
 assert.equal(await page.evaluate(()=>window.chimpJump().treeVisible),false,'Balanced/Low keeps only the background layers');
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.locator('#confirm-chimpion').click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 await page.getByRole('button',{name:'Pause game'}).click();
 await screenshot({path:'checks/game-mobile-menu.png'});
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 // Fixed scene size after repeat restarts: shared resources should not accumulate.
 await page.waitForTimeout(100);
 const before=await page.evaluate(()=>{window.chimpJumpTest.render();return window.chimpJump();});
 for(let i=0;i<8;i++){
  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.getByRole('button',{name:'Try Again'}).click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 }
 await page.waitForTimeout(100);
 const after=await page.evaluate(()=>{window.chimpJumpTest.render();return window.chimpJump();});
 assert(after.geometries<=before.geometries+3,'Geometry count must remain bounded');
 assert(after.textures<=before.textures+1,'Texture count must remain bounded');
 // Catalog search uses original names; only supplied GLBs can be selected.
 await page.getByRole('button',{name:'Pause game'}).click();
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
 await page.route('https://cdn.helius-rpc.com/**',route=>route.abort());
 await page.locator('#choose-again').click();
 await page.getByRole('searchbox',{name:'Search characters'}).fill('The Aviator');
 assert(await page.getByRole('button',{name:'The Aviator · GLB coming soon',exact:true}).isDisabled());
 assert.equal(await page.locator('.avatar-option').count(),1);
 await page.getByRole('searchbox',{name:'Search characters'}).fill('Silver Chimp');
 await page.getByRole('button',{name:'Silver Chimp',exact:true}).click();
 await page.locator('#confirm-chimpion').click();
 await page.waitForFunction(()=>window.chimpJump().mode==='playing');
 await page.waitForFunction(()=>window.chimpJump().ready);
 assert(await page.locator('#avatar-list').isHidden());
 console.log('RENDER_STATS:'+JSON.stringify(after));
 assert.deepEqual(errors,[]);

 console.log('PASS game: actual GLB, field guide, full-route camera, independent keyboard/mouse input, turns, pause, themes, retry, mobile, local upload, invalid files/rigs, detail switch, bounded resources');
}finally{
 await screenshot({path:'checks/game-final.png'});
 await browser.close();
}
