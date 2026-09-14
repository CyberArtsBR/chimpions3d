import * as THREE from 'three';
import {createLabRunnerCharacter} from './labRunnerCharacter.js';
import './chimpionsLab.css';

const BASE=import.meta.env.BASE_URL;
const OLD='https://chimpions-dash.stephaniem-rehfeld.chatgpt.site/assets/';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
document.body.dataset.mode='lab';
document.body.innerHTML=`
<main id="dash-stage" aria-label="Chimpions Lab - Chimpion Dash">
  <div id="dash-sky"></div><div id="dash-far"></div><div id="dash-mid"></div><div id="dash-light"></div>
  <div id="dash-objects"></div><div id="dash-ground"></div><div id="dash-shadow"></div><div id="lab-3d"></div>
  <header id="dash-hud">
    <div class="brand"><small>CHIMPIONS LAB</small><strong>CHIMPION DASH</strong></div>
    <div><small>SCORE</small><strong id="dash-score">000000</strong></div>
    <div><small>DISTANCE</small><strong id="dash-distance">0.00 KM</strong></div>
    <div><small>BEST</small><strong id="dash-best">000000</strong></div>
    <button id="dash-pause" aria-label="Pause">Ⅱ</button>
  </header>
  <div id="dash-stage-label">01 / THE EMERALD WILDS</div>
  <div id="dash-flow">🍌 <b id="dash-bananas">0</b><span>FLOW <b id="dash-mult">1.00×</b></span></div>
  <div id="dash-tip">SPACE / W / ↑ JUMP&nbsp;&nbsp; · &nbsp;&nbsp;↓ / SHIFT / S / A SLIDE</div>
  <section id="dash-menu" class="dash-panel">
    <span class="eyebrow">THE JUNGLE IS CALLING</span>
    <h1>CHIMPIONS <em>LAB</em></h1>
    <h2>CHIMPION DASH · 2.5D</h2>
    <p>This version uses the lateral runner logic and visual language of the original Chimpions Dash, with your rigged 3D Chimpion as the runner.</p>
    <label>YOUR RUNNING MATE<select id="lab-avatar" aria-label="Choose Chimpion"></select></label>
    <div id="lab-message" role="status">Loading Chimpion…</div>
    <div class="dash-menu-actions"><button id="dash-start" class="primary" disabled>▶ PLAY</button><button id="dash-random">Random Chimpion</button><a href="./">Back to Chimp Jump</a></div>
    <p class="controls"><kbd>SPACE</kbd>/<kbd>W</kbd>/<kbd>↑</kbd> jump · <kbd>↓</kbd>/<kbd>SHIFT</kbd>/<kbd>S</kbd>/<kbd>A</kbd> slide · <kbd>P</kbd> pause</p>
  </section>
  <section id="dash-over" class="dash-panel modal" hidden><span class="eyebrow">RUN COMPLETE</span><h2>THE JUNGLE WON THIS ROUND</h2><p id="dash-result"></p><div class="dash-menu-actions"><button id="dash-retry" class="primary">RUN AGAIN</button><button id="dash-change">Change Chimpion</button><a href="./">Back to Chimp Jump</a></div></section>
  <section id="dash-paused" class="dash-panel modal" hidden><span class="eyebrow">TAKE A BREATHER</span><h2>PAUSED</h2><div class="dash-menu-actions"><button id="dash-resume" class="primary">RESUME</button><button id="dash-quit">MAIN MENU</button></div></section>
  <div id="dash-touch"><button id="touch-slide">⇣<small>SLIDE</small></button><button id="touch-jump">↥<small>JUMP</small></button></div>
  <div id="dash-stage-flash"></div>
</main>`;

// Transparent Three.js layer: only the actual rigged GLB lives here. The scenery and
// hazards stay in fast 2D layers, producing the requested lateral 2.5D presentation.
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,6,-6,.01,40);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('lab-3d').append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe9f6df,0x31402c,2.2));const key=new THREE.DirectionalLight(0xffe5aa,3);key.position.set(-4,8,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-3;scene.add(key,key.target);
let viewH=12.5,viewW=12.5,runnerWorldX=-3,groundWorldY=-4;
function resize3D(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,w<760?1.25:1.6));viewW=viewH*w/h;camera.left=-viewW/2;camera.right=viewW/2;camera.top=viewH/2;camera.bottom=-viewH/2;camera.updateProjectionMatrix();camera.position.set(0,.1,12);camera.lookAt(0,.1,0);runnerWorldX=-viewW*.28;groundWorldY=-viewH*.32;
}
resize3D();addEventListener('resize',resize3D);

