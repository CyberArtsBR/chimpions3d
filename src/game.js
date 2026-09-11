import * as THREE from 'three';
import {loadCharacter} from './character.js';
import {createScenery} from './scenery.js';
import {readLocalGLB} from './upload.js';
import {disposeCharacter} from './character.js';
import {Game,STEP,WIDTH,VIEW_HEIGHT} from './physics.js';
import './game.css';

document.body.innerHTML=`
<div id="world"><div class="sun"></div><div class="rays"></div><div class="hill"></div><div class="hill two"></div><div class="mist"></div></div>
<header id="hud"><div class="stat"><small>HEIGHT</small><strong id="height">0</strong> <em>m</em></div><div class="right"><div class="stat coins"><small>BANANAS</small><strong id="coins">0</strong></div><button id="mute" aria-label="Enable sound">♪</button><button id="pause" aria-label="Pause game" hidden>Ⅱ</button></div></header>
<div class="court-edges" aria-hidden="true"><span>‹</span><span>›</span></div><div id="theme">Jungle Morning</div>
<div id="overlay"><section class="card"><div class="eyebrow" id="eyebrow">A little chimp. A big climb.</div><h1 id="title">CHIMP<br><span>JUMP</span></h1><p id="description">Find your next branch.<br>Keep bouncing. Chase the canopy.</p><div id="avatar-list" hidden></div><div id="avatar-status" role="status"></div><button class="primary" id="play" disabled>LOADING YOUR CHIMP…</button><div class="best" id="best"></div><div class="avatar-actions"><button class="secondary" id="choose">Choose chimp</button><button class="secondary" id="upload">Load your GLB avatar</button><input id="avatar-file" type="file" accept=".glb" hidden></div><div class="options"><button id="quality">Detail: High</button><button id="flip" hidden>Flip avatar facing</button></div><div class="keys"><b>←</b><b>→</b> or <b>A</b><b>D</b><span>to steer · auto jump</span></div><a class="secondary" href="?rig=1">Rig laboratory</a></section></div>
<div id="touch" hidden><button class="touch" id="left" aria-label="Move left">←</button><button class="touch" id="right" aria-label="Move right">→</button></div>
<div id="toast" role="status"></div><div class="footer">CHIMP JUMP · CANOPY EDITION</div>`;
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-5,5,14,-2,0.1,60);
camera.position.set(0,0,20);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setClearColor(0,0);$('world').append(renderer.domElement);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.fog=new THREE.Fog(0x91b6a0,25,58);
const sun=new THREE.DirectionalLight(0xffefd1,3.2);sun.position.set(-5,9,12);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-7,right:7,top:10,bottom:-10,near:.5,far:35});
sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;scene.add(sun.target);
scene.add(sun,new THREE.HemisphereLight(0xd9ecd9,0x303e31,1.7));
const rim=new THREE.DirectionalLight(0xb6dee0,1.1);rim.position.set(4,4,-4);scene.add(rim);
const world=new THREE.Group();scene.add(world);
const scenery=createScenery(scene,renderer);
function removeBranch(m){world.remove(m);m.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
let highDetail= !matchMedia('(pointer: coarse)').matches;
try{const value=localStorage.getItem('chimp-jump-detail');if(value)highDetail=value==='high';}catch{}
function quality(){
 renderer.setPixelRatio(Math.min(devicePixelRatio,highDetail?1.75:1.15));
 renderer.shadowMap.enabled=highDetail;scenery.setQuality(highDetail);
 $('quality').textContent='Detail: '+(highDetail?'High':'Balanced');
 resize();
}
$('quality').onclick=()=>{highDetail=!highDetail;quality();try{localStorage.setItem('chimp-jump-detail',highDetail?'high':'balanced');}catch{}};
const platformMeshes=new Map();
const characterLayer=new THREE.Group();scene.add(characterLayer);
let game=new Game(7),avatar,ready=false,mode='menu',yaw=Math.PI/2,targetYaw=Math.PI/2;
let facingFlip=0;
let visualTime=0,acc=0,previous=performance.now(),lastTheme=-1;
let best=0,muted=true,audioContext,toastTimer,avatarRequest=0,catalog=[];
try{best=Number(localStorage.getItem('chimp-jump-best'))||0;}catch{}
const keys=new Set(),pointers=new Map();
const input=()=>Number(keys.has('ArrowRight')||keys.has('KeyD')||[...pointers.values()].includes(1))-Number(keys.has('ArrowLeft')||keys.has('KeyA')||[...pointers.values()].includes(-1));
const themes=[
 {name:'Jungle Morning',top:'#69bccb',bottom:'#d7e6b6',leaf:0x88ae57,bark:0x876047,light:0xffe9c8},
 {name:'Emerald Mist',top:'#328e9b',bottom:'#99d9c1',leaf:0x5aa884,bark:0x66574e,light:0xc9ffe8},
 {name:'Golden Canopy',top:'#df8c83',bottom:'#f4d2a0',leaf:0xb9a359,bark:0x90624c,light:0xffd1a3},
 {name:'Moonlit Grove',top:'#283d71',bottom:'#7787ae',leaf:0x5d8e9b,bark:0x595a71,light:0xc5dcff}
];
const color=new THREE.Color(),other=new THREE.Color();
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,1800);}
function sound(type){
 if(muted)return;
 try{
 audioContext??=new AudioContext();audioContext.resume();
 const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime;
 o.type='sine';o.frequency.setValueAtTime(type==='coin'?900:type==='death'?200:420,t);
 o.frequency.exponentialRampToValueAtTime(type==='death'?70:type==='coin'?1400:700,t+.12);
 g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
 o.connect(g);g.connect(audioContext.destination);o.start();o.stop(t+.17);
 }catch{}
}
function syncUI(){
 $('height').textContent=Math.floor(game.height);$('coins').textContent=game.bananas;
 $('best').textContent='PERSONAL BEST  ·  '+Math.floor(best)+' m';
 $('pause').hidden=mode!=='playing';$('touch').hidden=mode!=='playing';
 $('overlay').hidden=mode==='playing';
}
function menu(kind){
 mode=kind;keys.clear();pointers.clear();acc=0;
 $('avatar-list').hidden=true;$('choose').hidden=false;$('upload').hidden=kind==='paused';$('flip').hidden=kind==='paused'||!ready;
 if(kind==='over'){
 $('eyebrow').textContent=game.height>best?'A new personal best!':'One more branch. One more try.';
 best=Math.max(best,game.height);try{localStorage.setItem('chimp-jump-best',String(best));}catch{}
 $('title').innerHTML=Math.floor(game.height)+'<span> m</span>';
 $('description').textContent=game.bananas+' bananas collected. Your next climb is waiting.';
 $('play').textContent='JUMP AGAIN';
 }else if(kind==='paused'){
 $('eyebrow').textContent='Take a breath';$('title').innerHTML='ON<br><span>A BRANCH</span>';
 $('description').textContent='Your climb is paused.';$('play').textContent='KEEP CLIMBING';$('choose').hidden=true;
 }else{
 $('eyebrow').textContent='A little chimp. A big climb.';$('title').innerHTML='CHIMP<br><span>JUMP</span>';
 $('description').innerHTML='Find your next branch.<br>Keep bouncing. Chase the canopy.';$('play').textContent=ready?'LET’S JUMP':'LOADING YOUR CHIMP…';
 }
 syncUI();
}
function start(){
 if(!ready)return;
 if(mode!=='paused'){for(const m of platformMeshes.values())removeBranch(m);platformMeshes.clear();scenery.reset();game.reset(Math.floor(Math.random()*4294967295));yaw=targetYaw=Math.PI/2;lastTheme=-1;}
 mode='playing';keys.clear();pointers.clear();acc=0;previous=performance.now();syncUI();
}
$('play').onclick=start;
$('pause').onclick=()=>menu('paused');
$('mute').onclick=()=>{muted=!muted;$('mute').style.opacity=muted?.5:1;$('mute').setAttribute('aria-label',muted?'Enable sound':'Mute sound');if(!muted)sound('coin');};
$('mute').style.opacity=.5;
addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){
  e.preventDefault();if(mode==='playing')keys.add(e.code);
 }else if(['Escape','KeyP'].includes(e.code)&&!e.repeat){e.preventDefault();if(mode==='playing')menu('paused');else if(mode==='paused')start();}
 else if(e.code==='Enter'&&mode!=='playing'&&!e.repeat){e.preventDefault();start();}
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{if(mode==='playing')menu('paused');keys.clear();pointers.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')menu('paused');});
for(const [id,dir]of [['left',-1],['right',1]]){
 const b=$(id);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,dir);};
 b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>pointers.delete(e.pointerId);
}
async function selectAvatar(entry){
 const request=++avatarRequest;ready=false;$('play').disabled=true;$('play').textContent='LOADING YOUR CHIMP…';
 $('avatar-status').textContent='Preparing pose and checking skeleton…';
 try{
 const next=await loadCharacter(entry.buffer||import.meta.env.BASE_URL+entry.url,entry.bones||{});
 if(request!==avatarRequest){disposeCharacter(next);return;}
 if(avatar){characterLayer.remove(avatar.root);disposeCharacter(avatar);}
 for(const m of platformMeshes.values())removeBranch(m);platformMeshes.clear();scenery.reset();game.reset(7);lastTheme=-1;
 avatar=next;facingFlip=0;avatar.root.rotation.y=yaw*(facingFlip?-1:1)+facingFlip;characterLayer.add(avatar.root);ready=true;
 $('play').disabled=false;menu('menu');
 $('avatar-status').textContent=entry.name+' · '+avatar.boneCount+' bones'+(entry.buffer?' · local file':'');
 }catch(e){
  if(request!==avatarRequest)return;
  console.warn('Avatar rejected:',e.message);ready=!!avatar;$('play').disabled=!ready;
  $('play').textContent=ready?'LET’S JUMP':'MODEL UNAVAILABLE';
  $('avatar-status').textContent=e.message+(ready?' Your previous avatar is still ready.':'');
 }
}
$('upload').onclick=()=>{$('avatar-file').click();};
$('avatar-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const buffer=await readLocalGLB(file);
  await selectAvatar({name:file.name.replace(/\.glb$/i,''),buffer});
 }catch(error){$('avatar-status').textContent=error.message;}
};
$('flip').onclick=()=>{facingFlip=facingFlip?0:Math.PI;toast('Avatar front direction reversed');};
$('choose').onclick=()=>{
 const list=$('avatar-list');list.hidden=!list.hidden;list.replaceChildren();
 for(const entry of catalog){const b=document.createElement('button');b.className='avatar-option';b.textContent=entry.name;b.onclick=()=>selectAvatar(entry);list.append(b);}
};
fetch(import.meta.env.BASE_URL+'avatars.json').then(r=>{if(!r.ok)throw new Error('Avatar catalog unavailable');return r.json();})
.then(entries=>{catalog=entries;if(!entries.length)throw new Error('No avatars configured');return selectAvatar(entries[0]);})
.catch(e=>{$('description').textContent=e.message;$('play').textContent='RELOAD TO TRY AGAIN';console.error(e);});

