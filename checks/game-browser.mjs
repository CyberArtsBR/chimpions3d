import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
try{
 await page.goto('http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready);
 assert((await page.evaluate(()=>window.chimpJump())).visible);
 assert.equal((await page.evaluate(()=>window.chimpJump())).quality,'high');
 assert((await page.evaluate(()=>window.chimpJump())).visibleBranches>=4,'Generated branches must be attached to the rendered scene');
 await page.waitForFunction(()=>window.chimpJump().platformReady&&window.chimpJump().backgroundReady);
 assert((await page.evaluate(()=>window.chimpJump())).authoredBranches>=4);
 await page.screenshot({path:'checks/game-menu.png'});
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>window.chimpJump().yaw< -1.5);
 await page.keyboard.up('ArrowLeft');
 const left=await page.evaluate(()=>window.chimpJump());assert(left.x<0);
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>window.chimpJump().yaw>1.5);
 await page.keyboard.up('ArrowRight');
 await page.screenshot({path:'checks/game-playing.png'});
 await page.getByRole('button',{name:'Pause game'}).click();
 const time=await page.evaluate(()=>window.chimpJump().time);
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.chimpJump().time),time);
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 // Keep a stationary, safe bounce fixture to inspect active-time theme changes.
 await page.evaluate(()=>{
  const g=window.chimpJumpTest.game();g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=100;
  g.platforms=[{id:9000,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  window.chimpJumpTest.step(1801);
 });
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Emerald Mist');
 await page.screenshot({path:'checks/game-theme.png'});
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
 assert.equal(await page.evaluate(()=>window.chimpJump().mode),'over');
 await page.getByRole('button',{name:'JUMP AGAIN'}).click();
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Jungle Morning');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 await page.getByRole('button',{name:'Move right',exact:true}).click();
 await page.screenshot({path:'checks/game-mobile.png'});

 // Upload the actual GLB through the file input; its bytes must stay local.
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
 const modelBytes=fs.readFileSync('public/model/chimpion.glb');
 let external=0;page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external++;});
 await page.locator('#avatar-file').setInputFiles({name:'my-chimp.glb',mimeType:'model/gltf-binary',buffer:modelBytes});
 await page.waitForFunction(()=>document.getElementById('avatar-status').textContent.includes('local file')&&window.chimpJump().ready);
 assert((await page.evaluate(()=>window.chimpJump())).visible);
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
 assert.equal(external,0,'Local avatar must not trigger external requests');
 await page.getByRole('button',{name:'Flip avatar facing'}).click();
 assert(await page.getByRole('button',{name:/Detail:/}).isDisabled());
 const quality=await page.evaluate(()=>window.chimpJump().quality);assert.equal(quality,'balanced');
 assert.equal(await page.evaluate(()=>window.chimpJump().authoredBranches),0);
 assert.equal(await page.evaluate(()=>window.chimpJump().backgroundReady),false);
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.getByRole('button',{name:'Pause game'}).click();
 await page.screenshot({path:'checks/game-mobile-menu.png'});
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 // Fixed scene size after repeat restarts: shared resources should not accumulate.
 await page.waitForTimeout(100);
 const before=await page.evaluate(()=>window.chimpJump());
 for(let i=0;i<8;i++){
  await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
  await page.getByRole('button',{name:'JUMP AGAIN'}).click();
 }
 await page.waitForTimeout(100);
 const after=await page.evaluate(()=>window.chimpJump());
 assert(after.geometries<=before.geometries+3,'Geometry count must remain bounded');
 assert(after.textures<=before.textures+1,'Texture count must remain bounded');
 // Catalog search uses original names; only supplied GLBs can be selected.
 await page.getByRole('button',{name:'Pause game'}).click();
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
 await page.route('https://cdn.helius-rpc.com/**',route=>route.abort());
 await page.getByRole('button',{name:'Choose chimp',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search characters'}).fill('The Aviator');
 assert(await page.getByRole('button',{name:'The Aviator · GLB coming soon',exact:true}).isDisabled());
 assert.equal(await page.locator('.avatar-option').count(),1);
 await page.getByRole('searchbox',{name:'Search characters'}).fill('Silver Chimp');
 await page.getByRole('button',{name:'Silver Chimp',exact:true}).click();
 await page.waitForFunction(()=>window.chimpJump().ready);
 assert(await page.locator('#avatar-list').isHidden());
 console.log('RENDER_STATS:'+JSON.stringify(after));
 assert.deepEqual(errors,[]);

 console.log('PASS game: actual GLB, turns, movement, pause, themes, retry, mobile, local upload, invalid files/rigs, detail switch, bounded resources');
}finally{
 await page.screenshot({path:'checks/game-final.png'});
 for(const name of ['game-menu','game-playing','game-theme','game-mobile','game-mobile-menu'])if(fs.existsSync('checks/'+name+'.png'))console.log(name.toUpperCase()+'_IMAGE_BASE64:'+fs.readFileSync('checks/'+name+'.png').toString('base64'));
 await browser.close();
}