const BIOMES=[['THE EMERALD WILDS','#73c897','#174e3d'],['CANOPY RUN','#5bb98d','#123e34'],['WATERFALL GORGE','#83cbd3','#24556a'],['LOST TEMPLE','#d6b978','#4c553c'],['MOONLIT JUNGLE','#797ac7','#161f4e'],['STORM FOREST','#708799','#172b37'],['VOLCANIC WILDS','#e98a58','#49262d'],['CHIMPION DREAMSCAPE','#d78bd0','#293066']];
const TYPES=[
 {id:'log',family:'short',action:'jump',w:64,h:38,boxes:[[9,0,46,28]],minStage:1,difficulty:1},
 {id:'mushroom',family:'short',action:'jump',w:58,h:38,boxes:[[11,0,36,27]],minStage:1,difficulty:1},
 {id:'thorns',family:'short',action:'jump',w:60,h:44,boxes:[[11,1,38,31]],minStage:2,difficulty:2},
 {id:'stump',family:'high',action:'high-jump',w:58,h:98,boxes:[[7,0,44,84]],minStage:2,difficulty:2},
 {id:'spike',family:'high',action:'high-jump',w:55,h:94,boxes:[[8,0,39,76]],minStage:3,difficulty:3},
 {id:'log-pile',family:'wide',action:'high-jump',w:138,h:40,boxes:[[7,0,124,19]],minStage:1,difficulty:2},
 {id:'puddle',family:'wide',action:'high-jump',w:132,h:24,boxes:[[3,0,126,12]],minStage:2,difficulty:2},
 {id:'spike-patch',family:'wide',action:'high-jump',w:148,h:38,boxes:[[5,0,138,22]],minStage:3,difficulty:3},
 {id:'branch',family:'overhead',action:'slide',w:115,h:78,boxes:[[5,52,105,22]],minStage:2,difficulty:2},
 {id:'vine',family:'overhead',action:'slide',w:96,h:82,boxes:[[7,50,82,25]],minStage:3,difficulty:2},
 {id:'canopy',family:'flex',action:'jump-or-slide',w:98,h:74,boxes:[[5,49,88,20]],minStage:4,difficulty:3}
];
const sprite=id=>OLD+'sprites-clean/'+(id==='log-pile'?'log':id)+'.png';
const objectLayer=$('dash-objects');
let catalog=[],character=null,loading=false,currentEntry=null;
async function loadAvatar(entry){
  if(!entry?.url||loading)return;loading=true;$('dash-start').disabled=true;$('lab-avatar').disabled=true;$('lab-message').textContent='Loading '+entry.name+'…';
  try{
    const next=await createLabRunnerCharacter(BASE+entry.url);if(character){scene.remove(character.root);character.dispose();}character=next;currentEntry=entry;scene.add(character.root);character.setFacingRight(true);localStorage.setItem('chimpions-lab-avatar',entry.id);$('lab-message').textContent=entry.name+' · rig validated · '+next.boneCount+' bones';$('dash-start').disabled=false;
  }catch(error){console.error(error);$('lab-message').textContent='Rig rejected safely: '+error.message;}
  finally{loading=false;$('lab-avatar').disabled=false;}
}

