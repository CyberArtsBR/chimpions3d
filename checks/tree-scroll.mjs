import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
fs.mkdirSync('checks/tree-scroll',{recursive:true});
try{
 await page.route('**/__tree-test.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0" data-mode="playing"></body>'}));
 await page.goto(base+'/__tree-test.html');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createScenery,computeTreeScroll,wrap01}=await import('/src/scenery.js');
  const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});
  renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
  const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);camera.position.set(0,5,20);
  const scenery=createScenery(scene,renderer),palette=new THREE.Color(0xffffff);
  const draw=y=>{camera.position.y=y;scenery.update(y,0,0,palette,0);renderer.render(scene,camera);return {...scenery.treeScrollDiagnostics,offset:scenery.treeClimbOffset};};
  const resize=(w,h)=>{renderer.setSize(w,h);const vh=20*h/w;camera.top=vh/2;camera.bottom=-vh/2;camera.updateProjectionMatrix();scenery.resize(20,vh);};
  window.fixture={scene,renderer,camera,scenery,draw,resize,computeTreeScroll,wrap01};
  scenery.setQuality(true);scenery.prepareRuntimeAssets();resize(innerWidth,innerHeight);draw(5);
 });
 await page.waitForFunction(()=>fixture.scenery.backgroundReady);
 const results=await page.evaluate(()=>{
  const {scenery,draw,resize,renderer,computeTreeScroll,wrap01}=fixture;
  const out={math:[100,1000,10000,100000,1e12].map(y=>computeTreeScroll(y,5,14)),negativeWrap:wrap01(-2.3)};
  scenery.reset();out.start=draw(5);out.climb=draw(100);
  out.large=[1000,10000,100000,1e12].map(draw);
  scenery.reset();draw(5);out.beforeResize=draw(200);resize(390,844);out.afterResize=draw(200);
  out.beforeReduced=out.afterResize;document.body.dataset.reducedMotion='true';out.afterReduced=draw(200);out.reducedClimb=draw(210);
  scenery.setQuality(false);out.balanced=draw(210);scenery.setQuality(true);out.high=draw(210);
  scenery.setQuality({highScenery:true},{constrained:true});out.mobile=draw(210);scenery.setQuality(true);
  scenery.reset();out.reset=draw(5);out.memoryBefore={...renderer.info.memory};
  for(let i=0;i<1200;i++)draw(5+i*100);
  out.memoryAfter={...renderer.info.memory};out.final=draw(100000);
  return out;
 });
 assert.equal(results.start.offset,0);assert(results.climb.offset>0);
 for(const item of results.large){assert(Number.isFinite(item.offset));assert(item.treeScrollNormalized>=0&&item.treeScrollNormalized<1);assert.equal(item.treeMeshY,item.treeCameraY);}
 assert(Math.abs(results.beforeResize.treeScrollNormalized-results.afterResize.treeScrollNormalized)<1e-9);
 assert(Math.abs(results.beforeReduced.treeScrollNormalized-results.afterReduced.treeScrollNormalized)<1e-9);
 assert.equal(results.afterReduced.treeScrollSpeedFactor,.25);
 assert(!results.balanced.treeAuthoredVisible);assert(results.high.treeAuthoredVisible);assert(!results.mobile.treeAuthoredVisible);
 assert.equal(results.reset.offset,0);assert.equal(results.reset.treeScrollNormalized,0);
 assert.deepEqual(results.memoryBefore,results.memoryAfter);assert(results.final.treeWrapEnabled);
 // Verify signed motion by matching a screen patch before/after a small climb.
 const direction=await page.evaluate(()=>{
  const {scenery,draw,resize,renderer}=fixture;resize(1440,900);document.body.dataset.reducedMotion='false';scenery.reset();draw(5);
  const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const before=new Uint8Array(w*h*4),after=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,before);
  draw(5+.4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,after);
  let best={error:Infinity,shift:0};
  for(let shift=-20;shift<=20;shift++){let error=0;for(let y=200;y<700;y+=3)for(let x=500;x<900;x+=3){const a=(y*w+x)*4,b=((y+shift)*w+x)*4;for(let c=0;c<3;c++)error+=Math.abs(before[a+c]-after[b+c]);}if(error<best.error)best={error,shift};}
  return best;
 });
 assert(direction.shift<0,'Climbing must move bark downward (negative WebGL pixel Y)');
 results.direction=direction;
 results.wrapContinuity=await page.evaluate(()=>{
  const {scenery,draw,resize,renderer,scene}=fixture;resize(1440,900);scenery.reset();draw(5);
  let map;scene.traverse(o=>{if(o.material?.map?.wrapT===1000)map=o.material.map;});
  const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const a=new Uint8Array(w*h*4),b=new Uint8Array(w*h*4);
  const cycle=12.5/(.32*map.repeat.y);
  draw(5+cycle-.00001);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);
  draw(5+cycle+.00001);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
  let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length;
 });
 assert(results.wrapContinuity<.1,'No visible frame jump across the normalized wrap');
 for(const [name,w,h] of [['desktop',1440,900],['portrait',390,844],['landscape',844,390],['tablet',768,1024],['ultrawide',2560,1080]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(({w,h})=>{fixture.resize(w,h);fixture.draw(500);},{w,h});
  await page.screenshot({path:`checks/tree-scroll/${name}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const {resize,scenery,draw,scene}=fixture;resize(390,844);scenery.reset();draw(5);let map;scene.traverse(o=>{if(o.material?.map?.wrapT===1000)map=o.material.map;});draw(5+.5*(20*844/390)/(.32*map.repeat.y));});
 await page.screenshot({path:'checks/tree-scroll/overlap-portrait.png'});
 assert.deepEqual(errors,[]);
 fs.writeFileSync('checks/tree-scroll/report.json',JSON.stringify({status:'PASS',results,errors},null,2));
 console.log('PASS: scroll, downward motion, wrap, huge heights, reset, resize, reduced motion, quality, five viewports, stable GPU resources');
}finally{await browser.close();}
