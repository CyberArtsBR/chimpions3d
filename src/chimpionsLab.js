import * as THREE from 'three';
import {loadCharacter,disposeCharacter} from './character.js';
import './chimpionsLab.css';

const BASE=import.meta.env.BASE_URL;
document.body.dataset.mode='lab';
document.body.innerHTML=`
<div id="lab-world"></div><div id="lab-vignette"></div><div id="lab-crosshair"></div>
<header id="lab-hud">
  <div id="lab-title">CHIMPIONS LAB · CHIMPION DASH</div>
  <div class="lab-stat"><small>DISTANCE</small><strong id="lab-distance">0 m</strong></div>
  <div class="lab-stat"><small>BANANAS</small><strong id="lab-bananas">0</strong></div>
  <div class="lab-stat"><small>SCORE</small><strong id="lab-score">0</strong></div>
</header>
<aside id="lab-panel">
  <h1>Chimpions Lab<span>THIRD-PERSON MOTION + DASH TEST</span></h1>
  <p>Walk, run and jump with a real Chimpion GLB, then turn the motion test into a playable jungle dash.</p>
  <select id="lab-avatar" aria-label="Choose Chimpion"></select>
  <div class="lab-buttons">
    <button id="lab-start" class="primary">START CHIMPION DASH</button>
    <button id="lab-random">Random Chimpion</button>
    <a href="./">Back to Chimp Jump</a>
  </div>
  <p id="lab-help"><b>W / ↑</b> walk · <b>Shift</b> run · <b>A/D</b> steer · <b>Space</b> jump · Gamepad: left stick + A + RT</p>
  <div id="lab-message" role="status">Loading Chimpion…</div>
</aside>
<div id="lab-state">IDLE · 0.0 m/s</div>
<div id="lab-touch" aria-label="Touch controls">
  <button id="lab-left" aria-label="Move left">←</button>
  <button id="lab-run" class="wide" aria-label="Run forward">RUN</button>
  <button id="lab-walk" class="wide" aria-label="Walk forward">WALK</button>
  <button id="lab-jump" class="wide" aria-label="Jump">JUMP</button>
  <button id="lab-right" aria-label="Move right">→</button>
</div>
<div id="lab-gameover"><section><h2>RUN OVER</h2><p id="lab-result"></p><button id="lab-retry">RUN AGAIN</button></section></div>`;

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x739f8e);scene.fog=new THREE.Fog(0x739f8e,18,72);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,140);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;$('lab-world').append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdff5e8,0x193a2d,2.2));
const sun=new THREE.DirectionalLight(0xffe1a6,3.1);sun.position.set(-6,10,-4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-6;sun.shadow.camera.near=.5;sun.shadow.camera.far=36;sun.shadow.normalBias=.035;scene.add(sun,sun.target);

const trackMat=new THREE.MeshStandardMaterial({color:0x6f4a2f,roughness:.92});
const railMat=new THREE.MeshStandardMaterial({color:0x3d2c21,roughness:1});
const mossMat=new THREE.MeshStandardMaterial({color:0x56884b,roughness:.96});
const leafMat=new THREE.MeshStandardMaterial({color:0x2e724d,roughness:.9});
const dangerMat=new THREE.MeshStandardMaterial({color:0x8d3b27,roughness:.78});
const rockMat=new THREE.MeshStandardMaterial({color:0x657169,roughness:1});
const bananaMat=new THREE.MeshStandardMaterial({color:0xffca27,emissive:0x5e3600,emissiveIntensity:.2,roughness:.34});
const darkMat=new THREE.MeshStandardMaterial({color:0x33231b,roughness:1});
const trackGeo=new THREE.BoxGeometry(8.6,.22,12);
const railGeo=new THREE.CylinderGeometry(.08,.11,12,8);
const leafGeo=new THREE.IcosahedronGeometry(.8,1);
const logGeo=new THREE.CylinderGeometry(.38,.48,2.2,14,3);
const stumpGeo=new THREE.CylinderGeometry(.55,.68,1.3,14,3);
const rockGeo=new THREE.DodecahedronGeometry(.65,0);
const bananaGeo=new THREE.TorusGeometry(.22,.065,7,18,Math.PI*1.35);
const tipGeo=new THREE.SphereGeometry(.07,7,5);

const course=new THREE.Group();scene.add(course);
const trackSegments=[];
function makeSegment(index){
  const g=new THREE.Group(),floor=new THREE.Mesh(trackGeo,trackMat);floor.receiveShadow=true;g.add(floor);
  const moss=new THREE.Mesh(new THREE.BoxGeometry(8.7,.035,12),mossMat);moss.position.y=.125;moss.scale.x=.98;moss.material=mossMat;g.add(moss);
  for(const side of [-1,1]){
    const rail=new THREE.Mesh(railGeo,railMat);rail.rotation.x=Math.PI/2;rail.position.set(side*4.18,.45,0);rail.castShadow=true;g.add(rail);
    for(let j=0;j<5;j++){
      const cluster=new THREE.Group();cluster.position.set(side*(5.5+(j%2)*1.6),.8,(j-2)*2.6+(index%2));
      for(let k=0;k<3;k++){const leaf=new THREE.Mesh(leafGeo,leafMat);leaf.position.set((k-1)*.42,k*.35,Math.sin(k*2)*.3);leaf.scale.set(1.15,.8,1);cluster.add(leaf);}g.add(cluster);
    }
  }
  course.add(g);trackSegments.push(g);return g;
}
for(let i=0;i<11;i++)makeSegment(i);

let seed=(Date.now()>>>0)||1;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const laneX=[-2.45,0,2.45],obstacles=[],pickups=[];
function addBanana(x,z,y=.85){
  const group=new THREE.Group(),fruit=new THREE.Mesh(bananaGeo,bananaMat);fruit.rotation.z=-.45;fruit.castShadow=true;group.add(fruit);
  for(const side of [-1,1]){const tip=new THREE.Mesh(tipGeo,darkMat);tip.position.set(side*.18,.12,0);group.add(tip);}
  group.position.set(x,y,z);course.add(group);pickups.push({mesh:group,collected:false});
}
function addObstacle(lane,z,type=Math.floor(rand()*3)){
  const group=new THREE.Group();let height=.72;
  if(type===0){const log=new THREE.Mesh(logGeo,dangerMat);log.rotation.z=Math.PI/2;log.position.y=.4;log.castShadow=true;group.add(log);height=.85;}
  else if(type===1){const stump=new THREE.Mesh(stumpGeo,trackMat);stump.position.y=.65;stump.castShadow=true;group.add(stump);height=1.35;}
  else{for(const x of [-.38,.25]){const rock=new THREE.Mesh(rockGeo,rockMat);rock.position.set(x,.48,0);rock.scale.set(1,.75,1);rock.castShadow=true;group.add(rock);}height=.95;}
  group.position.set(laneX[lane],0,z);course.add(group);obstacles.push({mesh:group,height,hit:false});
}
let nextRow=18;
function spawnUntil(z){
  while(nextRow<z+78){
    const difficulty=Math.min(1,nextRow/350),gap=11-difficulty*2+rand()*3;
    nextRow+=gap;
    const first=Math.floor(rand()*3),double=difficulty>.38&&rand()<.28,blocked=new Set([first]);addObstacle(first,nextRow);
    if(double){let second=(first+1+(rand()<.5?0:1))%3;if(second===first)second=(second+1)%3;blocked.add(second);addObstacle(second,nextRow+.25,Math.floor(rand()*3));}
    const safe=[0,1,2].filter(i=>!blocked.has(i));const reward=safe[Math.floor(rand()*safe.length)];
    for(let i=0;i<4;i++)addBanana(laneX[reward],nextRow-3+i*1.45,.75+Math.sin(i/3*Math.PI)*.8);
  }
}
function cleanupBehind(z){
  for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].mesh.position.z<z-12){course.remove(obstacles[i].mesh);obstacles.splice(i,1);}
  for(let i=pickups.length-1;i>=0;i--)if(pickups[i].mesh.position.z<z-12){course.remove(pickups[i].mesh);pickups.splice(i,1);}
}