const BASE_SPEED=265,MAX_SPEED=535,GRAVITY=2200,JUMP_IMPULSE=600,HOLD_TIME=.22,LOW_HEIGHT=70;
let run=null,state='menu',last=performance.now(),spawnCursor=0,best=Number(localStorage.getItem('chimpions-lab-best-score'))||0,stageFlashTimer=0,lastPadJump=false,lastPadSlide=false;
const keys=new Set(),obstacles=[],bananas=[];
function makeRun(){return{time:0,stage:1,speed:BASE_SPEED,scroll:0,y:0,vy:0,jumpHeld:false,jumpAge:0,slideHeld:false,slideTime:0,grounded:true,dead:false,bananaCount:0,flow:0,maxFlow:0,combo:0,score:0,landed:false};}
function speedFor(stage){const s=Math.max(0,stage-1);return Math.min(MAX_SPEED,BASE_SPEED+s*27+Math.max(0,s-2)*8);}
function multiplier(flow){return flow>=100?5:flow>=80?3:flow>=60?2:flow>=40?1.5:flow>=20?1.25:1;}
function playerX(){return Math.max(115,innerWidth*.22);}
function playerBox(){const sliding=run.y===0&&(run.slideHeld||run.slideTime>0);return{x:playerX()-17,y:run.y+5,w:34,h:sliding?31:78};}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function obstacleBoxes(o){const sx=o.x-run.scroll;return(o.boxes||[[0,0,o.w,o.h]]).map(b=>({x:sx+b[0],y:b[1],w:b[2],h:b[3]}));}
function createObjectElement(kind,id,w,h){
  const el=document.createElement('img');el.className=kind+' '+(id||'');el.alt='';el.draggable=false;el.src=kind==='banana'?sprite(id):sprite(id);el.style.width=w+'px';el.style.height=h+'px';el.onerror=()=>{el.classList.add('sprite-fallback');el.removeAttribute('src');};objectLayer.append(el);return el;
}
function spawnObstacle(type,x){const o={...type,x,passed:false,hit:false,el:createObjectElement('hazard',type.id,type.w,type.h)};obstacles.push(o);return o;}
function spawnBanana(x,y,golden=false){const b={x,y,golden,collected:false,el:createObjectElement('banana',golden?'golden':'banana',golden?38:34,golden?38:34)};bananas.push(b);}
function bananaArc(start,end,apex=105,count=5){for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1),arch=1-Math.pow(t*2-1,2);spawnBanana(start+(end-start)*t,24+arch*(apex-24),false);}}
function lowTrail(start,end,count=5){for(let i=0;i<count;i++)spawnBanana(start+(i+.5)*(end-start)/count,23,false);}
function chooseFamily(family,stage){const list=TYPES.filter(t=>t.family===family&&t.minStage<=stage);return list[Math.floor(Math.random()*list.length)]||TYPES[0];}
function patternFor(stage){
  const options=[['short'],['short'],['wide']];if(stage>=2)options.push(['high'],['overhead']);if(stage>=3)options.push(['short','high'],['overhead','short']);if(stage>=4)options.push(['flex'],['wide','overhead']);if(stage>=5)options.push(['overhead','overhead'],['high','overhead']);return options[Math.floor(Math.random()*options.length)];
}
function spawnPattern(){
  const families=patternFor(run.stage),start=spawnCursor,created=[];let x=start;
  for(let i=0;i<families.length;i++){const type=chooseFamily(families[i],run.stage),o=spawnObstacle(type,x);created.push(o);if(type.action==='slide')lowTrail(x-55,x+type.w+35,5);else bananaArc(x-55,x+type.w+45,type.family==='high'?145:105,type.family==='wide'?6:5);x+=type.w+run.speed*(families.length>1?.88:1.02);}
  const lastO=created.at(-1);spawnCursor=(lastO?.x||x)+(lastO?.w||0)+run.speed*(.95+Math.random()*.5);
}
function seedWorld(){spawnCursor=innerWidth+360;while(spawnCursor<innerWidth*2.3)spawnPattern();}
function clearWorld(){for(const o of obstacles)o.el.remove();for(const b of bananas)b.el.remove();obstacles.length=0;bananas.length=0;objectLayer.textContent='';}
function updateObjects(){
  const groundPx=Math.max(58,innerHeight*.18);
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i],x=o.x-run.scroll;o.el.style.transform=`translate3d(${Math.round(x)}px,0,0)`;o.el.style.bottom=(groundPx+(o.family==='overhead'||o.family==='flex'?50:0))+'px';if(x<-220){o.el.remove();obstacles.splice(i,1);}}
  for(let i=bananas.length-1;i>=0;i--){const b=bananas[i],x=b.x-run.scroll;b.el.style.transform=`translate3d(${Math.round(x)}px,${Math.round(-b.y)}px,0) rotate(${run.time*90%360}deg)`;b.el.style.bottom=groundPx+'px';if(x<-100){b.el.remove();bananas.splice(i,1);}}
  while(spawnCursor-run.scroll<innerWidth+800)spawnPattern();
}
function jump(){if(!run||state!=='running'||!run.grounded)return;run.slideHeld=false;run.slideTime=0;run.vy=JUMP_IMPULSE;run.y=.01;run.grounded=false;run.jumpHeld=true;run.jumpAge=0;}
function releaseJump(){if(!run)return;if(run.jumpHeld&&run.jumpAge<HOLD_TIME&&run.vy>0&&run.y<LOW_HEIGHT)run.vy=Math.min(run.vy,Math.sqrt(Math.max(0,2*GRAVITY*(LOW_HEIGHT-run.y))));run.jumpHeld=false;}
function slide(on){if(!run||state!=='running')return;run.slideHeld=on;if(on&&run.grounded)run.slideTime=Math.max(run.slideTime,.24);}
function setState(next){state=next;document.body.dataset.labState=next;$('dash-menu').hidden=next!=='menu';$('dash-over').hidden=next!=='over';$('dash-paused').hidden=next!=='paused';}
function startRun(){if(!character)return;clearWorld();run=makeRun();seedWorld();setState('running');$('dash-stage-flash').textContent='GO!';stageFlashTimer=1.1;$('dash-tip').classList.add('show');setTimeout(()=>$('dash-tip')?.classList.remove('show'),4500);last=performance.now();}
function finishRun(){if(!run||run.dead)return;run.dead=true;state='over';best=Math.max(best,Math.floor(run.score));localStorage.setItem('chimpions-lab-best-score',best);$('dash-best').textContent=String(best).padStart(6,'0');$('dash-result').textContent=`${Math.floor(run.score)} points · ${(run.scroll/100000).toFixed(2)} km · ${run.bananaCount} bananas · stage ${run.stage}`;setState('over');}
function pause(){if(state!=='running')return;setState('paused');}
function resume(){if(state!=='paused')return;setState('running');last=performance.now();}
function quit(){clearWorld();run=makeRun();setState('menu');}

