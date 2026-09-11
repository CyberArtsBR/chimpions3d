import * as THREE from 'three';
import {loadCharacter} from './character.js';
import {Game,STEP} from './physics.js';
import './game.css';

document.body.innerHTML=`
<div id="world"><div class="sun"></div><div class="hill"></div><div class="hill two"></div><div class="mist"></div></div>
<header id="hud"><div class="stat"><small>HEIGHT</small><strong id="height">0</strong> <em>m</em></div><div class="right"><div class="stat coins"><small>BANANAS</small><strong id="coins">0</strong></div><button id="mute" aria-label="Enable sound">♪</button><button id="pause" aria-label="Pause game" hidden>Ⅱ</button></div></header>
<div id="theme">Jungle Morning</div>
<div id="overlay"><section class="card"><div class="eyebrow" id="eyebrow">A little chimp. A big climb.</div><h1 id="title">CHIMP<br><span>JUMP</span></h1><p id="description">Find your next branch.<br>Keep bouncing. Chase the canopy.</p><div id="avatar-list" hidden></div><button class="primary" id="play" disabled>LOADING YOUR CHIMP…</button><div class="best" id="best"></div><button class="secondary" id="choose">Choose chimp</button><div class="keys"><b>←</b><b>→</b> or <b>A</b><b>D</b><span>to steer · auto jump</span></div><a class="secondary" href="?rig=1">Rig laboratory</a></section></div>
<div id="touch" hidden><button class="touch" id="left" aria-label="Move left">←</button><button class="touch" id="right" aria-label="Move right">→</button></div>
<div id="toast" role="status"></div><div class="footer">CHIMP JUMP · FIRST FLIGHT</div>`;
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-5,5,14,-2,0.1,60);
camera.position.set(0,0,20);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setClearColor(0,0);$('world').append(renderer.domElement);
const sun=new THREE.DirectionalLight(0xffefd1,2.4);sun.position.set(-5,9,12);
scene.add(sun,new THREE.HemisphereLight(0xddfff3,0x435345,2));
const world=new THREE.Group();scene.add(world);
const trunkMaterial=new THREE.MeshStandardMaterial({color:0x785143,roughness:1,flatShading:true});
const bark=new THREE.MeshStandardMaterial({color:0x946749,roughness:1,flatShading:true});
const moss=new THREE.MeshStandardMaterial({color:0x85aa52,roughness:1});
const gold=new THREE.MeshStandardMaterial({color:0xffdb57,roughness:.6,emissive:0x6a3c05,emissiveIntensity:.25});
const blue=new THREE.MeshStandardMaterial({color:0x81ced1,roughness:1});
const crackMat=new THREE.MeshStandardMaterial({color:0xb38861,roughness:1});
const red=new THREE.MeshStandardMaterial({color:0xe87861,roughness:1});
const trunkGeo=new THREE.CylinderGeometry(1.7,1.95,5.2,9);
const branchGeo=new THREE.CylinderGeometry(.16,.23,1,7);
const mossGeo=new THREE.BoxGeometry(1,.12,.7);
const leafGeo=new THREE.SphereGeometry(1,5,3);
const coinGeo=new THREE.TorusGeometry(.18,.065,5,10,4.1);
const trunks=[];
for(let i=0;i<7;i++){const m=new THREE.Mesh(trunkGeo,trunkMaterial);m.position.set(.2,0,-3.4);m.rotation.y=i*.7;world.add(m);trunks.push(m);}
const leaves=[];
for(let i=0;i<16;i++){
 const m=new THREE.Mesh(leafGeo,moss);m.scale.set(.3,.12,.12);world.add(m);leaves.push(m);
}
const platformMeshes=new Map();
const characterLayer=new THREE.Group();scene.add(characterLayer);
let game=new Game(7),avatar,ready=false,mode='menu',yaw=Math.PI/2,targetYaw=Math.PI/2;
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
 $('avatar-list').hidden=true;$('choose').hidden=false;
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
 if(mode!=='paused'){for(const m of platformMeshes.values())world.remove(m);platformMeshes.clear();game.reset(Math.floor(Math.random()*4294967295));yaw=targetYaw=Math.PI/2;lastTheme=-1;}
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
function disposeAvatar(a){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 a.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
async function selectAvatar(entry){
 const request=++avatarRequest;ready=false;$('play').disabled=true;$('play').textContent='LOADING YOUR CHIMP…';
 try{
 const next=await loadCharacter(import.meta.env.BASE_URL+entry.url,entry.bones||{});
 if(request!==avatarRequest){disposeAvatar(next);return;}
 if(avatar){characterLayer.remove(avatar.root);disposeAvatar(avatar);}
 avatar=next;avatar.root.rotation.y=yaw;characterLayer.add(avatar.root);ready=true;
 $('play').disabled=false;menu('menu');
 }catch(e){console.error(e);ready=!!avatar;$('play').disabled=!ready;$('play').textContent=ready?'LET’S JUMP':'MODEL UNAVAILABLE';$('description').textContent='Could not load this chimp. '+e.message;}
}
$('choose').onclick=()=>{
 const list=$('avatar-list');list.hidden=!list.hidden;list.replaceChildren();
 for(const entry of catalog){const b=document.createElement('button');b.className='avatar-option';b.textContent=entry.name;b.onclick=()=>selectAvatar(entry);list.append(b);}
};
fetch(import.meta.env.BASE_URL+'avatars.json').then(r=>{if(!r.ok)throw new Error('Avatar catalog unavailable');return r.json();})
.then(entries=>{catalog=entries;if(!entries.length)throw new Error('No avatars configured');return selectAvatar(entries[0]);})
.catch(e=>{$('description').textContent=e.message;$('play').textContent='RELOAD TO TRY AGAIN';console.error(e);});

function branch(p){
 const group=new THREE.Group();
 const material=p.type==='moving'?blue:p.type==='cracked'?crackMat:bark;
 const wood=new THREE.Mesh(branchGeo,material);wood.rotation.z=Math.PI/2;wood.scale.y=p.width;wood.position.y=-.2;group.add(wood);
 const top=new THREE.Mesh(mossGeo,p.type==='spring'?red:p.type==='moving'?blue:moss);top.scale.x=p.width;top.position.y=-.06;group.add(top);
 if(p.type==='cracked'){
  const split=new THREE.Mesh(mossGeo,trunkMaterial);split.scale.set(.055,1.1,1.02);split.rotation.z=.3;split.position.y=.015;group.add(split);
 }
 if(p.type==='spring'){
  const cap=new THREE.Mesh(leafGeo,red);cap.scale.set(.32,.17,.25);cap.position.set(0,.17,0);group.add(cap);
 }
 const coin=new THREE.Mesh(coinGeo,gold);coin.rotation.z=-.5;coin.position.set(0,.95,.15);group.add(coin);group.userData.coin=coin;
 world.add(group);return group;
}
function drawWorld(){
 const live=new Set(game.platforms.map(p=>p.id));
 for(const [id,m]of platformMeshes){if(!live.has(id)){world.remove(m);platformMeshes.delete(id);}}
 for(const p of game.platforms){
  let m=platformMeshes.get(p.id);if(!m){m=branch(p);platformMeshes.set(p.id,m);}
  m.position.set(p.x,p.y,0);m.visible=!p.broken;
  m.userData.coin.visible=p.coin;m.userData.coin.rotation.y=visualTime*1.8;
 }
 for(let i=0;i<trunks.length;i++)trunks[i].position.y=Math.floor((game.camera-12)/5)*5+i*5;
 for(let i=0;i<leaves.length;i++){
  const y=Math.floor((game.camera-10)/4)*4+(i>>1)*4;
  leaves[i].position.set((i%2?1:-1)*(1.7+Math.sin(i)*.1),y,-1.6);
  leaves[i].rotation.z=(i%2?1:-1)*.55;
 }
 const idx=Math.floor(game.time/30)%4, blend=Math.min((game.time%30)/1.5,1);
 const current=themes[idx],previousTheme=themes[(idx+3)%4],from=game.time<30?current:previousTheme;
 if(lastTheme!==idx){lastTheme=idx;$('theme').textContent=current.name;if(game.time>=30)toast(current.name);}
 const top=color.set(from.top).lerp(other.set(current.top),blend).getStyle();
 const bottom=color.set(from.bottom).lerp(other.set(current.bottom),blend).getStyle();
 $('world').style.background='linear-gradient('+top+','+bottom+')';
 moss.color.set(from.leaf).lerp(other.set(current.leaf),blend);
 trunkMaterial.color.set(from.bark).lerp(other.set(current.bark),blend);
 sun.color.set(from.light).lerp(other.set(current.light),blend);
}
function tick(dt,control=input()){
 if(mode!=='playing')return;
 if(control)targetYaw=control>0?Math.PI/2:-Math.PI/2;
 const distance=targetYaw-yaw;
 yaw+=Math.sign(distance)*Math.min(Math.abs(distance),Math.PI/0.1*dt);
 const events=game.step(control,dt);
 for(const e of events){if(e.type==='death'){sound('death');menu('over');}else if(e.type==='coin')sound('coin');else if(e.spring){sound('bounce');toast('Spring boost!');}}
}
function resize(){
 const w=innerWidth,h=innerHeight;renderer.setSize(w,h);
 const courtWidth=Math.min(w,h*10/16),courtHeight=courtWidth*16/10;
 renderer.setViewport((w-courtWidth)/2,(h-courtHeight)/2,courtWidth,courtHeight);
 camera.left=-5;camera.right=5;camera.top=8;camera.bottom=-8;
 camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();menu('menu');
renderer.setAnimationLoop(now=>{
 const raw=(now-previous)/1000;previous=now;const dt=Math.min(Math.max(raw,0),.05);
 if(raw>0.75&&mode==='playing')menu('paused');
 visualTime+=dt;
 if(mode==='playing'){acc+=dt;while(acc>=STEP){tick(STEP);acc-=STEP;if(mode!=='playing'){acc=0;break;}}}
 if(avatar){
  avatar.root.position.set(game.x,game.y,0);avatar.root.rotation.y=yaw;
  avatar.update(dt,visualTime,game.vy,game.bounceAge,mode==='playing');
 }
 camera.position.y=game.camera;
 drawWorld();syncUI();renderer.render(scene,camera);
});
window.chimpJump=()=>({ready,mode,x:game.x,y:game.y,vx:game.vx,vy:game.vy,height:game.height,bounces:game.bounces,time:game.time,theme:themes[Math.floor(game.time/30)%4].name,yaw,visible:!!avatar?.model.visible,bones:avatar?.boneCount||0,platformCount:game.platforms.length});
if(new URLSearchParams(location.search).has('test')){
 window.chimpJumpTest={step:(count,control=0)=>{for(let i=0;i<count;i++)tick(STEP,control);drawWorld();syncUI();},game:()=>game};
}