let avatar=null,rig={},rest=new Map(),catalog=[],loading=false;
function boneParts(name){
  const spaced=name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replace(/mixamorig\d*[:_ ]*/g,'').replace(/cc[_ ]*base[_ ]*/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const words=spaced.split(/\s+/),side=words.includes('left')||words.includes('l')?'left':words.includes('right')||words.includes('r')?'right':'';
  return {side,core:words.filter(w=>!['left','right','l','r','bone','def','bip','bip001'].includes(w)).join('')};
}
const aliases={hips:['hips','hip','pelvis'],spine:['spine','spine0','spine1','spine01'],chest:['chest','upperchest','spine2','spine02','spine3'],head:['head'],UpperArm:['upperarm','arm','uparm'],Forearm:['forearm','lowerarm','elbow'],Thigh:['thigh','upleg','upperleg'],Shin:['shin','calf','leg','lowerleg','knee'],Foot:['foot','ankle']};
function mapRig(model){
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});rig={};rest=new Map();
  const find=(key,side='')=>{
    const matches=bones.filter(b=>{const p=boneParts(b.name);return p.side===side&&(aliases[key]||[]).includes(p.core);});
    if(!matches.length)return null;
    if(key==='spine')return matches[0];if(key==='chest')return matches.at(-1);return matches[0];
  };
  rig.hips=find('hips');rig.spine=find('spine');rig.chest=find('chest');rig.head=find('head');
  for(const side of ['left','right'])for(const key of ['UpperArm','Forearm','Thigh','Shin','Foot'])rig[side+key]=find(key,side);
  for(const bone of bones)rest.set(bone,bone.quaternion.clone());
}
const poseQ=new THREE.Quaternion();
function poseBone(key,x=0,y=0,z=0,alpha=1){
  const bone=rig[key],base=bone&&rest.get(bone);if(!bone||!base)return;
  poseQ.setFromEuler(new THREE.Euler(x,y,z,'XYZ'));const target=base.clone().multiply(poseQ);bone.quaternion.slerp(target,alpha);
}
let animPhase=0,animTime=0;
function animateCharacter(dt,state,speed,vy){
  if(!avatar)return;animTime+=dt;const moving=state==='WALK'||state==='RUN',run=state==='RUN',gait=moving?Math.min(1,Math.abs(speed)/(run?7.2:3.2)):0;
  animPhase+=dt*(run?11:6.5)*Math.max(.25,gait);const swing=Math.sin(animPhase),breath=Math.sin(animTime*1.8),blend=1-Math.exp(-14*dt);
  poseBone('hips',run?.09*gait:0,swing*.03*gait,0,blend);poseBone('spine',(run?.10:0)+breath*.008,0,-swing*.035*gait,blend);poseBone('chest',breath*.008,0,swing*.025*gait,blend);poseBone('head',0,Math.sin(animTime*.55)*.018,0,blend);
  for(const [side,sign] of [['left',1],['right',-1]]){
    const cycle=swing*sign;
    if(state==='JUMP'){
      const tuck=Math.min(1,.3+Math.abs(vy)*.05);poseBone(side+'UpperArm',-.55,0,0,blend);poseBone(side+'Forearm',-.32,0,0,blend);poseBone(side+'Thigh',-.4*tuck,0,0,blend);poseBone(side+'Shin',.75*tuck,0,0,blend);poseBone(side+'Foot',-.25*tuck,0,0,blend);
    }else{
      poseBone(side+'UpperArm',cycle*(run?.62:.3)*gait,0,0,blend);poseBone(side+'Forearm',-.12-Math.max(0,cycle)*.28*gait,0,0,blend);poseBone(side+'Thigh',-cycle*(run?.78:.45)*gait,0,0,blend);poseBone(side+'Shin',.08+Math.max(0,-cycle)*(run?.9:.55)*gait,0,0,blend);poseBone(side+'Foot',-.04-Math.max(0,-cycle)*.16*gait,0,0,blend);
    }
  }
  avatar.model.updateWorldMatrix(true,true);
}
async function loadAvatar(entry){
  if(!entry?.url||loading)return;loading=true;$('lab-message').textContent='Loading '+entry.name+'…';$('lab-avatar').disabled=true;
  try{
    const next=await loadCharacter(BASE+entry.url);
    if(avatar){scene.remove(avatar.root);disposeCharacter(avatar);}avatar=next;avatar.root.scale.multiplyScalar(1.12);scene.add(avatar.root);mapRig(avatar.model);
    localStorage.setItem('chimpions-lab-avatar',entry.id);$('lab-message').textContent=entry.name+' · '+avatar.boneCount+' bones · ready';resetPlayerTransform();
  }catch(error){console.error(error);$('lab-message').textContent='This GLB could not be animated: '+error.message;}
  finally{loading=false;$('lab-avatar').disabled=false;}
}