function drawWorld(dt=0){
 const live=new Set(game.platforms.map(p=>p.id));
 for(const [id,m]of platformMeshes){if(!live.has(id)){removeBranch(m);platformMeshes.delete(id);}}
 for(const p of game.platforms){
  let m=platformMeshes.get(p.id);if(!m){m=scenery.branch(p);world.add(m);platformMeshes.set(p.id,m);}
  m.position.set(p.x,p.y,0);m.visible=!p.broken;
  m.userData.coin.visible=p.coin;m.userData.coin.rotation.y=visualTime*1.2;m.userData.coin.position.y=1+Math.sin(visualTime*2+p.id)*.07;
 }
 const idx=Math.floor(game.time/30)%4, blend=Math.min((game.time%30)/1.5,1);
 const current=themes[idx],previousTheme=themes[(idx+3)%4],from=game.time<30?current:previousTheme;
 if(lastTheme!==idx){lastTheme=idx;$('theme').textContent=current.name;if(game.time>=30)toast(current.name);}
 const top=color.set(from.top).lerp(other.set(current.top),blend).getStyle();
 const bottom=color.set(from.bottom).lerp(other.set(current.bottom),blend).getStyle();
 $('world').style.background='linear-gradient('+top+','+bottom+')';
 const palette=color.set(from.bottom).lerp(other.set(current.bottom),blend).clone();
 scene.fog.color.copy(palette);
 scenery.update(game.camera,visualTime,dt,palette,idx===3);
 $('world').classList.toggle('night',idx===3);
 sun.color.set(from.light).lerp(other.set(current.light),blend);
}
function tick(dt,control=input()){
 if(mode!=='playing')return;
 if(control)targetYaw=control>0?Math.PI/2:-Math.PI/2;
 const distance=targetYaw-yaw;
 yaw+=Math.sign(distance)*Math.min(Math.abs(distance),Math.PI/0.1*dt);
 const events=game.step(control,dt);
 for(const e of events){scenery.burst(e);if(e.type==='death'){sound('death');menu('over');}else if(e.type==='coin')sound('coin');else if(e.spring){sound('bounce');toast('Spring boost!');}}
}
function resize(){
 const w=innerWidth,h=innerHeight;renderer.setSize(w,h);
 const courtWidth=Math.min(w,h*WIDTH/VIEW_HEIGHT);
 const viewWidth=w/courtWidth*WIDTH,viewHeight=h/courtWidth*WIDTH;
 renderer.setViewport(0,0,w,h);
 camera.left=-viewWidth/2;camera.right=viewWidth/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
 camera.updateProjectionMatrix();
 document.documentElement.style.setProperty('--court',courtWidth+'px');
}
addEventListener('resize',resize);quality();menu('menu');
renderer.setAnimationLoop(now=>{
 const raw=(now-previous)/1000;previous=now;const dt=Math.min(Math.max(raw,0),.05);
 if(raw>0.75&&mode==='playing')menu('paused');
 visualTime+=dt;
 if(mode==='playing'){acc+=dt;while(acc>=STEP){tick(STEP);acc-=STEP;if(mode!=='playing'){acc=0;break;}}}
 if(avatar){
  avatar.root.position.set(game.x,game.y,0);avatar.root.rotation.y=yaw*(facingFlip?-1:1)+facingFlip;
  avatar.update(dt,visualTime,game.vy,game.bounceAge,mode==='playing');
 }
 camera.position.y=game.camera;
 sun.position.set(-5,game.camera+9,12);sun.target.position.set(0,game.camera,0);
 drawWorld(dt);syncUI();renderer.render(scene,camera);
});
window.chimpJump=()=>({ready,mode,x:game.x,y:game.y,vx:game.vx,vy:game.vy,height:game.height,bounces:game.bounces,time:game.time,theme:themes[Math.floor(game.time/30)%4].name,yaw,visible:!!avatar?.model.visible,bones:avatar?.boneCount||0,platformCount:game.platforms.length,visibleBranches:[...platformMeshes.values()].filter(m=>m.parent===world&&m.visible).length,quality:highDetail?'high':'balanced',drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
if(new URLSearchParams(location.search).has('test')){
 window.chimpJumpTest={step:(count,control=0)=>{for(let i=0;i<count;i++)tick(STEP,control);drawWorld();syncUI();},game:()=>game};
}
