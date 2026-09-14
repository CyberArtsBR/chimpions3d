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
    <p>Automatic side-running at full pace. Jump, slide and read the jungle while your selected rigged Chimpion stays in motion.</p>
    <label>YOUR RUNNING MATE<select id="lab-avatar" aria-label="Choose Chimpion"></select></label>
    <div id="lab-message" role="status">Loading Chimpion…</div>
    <div class="dash-menu-actions"><button id="dash-start" class="primary" disabled>▶ PLAY</button><button id="dash-random">Random Chimpion</button><a href="./">Back to Chimp Jump</a></div>
    <p class="controls"><kbd>SPACE</kbd>/<kbd>W</kbd>/<kbd>↑</kbd> jump · <kbd>↓</kbd>/<kbd>SHIFT</kbd>/<kbd>S</kbd>/<kbd>A</kbd> slide · <kbd>P</kbd> pause</p>
  </section>
  <section id="dash-over" class="dash-panel modal" hidden><span class="eyebrow">RUN COMPLETE</span><h2>THE JUNGLE WON THIS ROUND</h2><p id="dash-result"></p><div class="dash-menu-actions"><button id="dash-retry" class="primary">RUN AGAIN</button><button id="dash-change">Change Chimpion</button><a href="./">Back to Chimp Jump</a></div></section>
  <section id="dash-paused" class="dash-panel modal" hidden><span class="eyebrow">TAKE A BREATHER</span><h2>PAUSED</h2><p>Your run is frozen exactly where you left it.</p><div class="dash-menu-actions"><button id="dash-resume" class="primary">RESUME</button><button id="dash-quit">MAIN MENU</button></div></section>
  <div id="dash-touch"><button id="touch-slide">⇣<small>SLIDE</small></button><button id="touch-jump">↥<small>JUMP</small></button></div>
  <div id="dash-stage-flash"></div>