const keys=new Set(),touch={left:false,right:false,walk:false,run:false};
let running=false,dead=false,grounded=true,vy=0,speed=0,distance=0,bananas=0,best=Number(localStorage.getItem('chimpions-lab-best'))||0,gameTime=0,lastA=false;
const player={x:0,y:0,z:0};
function resetPlayerTransform(){if(!avatar)return;avatar.root.position.set(player.x,player.y,player.z);avatar.root.rotation.y=0;}
function resetRun(){
  running=true;dead=false;grounded=true;vy=0;speed=0;distance=0;bananas=0;gameTime=0;player.x=player.y=player.z=0;seed=(Date.now()>>>0)||1;nextRow=18;
  for(const o of obstacles)course.remove(o.mesh);for(const b of pickups)course.remove(b.mesh);obstacles.length=pickups.length=0;spawnUntil(0);resetPlayerTransform();
  $('lab-panel').style.display='none';$('lab-gameover').classList.remove('open');
}
function finishRun(){
  if(dead)return;dead=true;running=false;speed=0;best=Math.max(best,Math.floor(distance));localStorage.setItem('chimpions-lab-best',best);
  const score=Math.floor(distance)+bananas*10;$('lab-result').textContent=`${Math.floor(distance)} m · ${bananas} bananas · ${score} points · best ${best} m`;$('lab-gameover').classList.add('open');
}
function jump(){if(!running||dead||!grounded)return;grounded=false;vy=5.7;}

addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyD','ArrowUp','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='Space'&&!e.repeat)jump();if(e.code==='Escape'){running=false;$('lab-panel').style.display='block';}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
function bindHold(id,key){const b=$(id);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch[key]=true;};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>touch[key]=false;}
bindHold('lab-left','left');bindHold('lab-right','right');bindHold('lab-walk','walk');bindHold('lab-run','run');$('lab-jump').onpointerdown=e=>{e.preventDefault();jump();};

function readGamepad(){
  const pads=[...(navigator.getGamepads?.()||[])].filter(Boolean);if(!pads.length)return {x:0,forward:0,run:false,a:false};const p=pads[0];
  const x=Math.abs(p.axes?.[0]||0)>.18?p.axes[0]:0,forward=Math.max(0,-(p.axes?.[1]||0));return{x,forward,run:(p.buttons?.[7]?.value||0)>.35||!!p.buttons?.[5]?.pressed,a:!!p.buttons?.[0]?.pressed};
}
function controls(){
  const pad=readGamepad();const left=keys.has('KeyA')||keys.has('ArrowLeft')||touch.left,right=keys.has('KeyD')||keys.has('ArrowRight')||touch.right;
  const keyboardForward=keys.has('KeyW')||keys.has('ArrowUp')||touch.walk||touch.run;const run=keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.run||pad.run;
  return{x:Math.max(-1,Math.min(1,Number(right)-Number(left)+pad.x)),forward:Math.max(keyboardForward?1:0,pad.forward),run,a:pad.a};
}