function updatePhysics(dt){
  if(state!=='running'||!run)return;run.landed=false;run.time+=dt;const stage=Math.floor(run.time/30)+1;if(stage!==run.stage){run.stage=stage;stageFlashTimer=1.8;$('dash-stage-flash').textContent='STAGE '+stage;}
  run.speed=THREE.MathUtils.damp(run.speed,speedFor(run.stage),2.3,dt);run.slideTime=Math.max(0,run.slideTime-dt);
  if(!run.grounded){const gravity=run.jumpHeld&&run.jumpAge<HOLD_TIME&&run.vy>0?0:(run.vy<0?GRAVITY*1.14:GRAVITY);run.jumpAge+=dt;run.y+=run.vy*dt-gravity*dt*dt/2;run.vy-=gravity*dt;if(run.y<=0){run.y=0;run.vy=0;run.grounded=true;run.jumpHeld=false;run.landed=true;}}
  run.scroll+=run.speed*dt;updateObjects();const p=playerBox();
  for(const o of obstacles){const sx=o.x-run.scroll;if(!o.passed&&sx+o.w<playerX()){o.passed=true;run.combo++;run.flow=Math.min(100,run.flow+4);run.maxFlow=Math.max(run.maxFlow,run.flow);}if(o.hit||sx>playerX()+80||sx+o.w<playerX()-80)continue;if(obstacleBoxes(o).some(b=>hit(p,b))){o.hit=true;finishRun();return;}}
  for(const b of bananas){if(b.collected)continue;const x=b.x-run.scroll;if(Math.abs(x-playerX())<31&&Math.abs((run.y+52)-b.y)<55){b.collected=true;b.el.classList.add('collected');run.bananaCount++;run.flow=Math.min(100,run.flow+(b.golden?18:3));setTimeout(()=>b.el.remove(),120);}}
  run.flow=Math.max(0,run.flow-dt*1.5);run.score=run.scroll*.08+run.bananaCount*35+run.combo*12*multiplier(run.flow);
}
function renderUI(dt){
  const active=run||makeRun(),biome=BIOMES[(active.stage-1)%BIOMES.length];document.documentElement.style.setProperty('--biome-top',biome[1]);document.documentElement.style.setProperty('--biome-bottom',biome[2]);
  document.documentElement.style.setProperty('--far-x',`${-(active.scroll*.08)%1200}px`);document.documentElement.style.setProperty('--mid-x',`${-(active.scroll*.18)%1200}px`);document.documentElement.style.setProperty('--ground-x',`${-(active.scroll*.82)%900}px`);
  $('dash-score').textContent=String(Math.floor(active.score)).padStart(6,'0');$('dash-distance').textContent=(active.scroll/100000).toFixed(2)+' KM';$('dash-best').textContent=String(best).padStart(6,'0');$('dash-bananas').textContent=active.bananaCount;$('dash-mult').textContent=multiplier(active.flow).toFixed(2)+'×';$('dash-stage-label').textContent=String(active.stage).padStart(2,'0')+' / '+biome[0];
  if(stageFlashTimer>0){stageFlashTimer-=dt;$('dash-stage-flash').classList.add('show');}else $('dash-stage-flash').classList.remove('show');
  if(character){const jumping=!active.grounded,sliding=active.grounded&&(active.slideHeld||active.slideTime>0),animState=jumping?'JUMP':state==='running'?'RUN':'IDLE';character.update(dt,{state:animState,speed:active.speed/BASE_SPEED,jumpHeight:active.y,vy:active.vy,sliding,landed:active.landed});character.root.position.set(runnerWorldX,groundWorldY+active.y/78,0);const scale=sliding?1:1;character.root.scale.setScalar(scale);}
  const shadow=$('dash-shadow');if(shadow){const jump=active.y;shadow.style.left=playerX()+'px';shadow.style.opacity=String(clamp(1-jump/150,.18,.72));shadow.style.transform=`translateX(-50%) scale(${clamp(1-jump/180,.55,1)})`;}
}