</main>`;

const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,6,-6,.01,40);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setClearColor(0x000000,0);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
$('lab-3d').append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe9f6df,0x24372b,2.35));
const key=new THREE.DirectionalLight(0xffe5aa,3.2);
key.position.set(-4,8,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-3;
key.shadow.normalBias=.03;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0x9fe7db,1.25);rim.position.set(5,4,5);scene.add(rim);

const STEP=1/120,PLAYER_X=150,BASE_SPEED=265,MAX_SPEED=540,GRAVITY=2200,JUMP_IMPULSE=600,LOW_HEIGHT=70,HOLD_TIME=.22,JUMP_BUFFER=.16,COYOTE_TIME=.10;
const BIOMES=[
 ['THE EMERALD WILDS','#73c897','#174e3d'],['CANOPY RUN','#5bb98d','#123e34'],
 ['WATERFALL GORGE','#83cbd3','#24556a'],['LOST TEMPLE','#d6b978','#4c553c'],
 ['MOONLIT JUNGLE','#797ac7','#161f4e'],['STORM FOREST','#708799','#172b37'],
 ['VOLCANIC WILDS','#e98a58','#49262d'],['CHIMPION DREAMSCAPE','#d78bd0','#293066']
];
const TYPES=[
 {id:'log',name:'fallen log',family:'short',action:'jump',w:64,h:38,boxes:[[9,0,46,28]],minStage:1,difficulty:1,recovery:.58},
 {id:'mushroom',name:'mushrooms',family:'short',action:'jump',w:58,h:38,boxes:[[11,0,36,27]],minStage:1,difficulty:1,recovery:.58},
 {id:'thorns',name:'thorn bush',family:'short',action:'jump',w:60,h:44,boxes:[[11,1,38,31]],minStage:2,difficulty:2,recovery:.62},
 {id:'stump',name:'tree stump',family:'high',action:'high-jump',w:58,h:98,boxes:[[7,0,44,84]],minStage:2,difficulty:2,recovery:.82},
 {id:'spike',name:'spike plant',family:'high',action:'high-jump',w:55,h:94,boxes:[[8,0,39,76]],minStage:3,difficulty:3,recovery:.84},
 {id:'log-pile',name:'log pile',family:'wide',action:'high-jump',w:138,h:40,boxes:[[7,0,124,19]],minStage:1,difficulty:2,recovery:.95},
 {id:'puddle',name:'wide puddle',family:'wide',action:'high-jump',w:132,h:24,boxes:[[3,0,126,12]],minStage:2,difficulty:2,recovery:.95},
 {id:'spike-patch',name:'wide spikes',family:'wide',action:'high-jump',w:148,h:38,boxes:[[5,0,138,22]],minStage:3,difficulty:3,recovery:1},
 {id:'branch',name:'hanging branch',family:'overhead',action:'slide',w:115,h:78,boxes:[[5,52,105,22]],minStage:2,difficulty:2,recovery:.62},
 {id:'vine',name:'hanging vines',family:'overhead',action:'slide',w:96,h:82,boxes:[[7,50,82,25]],minStage:3,difficulty:2,recovery:.66},
 {id:'canopy',name:'fallen canopy',family:'flex',action:'jump-or-slide',w:98,h:74,boxes:[[5,49,88,20]],minStage:4,difficulty:3,recovery:.72}
];

const sprite=id=>OLD+'sprites-clean/'+(id==='log-pile'?'log':id)+'.png';
const objectLayer=$('dash-objects');
const pools={hazard:[],banana:[]};
const cache=new Map();

function hudText(id,value){
  value=String(value);
  if(cache.get(id)!==value){$(id).textContent=value;cache.set(id,value);}
}
function metrics(){
  const vw=Math.max(600,Math.min(1080,innerWidth/innerHeight*500));
  const scale=innerWidth/vw;
  return{vw,scale,groundScreen:innerHeight*.82,groundBottom:innerHeight*.18};
}
let viewH=12.5,viewW=12.5,runnerWorldX=-3,groundWorldY=-4;
function resize3D(){
  const w=innerWidth,h=innerHeight,m=metrics();
  renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,w<760?1.2:1.6));
  viewW=viewH*w/h;camera.left=-viewW/2;camera.right=viewW/2;camera.top=viewH/2;camera.bottom=-viewH/2;camera.updateProjectionMatrix();
  camera.position.set(0,.1,12);camera.lookAt(0,.1,0);
  runnerWorldX=-viewW/2+viewW*(PLAYER_X/m.vw);
  groundWorldY=viewH/2-viewH*(m.groundScreen/h);
}
resize3D();
addEventListener('resize',()=>{resize3D();renderObjects();});

for(const id of [...new Set(TYPES.map(t=>t.id==='log-pile'?'log':t.id)),'banana','golden']){
  const im=new Image();im.decoding='async';im.src=sprite(id);
}
for(const src of [OLD+'jungle-v2.webp',OLD+'ground-green.png']){const im=new Image();im.decoding='async';im.src=src;}

let catalog=[],character=null,loading=false,currentEntry=null;
async function loadAvatar(entry){
  if(!entry?.url||loading)return;
  loading=true;$('dash-start').disabled=true;$('lab-avatar').disabled=true;$('lab-message').textContent='Loading '+entry.name+'…';
  try{
    const next=await createLabRunnerCharacter(BASE+entry.url);
    if(character){scene.remove(character.root);character.dispose();}
    character=next;currentEntry=entry;scene.add(character.root);character.setFacingRight(true);
    localStorage.setItem('chimpions-lab-avatar',entry.id);
    $('lab-message').textContent=entry.name+' · rig validated · '+next.boneCount+' bones';
    $('dash-start').disabled=false;
  }catch(error){
    console.error(error);$('lab-message').textContent='Rig rejected safely: '+error.message;
  }finally{loading=false;$('lab-avatar').disabled=false;}
}

function hashSeed(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0||1;}
function randomValue(r){let t=r.seedState+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
function speedFor(stage){const s=Math.max(0,stage-1);return Math.min(MAX_SPEED,BASE_SPEED+s*26+Math.max(0,s-2)*9);}
function multiplier(flow){return flow>=100?5:flow>=80?3:flow>=60?2:flow>=40?1.5:flow>=20?1.25:1;}

let run=null,state='menu',last=performance.now(),accumulator=0,spawnCursor=0,best=Number(localStorage.getItem('chimpions-lab-best-score'))||0,stageFlashTimer=0,lastPadJump=false,lastPadSlide=false,lastPadPause=false;
const keys=new Set(),obstacles=[],bananas=[];

function makeRun(){
  const seed=hashSeed(`${Date.now()}-${Math.random()}`);
  return{
    seed,seedState:seed,time:0,stage:1,speed:BASE_SPEED,scroll:0,distance:0,
    y:0,vy:0,jumpHeld:false,jumpAge:0,jumpBuffer:0,jumpBufferHeld:false,coyote:COYOTE_TIME,
    slideHeld:false,slideTime:0,slideMin:0,slideBlocked:false,grounded:true,landing:0,dead:false,
    bananaCount:0,goldenBananas:0,flow:0,maxFlow:0,combo:0,longestCombo:0,bonus:0,score:0,
    landed:false,lastDifficulty:1
  };
}

function playerBox(){
  const sliding=run.y===0&&(run.slideHeld||run.slideTime>0||run.slideMin>0||run.slideBlocked);
  return{x:PLAYER_X-16,y:run.y+5,w:32,h:sliding?31:78,sliding};
}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function obstacleBoxes(o){
  const sx=o.x-run.scroll;
  return(o.boxes||[[0,0,o.w,o.h]]).map(b=>({x:sx+b[0],y:b[1],w:b[2],h:b[3]}));
}
function overheadBlocksStand(){
  const stand={x:PLAYER_X-16,y:5,w:32,h:78};
  return obstacles.some(o=>!o.hit&&['overhead','flex'].includes(o.family)&&obstacleBoxes(o).some(b=>hit(stand,b)));
}

function acquire(kind,id,w,h){
  const el=pools[kind].pop()||document.createElement('img');
  el.hidden=false;el.className=kind+' '+(id||'');el.alt='';el.draggable=false;
  el.src=sprite(id);el.dataset.kind=kind;el.dataset.id=id;
  el.style.width=w+'px';el.style.height=h+'px';el.style.opacity='';
  el.onerror=()=>{el.classList.add('sprite-fallback');el.removeAttribute('src');};
  objectLayer.append(el);return el;
}
function recycle(el){
  if(!el)return;
  const kind=el.dataset.kind||'hazard';
  el.remove();el.hidden=true;el.removeAttribute('style');el.className='';
  if(pools[kind].length<32)pools[kind].push(el);
}
function spawnObstacle(type,x){
  const o={...type,x,passed:false,hit:false,minClearance:999,el:acquire('hazard',type.id,type.w,type.h)};
  obstacles.push(o);return o;
}
function spawnBanana(x,y,golden=false){
  const id=golden?'golden':'banana',b={x,y,golden,collected:false,el:acquire('banana',id,golden?38:34,golden?38:34)};
  bananas.push(b);
}
function bananaArc(start,end,apex=105,count=5,goldenChance=.07){
  for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1),arch=1-Math.pow(t*2-1,2);spawnBanana(start+(end-start)*t,24+arch*(apex-24),false);}
  if(randomValue(run)<goldenChance)spawnBanana(start+(end-start)*.5,apex+18,true);
}
function lowTrail(start,end,count=5){
  for(let i=0;i<count;i++)spawnBanana(start+(i+.5)*(end-start)/count,23,false);
}
function patternCatalog(stage){
  const early=stage<=2,late=stage>=5;
  return[
    {id:'easy-hop',difficulty:1,weight:4.6,items:[['short',0]],recovery:.75},
    {id:'stage-one-long-jump',difficulty:2,weight:stage===1?2.1:0,items:[['wide',0]],recovery:1.04},
    {id:'high-wall',difficulty:2,weight:stage>1?3:0,items:[['high',0]],recovery:.95},
    {id:'wide-leap',difficulty:2,weight:stage===1?1.4:3.2,items:[['wide',0]],recovery:1.03},
    {id:'duck-under',difficulty:2,weight:stage>1?(late?6:4):0,items:[['overhead',0]],recovery:late?.72:.78},
    {id:'choice-line',difficulty:3,weight:stage>3?2.1:0,items:[['flex',0]],recovery:.82},
    {id:'quick-hop-high',difficulty:3,weight:stage>1?2.4:0,items:[['short',0],['high',early?1.12:.88]],recovery:.98},
    {id:'duck-then-hop',difficulty:3,weight:stage>2?2.8:0,items:[['overhead',0],['short',early?1.05:.84]],recovery:.92},
    {id:'slide-gauntlet',difficulty:3,weight:stage>3?3.2:0,items:[['overhead',0],['overhead',.90]],recovery:.86},
    {id:'hop-then-duck',difficulty:4,weight:stage>3?2.2:0,items:[['short',0],['overhead',.98]],recovery:.96},
    {id:'double-rhythm',difficulty:4,weight:stage>4?1.4:0,items:[['short',0],['short',.82]],recovery:.90},
    {id:'wide-into-slide',difficulty:4,weight:stage>4?2.1:0,items:[['wide',0],['overhead',1.05]],recovery:.98},
    {id:'high-into-slide',difficulty:4,weight:stage>4?2.1:0,items:[['high',0],['overhead',.96]],recovery:.96},
    {id:'beam-pressure',difficulty:5,weight:stage>5?1.8:0,items:[['overhead',0],['short',.90],['overhead',.92]],recovery:.94},
    {id:'triple-rhythm',difficulty:5,weight:stage>6?1:0,items:[['short',0],['overhead',.92],['wide',1.02]],recovery:1}
  ].filter(p=>p.weight>0&&p.difficulty<=Math.min(5,stage+1));
}
function chooseWeighted(list){
  let total=list.reduce((n,x)=>n+x.weight,0),roll=randomValue(run)*total;
  for(const x of list){roll-=x.weight;if(roll<=0)return x;}
  return list.at(-1);
}
function chooseFamily(family,difficulty){
  const list=TYPES.filter(t=>t.family===family&&t.minStage<=run.stage&&t.difficulty<=difficulty+1);
  return list[Math.floor(randomValue(run)*list.length)]||TYPES[0];
}
function spawnPattern(){
  let options=patternCatalog(run.stage);
  if(run.lastDifficulty>=4)options=options.filter(p=>p.difficulty<=2);
  const def=chooseWeighted(options),created=[];
  let x=spawnCursor;
  for(let i=0;i<def.items.length;i++){
    const[family,gap]=def.items[i],type=chooseFamily(family,def.difficulty);
    if(i)x=created.at(-1).x+created.at(-1).w+run.speed*gap;
    const o=spawnObstacle(type,x);created.push(o);
    if(type.action==='slide')lowTrail(x-50,x+type.w+34,5);
    else bananaArc(x-48,x+type.w+42,type.family==='high'?145:type.family==='wide'?122:102,type.family==='wide'?6:5);
  }
  const lastO=created.at(-1);
  spawnCursor=(lastO?.x||x)+(lastO?.w||0)+run.speed*(def.recovery+.28+randomValue(run)*.24);
  run.lastDifficulty=def.difficulty;
}
function seedWorld(){
  const m=metrics();
  spawnCursor=m.vw+360;
  while(spawnCursor<m.vw*2.4)spawnPattern();
}
function clearWorld(){
  for(const o of obstacles)recycle(o.el);
  for(const b of bananas)recycle(b.el);
  obstacles.length=0;bananas.length=0;objectLayer.textContent='';
}
function maintainWorld(){
  const m=metrics();
  while(spawnCursor-run.scroll<m.vw+760)spawnPattern();
  for(let i=obstacles.length-1;i>=0;i--){
    if(obstacles[i].x-run.scroll<-260){recycle(obstacles[i].el);obstacles.splice(i,1);}
  }
  for(let i=bananas.length-1;i>=0;i--){
    if(bananas[i].x-run.scroll<-100||bananas[i].collected){recycle(bananas[i].el);bananas.splice(i,1);}
  }
}
function renderObjects(){
  if(!run)return;
  const m=metrics();
  for(const o of obstacles){
    const x=(o.x-run.scroll)*m.scale,overhead=o.family==='overhead'||o.family==='flex';
    o.el.style.width=Math.round(o.w*m.scale)+'px';
    o.el.style.height=Math.round(o.h*m.scale)+'px';
    o.el.style.transform=`translate3d(${Math.round(x)}px,0,0)`;
    o.el.style.bottom=Math.round(m.groundBottom+(overhead?50*m.scale:0))+'px';
  }
  for(const b of bananas){
    const size=(b.golden?38:34)*m.scale,x=(b.x-run.scroll)*m.scale;
    b.el.style.width=Math.round(size)+'px';b.el.style.height=Math.round(size)+'px';
    b.el.style.bottom=Math.round(m.groundBottom)+'px';
    b.el.style.transform=`translate3d(${Math.round(x)}px,${Math.round(-b.y*m.scale)}px,0) rotate(${run.time*100%360}deg)`;
  }
}

function jump(held=true){
  if(!run||state!=='running'||run.dead)return;
  if(run.y===0||run.coyote>0){
    run.slideHeld=false;run.slideTime=0;run.slideMin=0;run.slideBlocked=false;
    run.vy=JUMP_IMPULSE;run.jumpHeld=held;run.jumpAge=0;run.jumpBuffer=0;run.jumpBufferHeld=false;run.coyote=0;run.grounded=false;return;
  }
  run.jumpBuffer=JUMP_BUFFER;run.jumpBufferHeld=held;
}
function releaseJump(){
  if(!run)return;
  if(run.jumpHeld&&run.jumpAge<HOLD_TIME&&run.vy>0&&run.y<LOW_HEIGHT)run.vy=Math.min(run.vy,Math.sqrt(Math.max(0,2*GRAVITY*(LOW_HEIGHT-run.y))));
  run.jumpHeld=false;run.jumpBufferHeld=false;
}
function slide(on){
  if(!run||state!=='running'||run.dead)return;
  run.slideHeld=on;
  if(on&&run.y===0){run.slideMin=Math.max(run.slideMin,.24);run.slideTime=Math.max(run.slideTime,.24);}
}
function movePlayer(dt){
  run.landed=false;
  run.landing=Math.max(0,run.landing-dt);run.jumpBuffer=Math.max(0,run.jumpBuffer-dt);run.slideMin=Math.max(0,run.slideMin-dt);run.slideTime=Math.max(0,run.slideTime-dt);
  if(run.y===0){
    if(!run.vy)run.coyote=COYOTE_TIME;
    run.slideBlocked=!run.slideHeld&&run.slideMin<=0&&overheadBlocksStand();
    if(run.slideHeld||run.slideMin>0||run.slideBlocked)run.slideTime=Math.max(run.slideTime,dt);
  }else run.coyote=Math.max(0,run.coyote-dt);
  if(!run.vy&&!run.y){if(run.jumpBuffer>0)jump(run.jumpBufferHeld);return;}
  const gravity=run.jumpHeld&&run.jumpAge<HOLD_TIME&&run.vy>0?0:(run.vy<0?GRAVITY*1.14:GRAVITY);
  run.jumpAge+=dt;run.y+=run.vy*dt-gravity*dt*dt/2;run.vy-=gravity*dt;
  if(run.y<=0){
    run.y=0;run.vy=0;run.jumpHeld=false;run.grounded=true;run.landing=.095;run.landed=true;
    if(run.jumpBuffer>0)jump(run.jumpBufferHeld);
  }else run.grounded=false;
}
function setState(next){
  state=next;document.body.dataset.labState=next;
  $('dash-menu').hidden=next!=='menu';$('dash-over').hidden=next!=='over';$('dash-paused').hidden=next!=='paused';
}
function startRun(){
  if(!character)return;
  clearWorld();run=makeRun();seedWorld();setState('running');accumulator=0;
  $('dash-stage-flash').textContent='GO!';stageFlashTimer=1.1;$('dash-tip').classList.add('show');
  setTimeout(()=>$('dash-tip')?.classList.remove('show'),4200);last=performance.now();
}
function finishRun(){
  if(!run||run.dead)return;
  run.dead=true;state='over';best=Math.max(best,Math.floor(run.score));localStorage.setItem('chimpions-lab-best-score',best);
  hudText('dash-best',String(best).padStart(6,'0'));
  $('dash-result').textContent=`${Math.floor(run.score)} points · ${(run.distance/1000).toFixed(2)} km · ${run.bananaCount} bananas · stage ${run.stage}`;
  setState('over');
}
function pause(){if(state!=='running')return;setState('paused');}
function resume(){if(state!=='paused')return;setState('running');last=performance.now();accumulator=0;}
function quit(){clearWorld();run=makeRun();setState('menu');accumulator=0;}

function updatePhysics(dt){
  if(state!=='running'||!run||run.dead)return;
  run.time+=dt;
  const stage=Math.floor((run.time+1e-7)/30)+1;
  if(stage!==run.stage){run.stage=stage;stageFlashTimer=1.8;$('dash-stage-flash').textContent='STAGE '+stage;}
  const target=speedFor(run.stage);
  run.speed=run.time<30?BASE_SPEED:run.speed+(target-run.speed)*Math.min(1,dt/2.5);
  movePlayer(dt);
  run.scroll+=run.speed*dt;run.distance=run.scroll/100;
  maintainWorld();
  const p=playerBox();
  for(const o of obstacles){
    const sx=o.x-run.scroll;
    if(!o.passed&&sx+o.w<PLAYER_X-18){
      o.passed=true;run.combo++;run.longestCombo=Math.max(run.longestCombo,run.combo);run.flow=Math.min(100,run.flow+4);run.maxFlow=Math.max(run.maxFlow,run.flow);run.bonus+=Math.round(5*multiplier(run.flow));
    }
    if(o.hit||sx>PLAYER_X+90||sx+o.w<PLAYER_X-90)continue;
    for(const b of obstacleBoxes(o)){
      const vertical=p.y>=b.y+b.h?p.y-(b.y+b.h):b.y-(p.y+p.h);
      o.minClearance=Math.min(o.minClearance,Math.max(0,vertical));
      if(hit(p,b)){o.hit=true;run.combo=0;finishRun();return;}
    }
  }
  for(const b of bananas){
    if(b.collected)continue;
    const x=b.x-run.scroll,centerY=run.y+(p.sliding?18:48);
    if(Math.abs(x-PLAYER_X)<27&&Math.abs(centerY-b.y)<31){
      b.collected=true;run.bananaCount++;run.goldenBananas+=b.golden?1:0;
      run.flow=Math.min(100,run.flow+(b.golden?30:3));run.maxFlow=Math.max(run.maxFlow,run.flow);
      run.bonus+=Math.round((b.golden?500:25)*multiplier(run.flow));
      b.el.classList.add('collected');
    }
  }
  run.flow=Math.max(0,run.flow-dt*2.2);
  run.score=Math.floor(run.distance*10)+run.bonus;
}

function renderUI(dt){
  const active=run||makeRun(),biome=BIOMES[(active.stage-1)%BIOMES.length],m=metrics();
  document.documentElement.style.setProperty('--biome-top',biome[1]);
  document.documentElement.style.setProperty('--biome-bottom',biome[2]);
  document.documentElement.style.setProperty('--far-x',`${-(active.scroll*m.scale*.08)%1600}px`);
  document.documentElement.style.setProperty('--mid-x',`${-(active.scroll*m.scale*.18)%1600}px`);
  document.documentElement.style.setProperty('--ground-x',`${-(active.scroll*m.scale*.82)%900}px`);
  hudText('dash-score',String(Math.floor(active.score)).padStart(6,'0'));
  hudText('dash-distance',(active.distance/1000).toFixed(2)+' KM');
  hudText('dash-best',String(best).padStart(6,'0'));
  hudText('dash-bananas',active.bananaCount);
  hudText('dash-mult',multiplier(active.flow).toFixed(2)+'×');
  hudText('dash-stage-label',String(active.stage).padStart(2,'0')+' / '+biome[0]);
  if(stageFlashTimer>0){stageFlashTimer-=dt;$('dash-stage-flash').classList.add('show');}else $('dash-stage-flash').classList.remove('show');

  if(character){
    const jumping=!active.grounded,sliding=active.grounded&&(active.slideHeld||active.slideTime>0||active.slideMin>0||active.slideBlocked),animState=jumping?'JUMP':state==='running'?'RUN':'IDLE';
    character.update(dt,{state:animState,speed:active.speed/BASE_SPEED,jumpHeight:active.y,vy:active.vy,sliding,landed:active.landed});
    const jumpWorld=active.y*m.scale*viewH/innerHeight;
    character.root.position.set(runnerWorldX,groundWorldY+jumpWorld,0);
  }
  const shadow=$('dash-shadow');
  if(shadow){
    const jump=active.y*m.scale;
    shadow.style.left=Math.round(PLAYER_X*m.scale)+'px';
    shadow.style.width=Math.round(104*m.scale)+'px';
    shadow.style.opacity=String(clamp(1-jump/210,.16,.72));
    shadow.style.transform=`translateX(-50%) scale(${clamp(1-jump/240,.52,1)})`;
  }
  renderObjects();
}

const jumpCodes=new Set(['Space','KeyW','ArrowUp']),slideCodes=new Set(['ArrowDown','ShiftLeft','ShiftRight','KeyS','KeyA']);
addEventListener('keydown',e=>{
  if(jumpCodes.has(e.code)||slideCodes.has(e.code)||e.code==='KeyP'){e.preventDefault();keys.add(e.code);}
  if(jumpCodes.has(e.code)&&!e.repeat)jump(true);
  if(slideCodes.has(e.code))slide(true);
  if(e.code==='KeyP'&&!e.repeat)(state==='paused'?resume():pause());
  if(e.code==='Escape'&&state!=='menu')quit();
});
addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(jumpCodes.has(e.code))releaseJump();
  if(slideCodes.has(e.code)&&![...slideCodes].some(code=>keys.has(code)))slide(false);
});
addEventListener('blur',()=>{keys.clear();releaseJump();slide(false);});

function touchHold(id,start,end){
  const el=$(id);
  el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);start();};
  el.onpointerup=el.onpointercancel=el.onlostpointercapture=e=>{e?.preventDefault?.();end();};
}
touchHold('touch-jump',()=>jump(true),releaseJump);
touchHold('touch-slide',()=>slide(true),()=>slide(false));

$('dash-pause').onclick=()=>state==='paused'?resume():pause();
$('dash-resume').onclick=resume;$('dash-quit').onclick=quit;$('dash-retry').onclick=startRun;$('dash-change').onclick=quit;$('dash-start').onclick=startRun;
$('dash-random').onclick=()=>{if(!catalog.length)return;const entry=catalog[Math.floor(Math.random()*catalog.length)];$('lab-avatar').value=entry.id;loadAvatar(entry);};
$('lab-avatar').onchange=()=>loadAvatar(catalog.find(e=>e.id===$('lab-avatar').value));

function pollGamepad(){
  const p=[...(navigator.getGamepads?.()||[])].filter(Boolean)[0];if(!p)return;
  const j=!!p.buttons?.[0]?.pressed,s=!!p.buttons?.[1]?.pressed||(p.axes?.[1]||0)>.55,start=!!p.buttons?.[9]?.pressed;
  if(j&&!lastPadJump)jump(true);if(!j&&lastPadJump)releaseJump();
  if(s!==lastPadSlide)slide(s);
  if(start&&!lastPadPause)(state==='paused'?resume():pause());
  lastPadJump=j;lastPadSlide=s;lastPadPause=start;
}

fetch(BASE+'avatars.json').then(r=>r.json()).then(entries=>{
  catalog=entries.filter(e=>e.url);
  for(const entry of catalog){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;$('lab-avatar').append(option);}
  const saved=localStorage.getItem('chimpions-lab-avatar'),entry=catalog.find(e=>e.id===saved)||catalog.find(e=>e.id==='chimpion')||catalog[0];
  $('lab-avatar').value=entry.id;return loadAvatar(entry);
}).catch(error=>{$('lab-message').textContent='Avatar catalog unavailable.';console.error(error);});

setState('menu');run=makeRun();seedWorld();
renderer.setAnimationLoop(now=>{
  const frameDt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;pollGamepad();
  if(state==='running'){
    accumulator=Math.min(.12,accumulator+frameDt);
    let steps=0;
    while(accumulator>=STEP&&steps<15){updatePhysics(STEP);accumulator-=STEP;steps++;}
  }else accumulator=0;
  renderUI(frameDt);renderer.render(scene,camera);
});

window.chimpionsLab=()=>({
  state,ready:!!character,selected:currentEntry?.id,score:Math.floor(run?.score||0),
  distance:run?.distance||0,stage:run?.stage||1,bananas:run?.bananaCount||0,best,
  speed:run?.speed||BASE_SPEED,obstacles:obstacles.length,pool:{hazards:pools.hazard.length,bananas:pools.banana.length}
});