function updateTrack(){
  const base=Math.floor(player.z/12)*12;
  trackSegments.forEach((segment,i)=>{segment.position.z=base+(i-3)*12;});
}
function updateGame(dt){
  const c=controls();if(c.a&&!lastA)jump();lastA=c.a;if(!running||dead||!avatar)return;
  gameTime+=dt;const target=c.forward*(c.run?7.2:3.2);speed=THREE.MathUtils.damp(speed,target,8,dt);player.x+=c.x*4.4*dt;player.x=THREE.MathUtils.clamp(player.x,-3.25,3.25);player.z+=speed*dt;
  if(!grounded){vy-=12.5*dt;player.y+=vy*dt;if(player.y<=0){player.y=0;vy=0;grounded=true;}}
  distance=Math.max(distance,player.z);spawnUntil(player.z);cleanupBehind(player.z);updateTrack();
  for(const item of pickups){if(item.collected)continue;item.mesh.rotation.y+=dt*2.4;item.mesh.position.y+=Math.sin(gameTime*3+item.mesh.position.z)*.0015;if(Math.abs(item.mesh.position.z-player.z)<.65&&Math.abs(item.mesh.position.x-player.x)<.7&&Math.abs(item.mesh.position.y-(player.y+.8))<1.05){item.collected=true;item.mesh.visible=false;bananas++;}}
  for(const obstacle of obstacles){if(obstacle.hit)continue;if(Math.abs(obstacle.mesh.position.z-player.z)<.66&&Math.abs(obstacle.mesh.position.x-player.x)<.72&&player.y<obstacle.height-.1){obstacle.hit=true;finishRun();break;}}
  avatar.root.position.set(player.x,player.y,player.z);avatar.root.rotation.y=0;
  const state=!grounded?'JUMP':Math.abs(speed)<.08?'IDLE':c.run&&speed>4?'RUN':'WALK';animateCharacter(dt,state,speed,vy);
  $('lab-state').textContent=`${state} · ${Math.abs(speed).toFixed(1)} m/s`;
  $('lab-distance').textContent=Math.floor(distance)+' m';$('lab-bananas').textContent=bananas;$('lab-score').textContent=Math.floor(distance)+bananas*10;
}
function updateCamera(dt){
  const target=new THREE.Vector3(player.x*.28,3.05,player.z-6.6),look=new THREE.Vector3(player.x*.32,1.0+player.y*.22,player.z+5.8);
  camera.position.lerp(target,1-Math.exp(-5.5*dt));camera.lookAt(look);sun.position.set(player.x-6,player.z?10:10,player.z-4);sun.target.position.set(player.x,0,player.z+5);
}

$('lab-start').onclick=()=>{if(avatar)resetRun();};$('lab-retry').onclick=resetRun;
$('lab-random').onclick=()=>{if(!catalog.length)return;const entry=catalog[Math.floor(Math.random()*catalog.length)];$('lab-avatar').value=entry.id;loadAvatar(entry);};
$('lab-avatar').onchange=()=>loadAvatar(catalog.find(e=>e.id===$('lab-avatar').value));

fetch(BASE+'avatars.json').then(r=>r.json()).then(entries=>{
  catalog=entries.filter(e=>e.url);const select=$('lab-avatar');
  for(const entry of catalog){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option);}
  const saved=localStorage.getItem('chimpions-lab-avatar');const entry=catalog.find(e=>e.id===saved)||catalog.find(e=>e.id==='chimpion')||catalog[0];select.value=entry.id;return loadAvatar(entry);
}).catch(error=>{$('lab-message').textContent='Avatar catalog unavailable.';console.error(error);});

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.6));});
spawnUntil(0);updateTrack();camera.position.set(0,3,-6.5);
let previous=performance.now();renderer.setAnimationLoop(now=>{
  const dt=Math.min(.034,Math.max(0,(now-previous)/1000));previous=now;updateGame(dt);updateCamera(dt);renderer.render(scene,camera);
});
window.chimpionsLab=()=>({ready:!!avatar,running,dead,state:$('lab-state').textContent,distance,bananas,score:Math.floor(distance)+bananas*10,best,obstacles:obstacles.length,pickups:pickups.length,selected:$('lab-avatar').value});