const jumpCodes=new Set(['Space','KeyW','ArrowUp']),slideCodes=new Set(['ArrowDown','ShiftLeft','ShiftRight','KeyS','KeyA']);
addEventListener('keydown',e=>{
  if(jumpCodes.has(e.code)||slideCodes.has(e.code)||e.code==='KeyP'){e.preventDefault();keys.add(e.code);}if(jumpCodes.has(e.code)&&!e.repeat)jump();if(slideCodes.has(e.code))slide(true);if(e.code==='KeyP'&&!e.repeat)(state==='paused'?resume():pause());if(e.code==='Escape'&&state!=='menu')quit();
});
addEventListener('keyup',e=>{keys.delete(e.code);if(jumpCodes.has(e.code))releaseJump();if(slideCodes.has(e.code)&&![...slideCodes].some(code=>keys.has(code)))slide(false);});addEventListener('blur',()=>{keys.clear();releaseJump();slide(false);});
function touchHold(id,start,end){const el=$(id);el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);start();};el.onpointerup=el.onpointercancel=el.onlostpointercapture=e=>{e?.preventDefault?.();end();};}
touchHold('touch-jump',jump,releaseJump);touchHold('touch-slide',()=>slide(true),()=>slide(false));
$('dash-pause').onclick=()=>state==='paused'?resume():pause();$('dash-resume').onclick=resume;$('dash-quit').onclick=quit;$('dash-retry').onclick=startRun;$('dash-change').onclick=quit;$('dash-start').onclick=startRun;
$('dash-random').onclick=()=>{if(!catalog.length)return;const entry=catalog[Math.floor(Math.random()*catalog.length)];$('lab-avatar').value=entry.id;loadAvatar(entry);};$('lab-avatar').onchange=()=>loadAvatar(catalog.find(e=>e.id===$('lab-avatar').value));

function pollGamepad(){const p=[...(navigator.getGamepads?.()||[])].filter(Boolean)[0];if(!p)return;const j=!!p.buttons?.[0]?.pressed,s=!!p.buttons?.[1]?.pressed||(p.axes?.[1]||0)>.55;if(j&&!lastPadJump)jump();if(!j&&lastPadJump)releaseJump();if(s!==lastPadSlide)slide(s);lastPadJump=j;lastPadSlide=s;}
fetch(BASE+'avatars.json').then(r=>r.json()).then(entries=>{catalog=entries.filter(e=>e.url);for(const entry of catalog){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;$('lab-avatar').append(option);}const saved=localStorage.getItem('chimpions-lab-avatar'),entry=catalog.find(e=>e.id===saved)||catalog.find(e=>e.id==='chimpion')||catalog[0];$('lab-avatar').value=entry.id;return loadAvatar(entry);}).catch(error=>{$('lab-message').textContent='Avatar catalog unavailable.';console.error(error);});

setState('menu');run=makeRun();
renderer.setAnimationLoop(now=>{const dt=Math.min(.033,Math.max(0,(now-last)/1000));last=now;pollGamepad();updatePhysics(dt);renderUI(dt);renderer.render(scene,camera);});
window.chimpionsLab=()=>({state,ready:!!character,selected:currentEntry?.id,score:Math.floor(run?.score||0),distance:run?.scroll||0,stage:run?.stage||1,bananas:run?.bananaCount||0,best,obstacles:obstacles.length});
