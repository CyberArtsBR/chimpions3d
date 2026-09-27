import * as THREE from 'three';
import {loadCharacter} from './character.js';
import {createScenery} from './scenery.js';
import {readLocalGLB} from './upload.js';
import {disposeCharacter} from './character.js';
import {Game,STEP,WIDTH,VIEW_HEIGHT,ITEM_SCALE,BANANA_HEIGHT,paceAt} from './physics.js';
import './game.css';
import {createPixelBackdrop} from './pixelBackdrop.js';
import {inputManager} from './InputManager.js';
import {RunSession} from './RunSession.js';
import {InputTrace} from './runtime/InputTrace.js';
import {installDiagnostics} from './Diagnostics.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createJetpack,animateJetpack} from './jetpackVisual.js';
import {leaderboard} from './leaderboard.js';
import {createResults,createRecordBook} from './results.js';
import {createFallSplash} from './fallSplash.js';
import {createAudio} from './audio.js';
import {filterBuiltInRoster} from './roster.js';
import {createJumpRenderPipeline} from './jumpRenderPipeline.js';
import {getJumpQualityProfile,nextJumpQualityProfile,resolveJumpQualityProfile} from './jumpRenderQuality.js';
import {assetRuntimeSnapshot,versionedAssetUrl} from './assetRuntime.js';

document.body.innerHTML=`
<div id="world"><div class="sun"></div><div class="rays"></div><div class="hill"></div><div class="hill two"></div><div class="mist"></div></div>
<header id="hud" aria-label="Run status"><div class="stat height-stat"><small>HEIGHT</small><strong id="height">0</strong> <em>m</em></div><div class="right"><div class="stat coins"><small>BANANAS</small><strong id="coins">0</strong></div><button id="mute" aria-label="Mute sound" aria-pressed="false" title="Audio">♪</button><button id="pause" aria-label="Pause game" aria-keyshortcuts="Escape P" title="Pause" hidden>Ⅱ</button></div></header>
<div class="court-edges" aria-hidden="true"><span>‹</span><span>›</span></div><div id="theme">Jungle Morning</div><div id="pace" role="status" aria-live="polite">PACE 1.06×</div><div id="canopy-event" role="status" aria-live="polite" aria-atomic="true" hidden></div>
<div id="menu-backdrop" aria-hidden="true"></div><div id="overlay"><section class="card"><div class="eyebrow" id="eyebrow">A little chimp. A big climb.</div><h1 id="title">CHIMP<br><span>JUMP</span></h1><p id="description">Read the branches. Time your landing.<br>Choose your route. Climb higher.</p><div class="branch-guide"><span>↔ Moving</span><span>╱ Fragile</span><span>↑ Spring</span><span>🍃 Leaf</span><span>◌ Vanish</span><span>⌁ Swing</span><span>Risk routes · bonus bananas</span></div><div id="avatar-list" hidden></div><div id="avatar-status" role="status"></div><button class="primary" id="play" disabled>LOADING YOUR CHIMP…</button><div class="best" id="best"></div><div class="avatar-actions"><button class="secondary" id="choose">Choose chimp</button><button class="secondary" id="upload">UPLOAD YOUR 3D CHARACTER (GLB)</button><input id="avatar-file" type="file" accept=".glb" hidden></div><div class="options"><button id="quality">Detail: High</button><button id="flip" hidden>Flip avatar facing</button></div><div class="keys"><b>←</b><b>→</b> or <b>A</b><b>D</b><span>Mouse / gamepad · auto jump</span></div><a class="secondary" id="rig-link" href="?rig=1">Rig laboratory</a><div class="gamepad-callout" aria-label="Jogue com seu Controle"><svg viewBox="0 0 96 58" aria-hidden="true"><path d="M27 12h42c9 0 14 7 17 17l5 17c2 8-7 13-13 8L65 44H31L18 54c-6 5-15 0-13-8l5-17c3-10 8-17 17-17Z"/><path class="pad-detail" d="M27 24v15M19.5 31.5h15M67 27h.1M77 35h.1M43 31h10"/></svg><span>Jogue com seu Controle</span></div></section></div>
<div id="touch" hidden><button class="touch" id="left" aria-label="Move left">←</button><button class="touch" id="right" aria-label="Move right">→</button></div>
<div id="toast" role="status"></div><div class="footer">CHIMP JUMP · CANOPY EDITION</div>`;
const $=id=>document.getElementById(id);
const countdown=document.createElement('div');countdown.id='countdown';countdown.hidden=true;countdown.setAttribute('aria-live','polite');document.body.append(countdown);
$('pace').hidden=true;
$('description').innerHTML='Read the branches. Time your landing.<br>Choose your route. Climb higher.';
document.querySelector('.gamepad-callout').setAttribute('aria-label','Play with a controller');
document.querySelector('.gamepad-callout span').textContent='Play with a controller';
const pixelBackdrop=createPixelBackdrop($('world'));
let pixelMode=new URLSearchParams(location.search).get('background')==='pixel';
const backdropButton=document.createElement('button');backdropButton.id='background-style';document.body.append(backdropButton);
function applyBackdrop(){document.body.classList.toggle('pixel-mode',pixelMode);pixelBackdrop.canvas.hidden=!pixelMode;scenery.setPixelMode(pixelMode);backdropButton.textContent=pixelMode?'Scenery: Pixel expedition':'Scenery: Golden forest';}
backdropButton.onclick=()=>{pixelMode=!pixelMode;applyBackdrop();};
const collectionDialog=document.createElement('dialog');collectionDialog.id='collection-dialog';
collectionDialog.setAttribute('aria-label','Choose your chimp');
collectionDialog.innerHTML='<header><h2>Choose your chimp</h2><button id="close-collection" aria-label="Close character selection">×</button></header>';
collectionDialog.append($('avatar-list'));document.body.append(collectionDialog);
const selectionActions=document.createElement('div');selectionActions.className='selection-actions';
selectionActions.innerHTML='<button id="random-chimpion">↻ Random & Play</button><div class="selected-copy"><p id="selected-chimpion" role="status"></p><small id="selected-chimpion-meta">Choose once to start immediately</small></div>';
collectionDialog.insertBefore(selectionActions,$('avatar-list'));
$('close-collection').onclick=()=>collectionDialog.close();
let collectionOpener=null;
collectionDialog.addEventListener('close',()=>{$('avatar-list').hidden=true;$('avatar-list').replaceChildren();const target=collectionOpener&&collectionOpener.isConnected&&collectionOpener.getClientRects().length?collectionOpener:($('choose').getClientRects().length?$('choose'):$('play'));collectionOpener=null;target?.focus();});
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-5,5,14,-2,0.1,60);camera.position.set(0,0,20);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);$('world').append(renderer.domElement);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const environmentGenerator=new THREE.PMREMGenerator(renderer),studio=new RoomEnvironment();
const studioMap=environmentGenerator.fromScene(studio,.04);scene.environment=studioMap.texture;scene.environmentIntensity=.38;studio.dispose();environmentGenerator.dispose();
scene.fog=new THREE.Fog(0x91b6a0,25,58);
const sun=new THREE.DirectionalLight(0xffefd1,2.4);sun.position.set(-5,9,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-7,right:7,top:10,bottom:-10,near:.5,far:35});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;scene.add(sun.target);
scene.add(sun,new THREE.HemisphereLight(0xe5eeeb,0x434133,1.3));
const rim=new THREE.DirectionalLight(0xeafcff,.8);rim.position.set(4,5,6);scene.add(rim);
const heroTarget=new THREE.Object3D();scene.add(heroTarget);
const heroLight=new THREE.DirectionalLight(0xfff4e7,2.6);heroLight.target=heroTarget;heroLight.layers.set(1);scene.add(heroLight);
const heroFill=new THREE.DirectionalLight(0xe7f3ff,1.05);heroFill.target=heroTarget;heroFill.layers.set(1);scene.add(heroFill);
const world=new THREE.Group();scene.add(world);
const scenery=createScenery(scene,renderer),fallSplash=createFallSplash(scene),deathBounds=new THREE.Box3();
const renderPipeline=createJumpRenderPipeline({renderer,scene,camera,sun,width:innerWidth,height:innerHeight});
function removeBranch(m){world.remove(m);m.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
function removeHazard(m){world.remove(m);m.userData.telegraph?.material?.dispose?.();}
const mobileProfile=()=>matchMedia('(pointer: coarse)').matches||innerWidth<=600;
let selectedQuality='high';
try{selectedQuality=resolveJumpQualityProfile(localStorage.getItem('chimp-jump-detail')||'high');}catch{}
let activeQualityName=mobileProfile()?'balanced':selectedQuality;
let activeQuality=getJumpQualityProfile(activeQualityName);
let highDetail=!!activeQuality.highScenery;
function quality(){
 activeQualityName=mobileProfile()?'balanced':selectedQuality;
 activeQuality=getJumpQualityProfile(activeQualityName);
 highDetail=!!activeQuality.highScenery;
 document.body.dataset.jumpQuality=activeQualityName;
 renderPipeline.applyQuality(activeQuality);
 scenery.setQuality(activeQuality,{constrained:mobileProfile()});
 $('quality').textContent='Detail: '+(mobileProfile()?'Balanced · Mobile':activeQuality.label+' · Desktop');
 $('quality').disabled=mobileProfile();
 resize();
}
$('quality').onclick=()=>{
 selectedQuality=nextJumpQualityProfile(selectedQuality);
 try{localStorage.setItem('chimp-jump-detail',selectedQuality);}catch{}
 quality();
};
const platformMeshes=new Map(),hazardMeshes=new Map(),characterLayer=new THREE.Group();scene.add(characterLayer);
const jetVisual=createJetpack(),jetEquipped=createJetpack();scene.add(jetVisual,jetEquipped);jetVisual.scale.setScalar(ITEM_SCALE);jetEquipped.scale.setScalar(ITEM_SCALE);jetVisual.visible=jetEquipped.visible=false;

const FACE_ANGLE=Math.PI/4;
let game=new Game(7),avatar,ready=false,mode='menu',yaw=FACE_ANGLE,targetYaw=FACE_ANGLE;
let themeAge=0,wrapShown=false,landingImpulse=0,boostZoom=1,lastIdleFrame=0,runSeed=7,cleanLandings=0,cleanPlatformIds=new Set(),nearMisses=0,encountersCompleted=0,riskLandings=0,lastHazardWarningAt=-Infinity;
let renderThemeIndex=0,renderNight=0,renderLanding=0,animationIntentX=0;
const animationSignals={
 landingImpact:0,landingQuality:'CLEAN',platformType:'',springActive:false,springStrength:1,
 hazardHit:false,hazardDirection:1,wrapEvent:null
};
function clearAnimationPulses(){
 animationSignals.landingImpact=0;animationSignals.springActive=false;
 animationSignals.hazardHit=false;animationSignals.wrapEvent=null;
}
function resetAnimationSignals(){
 clearAnimationPulses();animationSignals.landingQuality='CLEAN';animationSignals.platformType='';
 animationSignals.springStrength=1;animationSignals.hazardDirection=1;animationIntentX=0;
}
const hudCache=new Map();function hudText(id,value){value=String(value);if(hudCache.get(id)!==value){$(id).textContent=value;hudCache.set(id,value);}}
function pulseStat(id){const node=$(id)?.closest('.stat');if(!node||document.body.dataset.reducedMotion==='true')return;node.classList.remove('stat-pulse');void node.offsetWidth;node.classList.add('stat-pulse');}
const quickRetry=document.createElement('button');quickRetry.id='quick-retry';quickRetry.textContent='Try Again';quickRetry.hidden=true;document.body.append(quickRetry);
quickRetry.onclick=()=>{if(mode==='dying'&&deathAge>=.65){mode='over';quickRetry.hidden=true;start();}};
const hudBest=document.createElement('div');hudBest.className='stat';hudBest.innerHTML='<small>BEST</small><strong id="hud-best">0</strong><em> m</em>';$('hud').insertBefore(hudBest,$('hud').children[1]);
let visualTime=0,acc=0,previous=performance.now(),lastTheme=-1,introTime=3,countdownTime=0,autoPauseAfter=0;
let best=0,muted=false,audioContext,toastTimer,avatarRequest=0,avatarAbortController=null,catalog=[],collection=[],selectedId='';
const runSession=new RunSession({beginOnline:()=>leaderboard.begin()});
let pendingEntry=null,selectionConfirmed=false,runTicket=null,inputTrace=new InputTrace(),deathAge=0,deathPoint=null,splashed=false;
const results=createResults({retry:()=>start(),replay:seed=>start(seed),choose:()=>{selectionConfirmed=false;menu('menu');openSelection();},back:()=>{location.href='/';}}),recordBook=createRecordBook();
const giveUpButton=document.createElement('button');giveUpButton.id='give-up';giveUpButton.textContent='Give up';giveUpButton.hidden=true;document.querySelector('.card').append(giveUpButton);
const recordsButton=document.createElement('button');recordsButton.id='records-button';recordsButton.textContent='All-time records';recordsButton.onclick=()=>recordBook.open();document.querySelector('.card').append(recordsButton);
const music=new Audio(import.meta.env.BASE_URL+'audio/music-full.mp3');music.loop=true;music.volume=.4;music.preload='metadata';const audio=createAudio(music);
try{muted=localStorage.getItem('chimp-jump-muted')==='1';}catch{}audio.setMuted(muted);
addEventListener('chimp-record',()=>audio.play('record'));addEventListener('chimp-ui-nav',()=>audio.play('menu'));document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||mode==='playing')return;audio.play(button.matches('.primary,#confirm-chimpion,#try-again')?'confirm':/close|back|home/i.test((button.getAttribute('aria-label')||'')+' '+button.textContent)?'back':'menu');});
try{best=Number(localStorage.getItem('chimp-jump-best'))||0;}catch{}
const input=()=>inputManager.getMoveX({x:game.x,vx:game.vx});
inputManager.bindMouseSurface(renderer.domElement,e=>{
 if(mode!=='playing')return NaN;
 const court=Math.min(innerWidth,innerHeight*WIDTH/VIEW_HEIGHT);
 return Math.max(-WIDTH/2+.3,Math.min(WIDTH/2-.3,(e.clientX-innerWidth/2)/court*WIDTH));
});
const themes=[
 {name:'Jungle Morning',top:'#69bccb',bottom:'#d7e6b6',leaf:0x88ae57,bark:0x876047,light:0xffe9c8},
 {name:'Emerald Mist',top:'#328e9b',bottom:'#99d9c1',leaf:0x5aa884,bark:0x66574e,light:0xc9ffe8},
 {name:'Golden Canopy',top:'#df8c83',bottom:'#f4d2a0',leaf:0xb9a359,bark:0x90624c,light:0xffd1a3},
 {name:'Moonlit Grove',top:'#283d71',bottom:'#7787ae',leaf:0x5d8e9b,bark:0x595a71,light:0xc5dcff}
];
const color=new THREE.Color(),other=new THREE.Color();
const eventLabels={
 'banana-bloom':'BANANA BLOOM',
 'spring-fever':'SPRING FEVER'
};
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,1800);}
function sound(type){audio.play(type);}
function syncUI(){
 if(document.body.dataset.mode!==mode)document.body.dataset.mode=mode;$('pace').hidden=game.jetRemaining<=0;
 const boostLabel=game.jetRemaining>0?'JETPACK '+Math.ceil(game.jetRemaining)+'s':'';if($('pace').textContent!==boostLabel)$('pace').textContent=boostLabel;
 hudText('height',Math.floor(game.height));hudText('coins',game.bananas);hudText('hud-best',Math.floor(Math.max(best,game.height)));hudText('best','PERSONAL BEST  ·  '+Math.floor(best)+' m');
 const eventActive=mode==='playing'&&!!game.event;$('canopy-event').hidden=!eventActive;if(eventActive)$('canopy-event').textContent=eventLabels[game.event.type]||'CANOPY EVENT';
 $('pause').hidden=mode!=='playing';$('touch').hidden=mode!=='playing';$('rig-link').hidden=mode==='paused';recordsButton.hidden=mode==='paused';giveUpButton.hidden=mode!=='paused';$('overlay').hidden=['playing','dying','over','starting'].includes(mode);
 audio.setGameplayActive(mode==='playing'||mode==='starting');audio.setJetActive(mode==='playing'&&game.jetRemaining>0);
}
function menu(kind){
 if(collectionDialog.open)collectionDialog.close();mode=kind;music.pause();inputManager.clearGameplay();acc=0;
 $('avatar-list').hidden=true;$('choose').hidden=false;$('upload').hidden=kind==='paused';
 if(kind==='over'){
  $('eyebrow').textContent=game.height>best?'A new personal best!':'One more branch. One more try.';best=Math.max(best,game.height);try{localStorage.setItem('chimp-jump-best',String(best));}catch{}
  $('title').innerHTML=Math.floor(game.height)+'<span> m</span>';$('description').textContent=game.bananas+' bananas collected. Your next climb is waiting.';$('play').textContent='JUMP AGAIN';
 }else if(kind==='paused'){
  $('eyebrow').textContent='Take a breath';$('title').innerHTML='ON<br><span>A BRANCH</span>';$('description').textContent='Your climb is paused.';$('play').textContent='KEEP CLIMBING';$('choose').hidden=true;
 }else{
  $('eyebrow').textContent='A little chimp. A big climb.';$('title').innerHTML='CHIMP<br><span>JUMP</span>';$('description').innerHTML='Read the branches. Time your landing.<br>Choose your route. Climb higher.';$('play').textContent=ready?'LET’S JUMP':'LOADING YOUR CHIMP…';
 }
 syncUI();
 requestAnimationFrame(()=>{
  if(!inputManager.snapshot().connected)return;
  document.body.dataset.inputMode='controller';
  const target=kind==='paused'?document.getElementById('jump-resume'):kind==='menu'?$('play'):null;
  if(target&&!target.disabled&&!target.hidden)target.focus({preventScroll:true});
 });
 if(kind==='menu'&&ready)runSession.prepare();
}
function beginPlaying(){
 mode='playing';countdown.hidden=true;countdownTime=0;introTime=0;autoPauseAfter=performance.now()+1200;runSession.markPlaying();
 inputManager.clearGameplay();acc=0;previous=performance.now();syncUI();
}
function start(requestedSeed=null){
 if(requestedSeed instanceof Event)requestedSeed=null;
 if(!ready||['playing','starting','dying'].includes(mode)||results.isOpen||recordBook.isOpen)return;
 if(mode==='menu'&&!selectionConfirmed){openSelection();return;}audio.unlock();const fresh=mode!=='paused';
 if(fresh){
  mode='starting';syncUI();scenery.prepareRuntimeAssets();renderPipeline.prewarm?.();runTicket=null;inputTrace.reset();cleanLandings=0;cleanPlatformIds.clear();nearMisses=0;encountersCompleted=0;riskLandings=0;
  const replaySeed=requestedSeed===null||requestedSeed===undefined?null:(Number(requestedSeed)>>>0),session=runSession.commit({replaySeed});
  runTicket=session.ticket;
  if(session.practice)toast('Practice trail · same route, no online submission');
  else if(!session.online)toast('Playing offline · online records unavailable');
  for(const m of platformMeshes.values())removeBranch(m);platformMeshes.clear();for(const m of hazardMeshes.values())removeHazard(m);hazardMeshes.clear();scenery.reset();fallSplash.clear();quickRetry.hidden=true;landingImpulse=0;
  runSeed=session.seed;game.reset(runSeed);resetAnimationSignals();avatar.resetAnimation();avatar.root.visible=true;yaw=targetYaw=FACE_ANGLE;lastTheme=-1;lastHazardWarningAt=-Infinity;introTime=0;countdownTime=3;countdown.textContent='3';countdown.hidden=false;music.currentTime=0;deathPoint=null;splashed=false;
  music.muted=muted;music.play().catch(()=>{});inputManager.clearGameplay();acc=0;previous=performance.now();syncUI();return;
 }
 music.muted=muted;music.play().catch(()=>{});beginPlaying();
}
$('play').onclick=start;for(const event of ['pointerenter','focus','touchstart'])$('play').addEventListener(event,()=>scenery.prefetchRuntimeAssets(),{passive:true});$('pause').onclick=()=>menu('paused');giveUpButton.onclick=()=>{runSession.abandon();menu('menu');runSession.prepare();};
function syncMuteUI(){$('mute').style.opacity=muted?.5:1;$('mute').setAttribute('aria-label',muted?'Enable sound':'Mute sound');$('mute').setAttribute('aria-pressed',String(muted));}
$('mute').onclick=()=>{muted=!muted;audio.setMuted(muted);try{localStorage.setItem('chimp-jump-muted',muted?'1':'0');}catch{}syncMuteUI();if(!muted)sound('coin');};syncMuteUI();
// Menu/dialog gamepad navigation is owned exclusively by runtimeEnhancements.js.
 // Keeping a second menu subscriber here made one D-pad/stick edge move focus twice.
inputManager.subscribe(({confirmPressed})=>{
 if(mode==='dying'&&confirmPressed)quickRetry.click();
});
addEventListener('blur',()=>{if(mode==='playing'&&performance.now()>=autoPauseAfter)menu('paused');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing'&&performance.now()>=autoPauseAfter)menu('paused');});
for(const [id,dir]of [['left',-1],['right',1]])inputManager.bindTouchButton($(id),dir);
async function selectAvatar(entry){
 selectionConfirmed=false;
 const request=++avatarRequest;
 avatarAbortController?.abort();
 avatarAbortController=entry.buffer?null:new AbortController();
 const signal=avatarAbortController?.signal;
 ready=false;$('play').disabled=true;$('play').textContent='LOADING YOUR CHIMP…';$('avatar-status').textContent='Preparing pose and checking skeleton…';
 try{
  const source=entry.buffer||versionedAssetUrl(import.meta.env.BASE_URL+entry.url,entry.assetHash);
  const next=await loadCharacter(source,entry.bones||{},{signal});
  if(request!==avatarRequest){disposeCharacter(next);return;}
  if(avatar){characterLayer.remove(avatar.root);disposeCharacter(avatar);}for(const m of platformMeshes.values())removeBranch(m);platformMeshes.clear();scenery.reset();game.reset(7);lastTheme=-1;
  avatar=next;avatar.model.traverse(o=>{if(o.isMesh)o.layers.enable(1);});selectedId=entry.id||'';avatar.root.scale.multiplyScalar(1.3);avatar.root.rotation.y=yaw;characterLayer.add(avatar.root);ready=true;
  $('play').disabled=false;menu('menu');$('avatar-status').textContent=entry.name+' · '+avatar.boneCount+' bones'+(entry.buffer?' · local file':'');return true;
 }catch(e){
  if(request!==avatarRequest||e?.name==='AbortError')return false;
  console.warn('Avatar rejected:',e.message);ready=!!avatar;$('play').disabled=!ready;$('play').textContent=ready?'LET’S JUMP':'MODEL UNAVAILABLE';$('avatar-status').textContent=e.message+(ready?' Your previous avatar is still ready.':'');return false;
 }
}
function chooseLocalAvatar(){$('avatar-file').click();}
$('upload').onclick=chooseLocalAvatar;
$('avatar-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const buffer=await readLocalGLB(file);const loaded=await selectAvatar({id:'local-custom',name:file.name.replace(/\.glb$/i,''),buffer,local:true});if(loaded){selectionConfirmed=true;$('play').textContent='LET’S JUMP';}}catch(error){$('avatar-status').textContent=error.message;}};
$('flip').remove();let collectionPage=0,collectionQuery='';
const selectedPreview=document.createElement('div');selectedPreview.id='selected-preview';selectionActions.prepend(selectedPreview);
function randomEntry(){const entries=catalog.filter(e=>e.url);const pool=entries.length?entries:catalog;return pool[Math.floor(Math.random()*pool.length)];}
function appendPortrait(container,entry,imageUrl){
 const fallback=document.createElement('span');fallback.className='preview-monogram';fallback.setAttribute('aria-hidden','true');
 fallback.textContent=(entry.name||'?').replace(/^The /,'').split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();container.append(fallback);
 if(!imageUrl)return;
 const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.hidden=true;
 img.onload=()=>{fallback.remove();img.hidden=false;};img.onerror=()=>img.remove();container.append(img);img.src=imageUrl;
}
function showPending(){
 if(!pendingEntry)return;const metadata=collection.find(e=>e.id===pendingEntry.id||e.name===pendingEntry.name)||pendingEntry;selectedPreview.replaceChildren();
 appendPortrait(selectedPreview,pendingEntry,metadata.image||pendingEntry.image);
 $('selected-chimpion').textContent=pendingEntry.name;
 const meta=[metadata.tribe,metadata.id?'#'+metadata.id:null,pendingEntry.url?'Playable now':'Preview only'].filter(Boolean).join(' · ');$('selected-chimpion-meta').textContent=meta||'Choose once to start immediately';
}
let selectionLaunchBusy=false;
async function launchPending(entry=pendingEntry){
 if(!entry||selectionLaunchBusy||!entry.url)return;
 selectionLaunchBusy=true;pendingEntry=entry;showPending();
 $('random-chimpion').disabled=true;
 collectionDialog.close();
 const loaded=entry.id===selectedId&&ready||await selectAvatar(entry);
 $('random-chimpion').disabled=false;selectionLaunchBusy=false;
 if(loaded){selectionConfirmed=true;start();}
 else{selectionConfirmed=false;openSelection();}
}
$('random-chimpion').onclick=()=>{const entry=randomEntry();collectionQuery='';collectionPage=Math.max(0,Math.floor(catalog.findIndex(e=>e.id===entry?.id)/12));launchPending(entry);};
function renderCollection(){
 const list=$('avatar-list');list.replaceChildren();const search=document.createElement('input');search.type='search';search.placeholder='Search chimp name';search.setAttribute('aria-label','Search characters');search.value=collectionQuery;
 search.oninput=()=>{collectionQuery=search.value;collectionPage=0;renderCollection();const field=list.querySelector('input');field.focus();};list.append(search);
 const entries=[...catalog,...collection.filter(c=>!catalog.some(a=>a.id===c.id))].filter(c=>c.name.toLowerCase().includes(collectionQuery.toLowerCase()));const pages=Math.max(1,Math.ceil(entries.length/12));collectionPage=Math.min(collectionPage,pages-1);const grid=document.createElement('div');grid.className='avatar-grid';
 for(const entry of entries.slice(collectionPage*12,collectionPage*12+12)){
  const button=document.createElement('button');button.className='avatar-option';button.disabled=!entry.url;button.setAttribute('aria-label',entry.name+(entry.url?'':entry.unavailable?' · Rig needs correction':' · GLB coming soon'));button.setAttribute('aria-pressed',String(pendingEntry?.id===entry.id));
  const portrait=document.createElement('span');portrait.className='avatar-portrait';appendPortrait(portrait,entry,entry.image);button.append(portrait);
  const name=document.createElement('strong');name.textContent=entry.name;button.append(name);const status=document.createElement('small');status.textContent=entry.url?(pendingEntry?.id===entry.id?'Selected':'Select'):(entry.unavailable?'Rig needs correction':'GLB coming soon');button.title=entry.unavailable||entry.name;button.append(status);
  button.onclick=()=>{pendingEntry=entry;showPending();for(const option of grid.querySelectorAll('.avatar-option'))option.setAttribute('aria-pressed',String(option===button));launchPending(entry);};grid.append(button);
 }
 const uploadAction=document.createElement('button');uploadAction.type='button';uploadAction.className='avatar-upload-option';uploadAction.textContent='UPLOAD YOUR 3D CHARACTER (GLB)';uploadAction.setAttribute('aria-label','UPLOAD YOUR 3D CHARACTER (GLB)');uploadAction.onclick=chooseLocalAvatar;grid.append(uploadAction);
 list.append(grid);const nav=document.createElement('div');nav.className='collection-nav';
 for(const [label,direction]of [['Previous',-1],['Next',1]]){const button=document.createElement('button');button.textContent=label;button.disabled=direction<0?collectionPage===0:collectionPage===pages-1;button.onclick=()=>{collectionPage+=direction;renderCollection();};nav.append(button);}
 const count=document.createElement('span');count.textContent=(collectionPage+1)+' / '+pages+' · '+entries.length+' chimps';nav.append(count);list.append(nav);
}
async function openSelection(){
 if(collectionDialog.open||!catalog.length)return;collectionOpener=document.activeElement?.getClientRects?.().length?document.activeElement:null;pendingEntry=catalog.find(entry=>entry.id===selectedId)||randomEntry();showPending();collectionQuery='';collectionPage=Math.max(0,Math.floor(catalog.findIndex(e=>e.id===pendingEntry.id)/12));
 const list=$('avatar-list');list.hidden=false;collectionDialog.showModal();if(!collection.length)try{const response=await fetch(import.meta.env.BASE_URL+'characters.json');if(!response.ok)throw new Error();collection=filterBuiltInRoster(await response.json());}catch{toast('Collection unavailable. Your chimp is ready.');}
 if(collectionDialog.open){showPending();renderCollection();list.querySelector('input')?.focus();}
}
$('choose').onclick=()=>{selectionConfirmed=false;openSelection();};
fetch(import.meta.env.BASE_URL+'avatars.json').then(r=>{if(!r.ok)throw new Error('Avatar catalog unavailable');return r.json();}).then(entries=>{catalog=filterBuiltInRoster(entries);if(catalog.length!==10)throw new Error('Expected exactly 10 approved built-in Chimpions');pendingEntry=randomEntry();return selectAvatar(pendingEntry);}).catch(e=>{$('description').textContent=e.message;$('play').textContent='RELOAD TO TRY AGAIN';console.error(e);});

function drawWorld(dt=0){
 jetVisual.visible=!!game.jetpack;if(game.jetpack){jetVisual.position.set(game.jetpack.x,game.jetpack.y+Math.sin(visualTime*2)*.08,.6);jetVisual.rotation.y=Math.sin(visualTime*.9)*.45;}animateJetpack(jetVisual,visualTime,false);animateJetpack(jetEquipped,visualTime,true);
 jetEquipped.visible=game.jetRemaining>0;jetEquipped.position.set(game.x,game.y+.55,-.25);jetEquipped.rotation.y=yaw;if(game.jetRemaining>0)scenery.jetTrail(game.x,game.y,visualTime);
 const live=new Set(game.platforms.map(p=>p.id));for(const [id,m]of platformMeshes){if(!live.has(id)){removeBranch(m);platformMeshes.delete(id);}}
 for(const p of game.platforms){
  let m=platformMeshes.get(p.id);if(m&&m.userData.fragile!==!!p.fragile){removeBranch(m);platformMeshes.delete(p.id);m=null;}if(!m){m=scenery.branch(p);world.add(m);platformMeshes.set(p.id,m);}
  m.position.set(p.x,p.y,0);m.visible=!p.broken&&Math.abs(p.y-game.camera)<VIEW_HEIGHT+2;if(m.visible)scenery.animateBranch(m,p,visualTime);m.userData.coin.visible=p.coin;m.userData.coin.rotation.y=visualTime*1.2;m.userData.coin.position.y=BANANA_HEIGHT+Math.sin(visualTime*2+p.id)*.07;
 }
 const liveHazards=new Set(game.hazards.map(h=>h.id));for(const [id,m]of hazardMeshes){if(!liveHazards.has(id)){removeHazard(m);hazardMeshes.delete(id);}}
 for(const h of game.hazards){let m=hazardMeshes.get(h.id);if(!m){m=scenery.hazard(h);world.add(m);hazardMeshes.set(h.id,m);}m.visible=Math.abs(h.y-game.camera)<VIEW_HEIGHT+2;if(m.visible)scenery.animateHazard(m,h,visualTime);}
 if(mode==='playing'&&game.hazardCooldown<=0&&game.time-lastHazardWarningAt>1.6){const threat=game.hazards.find(h=>h.y>game.y+.45&&h.y<game.y+2.5&&Math.abs(h.x-game.x)<1.15);if(threat){lastHazardWarningAt=game.time;sound('hazard-warning');}}
 const idx=Math.floor(game.time/30)%4,blend=THREE.MathUtils.smoothstep(game.time%30,0,4);if(pixelMode)pixelBackdrop.draw(idx,game.time<30?1:blend);
 const current=themes[idx],previousTheme=themes[(idx+3)%4],from=game.time<30?current:previousTheme;if(lastTheme!==idx){lastTheme=idx;themeAge=0;$('theme').textContent=current.name;}if(mode==='playing')themeAge+=dt;
 $('theme').style.opacity=mode==='playing'?String(Math.max(0,Math.min(1,4-themeAge))):'0';const top=color.set(from.top).lerp(other.set(current.top),blend).getStyle(),bottom=color.set(from.bottom).lerp(other.set(current.bottom),blend).getStyle();$('world').style.background='linear-gradient('+top+','+bottom+')';
 const palette=color.set(from.bottom).lerp(other.set(current.bottom),blend).clone();scene.fog.color.copy(palette);const night=THREE.MathUtils.lerp(from===themes[3]?1:0,idx===3?1:0,blend);renderThemeIndex=idx;renderNight=night;
 const climb=Math.min(1,game.height/260);scene.fog.near=25-climb*3.5;scene.fog.far=58-climb*7;sun.intensity=2.25+climb*.55+(game.event?.type==='banana-bloom' ? .18 : 0);heroLight.intensity=2.5+climb*.35;heroFill.intensity=1+night*.32;
 audio.setIntensity(Math.min(1,game.time/150+(game.event ? .12 : 0)));
 scenery.update(game.camera,visualTime,dt,palette,night,idx,game.time<30?1:blend);$('world').classList.toggle('night',night>.5);$('world').style.setProperty('--night-strength',night);sun.color.set(from.light).lerp(other.set(current.light),blend);
}
function tick(dt,control=input()){
 if(mode!=='playing')return;control=inputTrace.append(control);animationIntentX=control;
 const reducedMotion=document.body.dataset.reducedMotion==='true';
 const preStepVy=game.vy,preStepVx=game.vx;
 if(control)targetYaw=control>0?FACE_ANGLE:-FACE_ANGLE;const distance=targetYaw-yaw;if(reducedMotion)yaw=targetYaw;else yaw+=Math.sign(distance)*Math.min(Math.abs(distance),Math.PI/0.28*dt);
 const events=game.step(control,dt);
 for(const e of events){
  scenery.burst(e);
  if(e.type==='death'){
   music.pause();mode='dying';deathAge=0;splashed=false;best=Math.max(best,game.height);try{localStorage.setItem('chimp-jump-best',String(best));}catch{}
   // The physics marks death only after the fall crosses the lower camera boundary. Keep the
   // exact current position and real-time vertical speed: no teleport, no acceleration, no pose.
   deathPoint={x:game.x,visualY:game.y,velocity:Math.min(-.1,game.vy*paceAt(game.time))};
   runSession.finish();runSession.prepare();
   inputManager.clearGameplay();avatar.root.visible=true;syncUI();
  }else if(e.type==='wrap'){animationSignals.wrapEvent=e.side==='left'?-1:1;sound('wrap');if(!wrapShown){wrapShown=true;toast('CROSS THE EDGE TO WRAP AROUND');}}
  else if(e.type==='coin'){sound('coin');pulseStat('coins');if(e.bloom)toast('BANANA BLOOM · BONUS +1');}
  else if(e.type==='jet'){sound('jet');toast('JETPACK · '+Math.ceil(e.duration||game.jetRemaining)+' seconds!');}
  else if(e.type==='jet-end'){sound('jet-end');toast('JETPACK COMPLETE');}
  else if(e.type==='jet-spawn')toast(e.route==='reward'?'JETPACK · REWARD ROUTE':'JETPACK NEARBY · LOOK AHEAD');
  else if(e.type==='hazard-telegraph'){sound('event');const hazardCopy={'swinging-pod':'SWINGING POD · WATCH THE ARC','vine-sweep':'VINE SWEEP · READ THE OPENING','falling-fruit':'FALLING FRUIT · MOVE ON THE SHAKE'}[e.hazardType];if(hazardCopy)toast(hazardCopy);}
  else if(e.type==='hazard-active'){}
  else if(e.type==='near-miss'){nearMisses++;if(nearMisses===1||nearMisses%5===0)toast('NEAR MISS · '+nearMisses);}
  else if(e.type==='hazard'){animationSignals.hazardHit=true;animationSignals.hazardDirection=Math.sign(game.vx-preStepVx)||1;sound('hazard');landingImpulse=reducedMotion?0:.04;const hazardName={'thorn-pod':'THORN POD','swinging-pod':'SWINGING POD','vine-sweep':'VINE SWEEP','falling-fruit':'FALLING FRUIT'}[e.hazardType]||'HAZARD';toast(hazardName+' · KNOCKBACK');}
  else if(e.type==='vanish'){sound('vanish');}
  else if(e.type==='milestone'){sound('milestone');pulseStat('height');toast(e.meters+' M · CANOPY MILESTONE');}
  else if(e.type==='event-start'){sound('event');const copy=e.eventType==='banana-bloom'?'BANANA BLOOM · BONUS FRUIT':e.eventType==='spring-fever'?'SPRING FEVER · BOOSTED MUSHROOMS':'CANOPY EVENT';toast(copy);}
  else if(e.type==='event-end'){sound('event-out');toast('CANOPY EVENT COMPLETE');}
  else if(e.type==='bounce'){
   const impact=Math.max(.45,Math.min(1,Math.max(0,-preStepVy)/12));
   animationSignals.landingImpact=impact;
   animationSignals.landingQuality=impact>.88?'HARD':impact>.70?'EDGE':'CLEAN';
   animationSignals.platformType=e.platformType||'';
   animationSignals.springActive=!!e.spring;
   animationSignals.springStrength=e.spring?(game.event?.type==='spring-fever'?1:.92):1;
   const branchSound=e.spring?'spring':e.fragile?'fragile':e.platformType==='moving'?'moving':e.platformType==='leaf'?'leaf':e.platformType==='swing'?'swing':e.platformType==='vanish'?'vanish-warning':'bounce';sound(branchSound);
   if(!['spring','cracked','vanish'].includes(e.platformType)&&!cleanPlatformIds.has(e.platformId)){cleanPlatformIds.add(e.platformId);cleanLandings++;}
   if(e.route==='reward'||e.route==='risk')riskLandings++;
   landingImpulse=reducedMotion?0:(e.spring ? .045 : .03);const branch=platformMeshes.get(e.platformId);if(branch)branch.userData.impactAt=visualTime;
   if(e.spring){boostZoom=reducedMotion?1:.91;toast(game.event?.type==='spring-fever'?'SPRING FEVER BOOST!':'Spring boost!');}
   else if(e.platformType==='vanish')toast('VANISH BRANCH · MOVE!');
  }else if(e.type==='encounter-complete'){encountersCompleted++;if(encountersCompleted===1||encountersCompleted%4===0)toast('ENCOUNTER CLEAR · '+encountersCompleted);}
 }
}
function updateEnding(dt){
 fallSplash.update(dt);results.update(dt);if(mode!=='dying')return;deathAge+=dt;if(deathPoint)deathPoint.visualY+=deathPoint.velocity*dt;quickRetry.hidden=deathAge<.65;
 if(deathAge>=2){quickRetry.hidden=true;avatar.root.visible=false;mode='over';best=Math.max(best,game.height);try{localStorage.setItem('chimp-jump-best',String(best));}catch{}const transport=inputTrace.toTransport();const summary={id:transport.overflowed?undefined:runTicket?.id,trace:transport,meters:Math.floor(game.height),bananas:game.bananas,best,seed:runSeed,cleanLandings,nearMisses,encountersCompleted,riskLandings};window.dispatchEvent(new CustomEvent('chimp-run-finished',{detail:summary}));results.open(summary);syncUI();}
}
function resize(){
 const w=innerWidth,h=innerHeight;renderer.setSize(w,h);const courtWidth=Math.min(w,h*WIDTH/VIEW_HEIGHT),viewWidth=w/courtWidth*WIDTH,viewHeight=h/courtWidth*WIDTH;renderer.setViewport(0,0,w,h);camera.left=-viewWidth/2;camera.right=viewWidth/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();renderPipeline.resize(w,h);scenery.resize(viewWidth,viewHeight);document.documentElement.style.setProperty('--court',courtWidth+'px');if(mode==='playing'&&performance.now()>=autoPauseAfter)menu('paused');previous=performance.now();
}
addEventListener('resize',quality);quality();applyBackdrop();menu('menu');
function renderFrame(now){if(document.hidden){previous=now;return;}if(!['starting','playing','dying'].includes(mode)&&now-lastIdleFrame<1000/20)return;lastIdleFrame=now;
 const raw=(now-previous)/1000;previous=now;const dt=Math.min(Math.max(raw,0),.05);if(raw>0.75&&mode==='playing'&&performance.now()>=autoPauseAfter)menu('paused');if(['starting','playing','dying'].includes(mode))visualTime+=dt;updateEnding(dt);
 if(mode==='starting'){countdownTime=Math.max(0,countdownTime-dt);const n=Math.max(0,Math.ceil(countdownTime/.75)-1);countdown.textContent=String(n);if(countdownTime<=0)beginPlaying();}
 if(mode==='menu'&&document.body.classList.contains('jump-start-screen')){syncUI();return;}
 if(mode==='playing'){acc+=dt;while(acc>=STEP){tick(STEP);acc-=STEP;if(mode!=='playing'){acc=0;break;}}}
 if(avatar){
  avatar.root.position.set(game.x,mode==='dying'?deathPoint.visualY:game.y,0);avatar.root.rotation.y=yaw;avatar.root.rotation.z=0;
  heroLight.position.set(game.x+2.4,avatar.root.position.y+4.5,7);heroFill.position.set(game.x-3,avatar.root.position.y+2,5);heroTarget.position.set(game.x,avatar.root.position.y+1,0);
  renderLanding=0;
  if(mode==='playing'||mode==='dying'){
   let landing=0,landingPlatformType=animationSignals.platformType;
   if(mode==='playing'&&game.vy<0){
    let nearestTime=Infinity;
    for(const p of game.platforms)if(!p.broken&&p.y<=game.y&&Math.abs(p.x-game.x)<p.width/2+.4){
     const time=(game.y-p.y)/Math.max(1,-game.vy);
     landing=Math.max(landing,1-time/.18);
     if(time<nearestTime){nearestTime=time;landingPlatformType=p.type||landingPlatformType;}
    }
   }
   renderLanding=landing;
   avatar.updateAnimation(dt,visualTime,{
    active:mode==='playing',velocityY:mode==='dying'?(deathPoint?.velocity??game.vy):game.vy,
    velocityX:game.vx,intentX:animationIntentX,bounceAge:game.bounceAge,
    landingAnticipation:landing,landingImpact:animationSignals.landingImpact,
    landingQuality:animationSignals.landingQuality,platformType:landingPlatformType,
    springActive:animationSignals.springActive,springStrength:animationSignals.springStrength,
    hazardHit:animationSignals.hazardHit,hazardDirection:animationSignals.hazardDirection,
    wrapEvent:animationSignals.wrapEvent,jetpackActive:mode==='playing'&&game.jetRemaining>0,
    jetpackStrength:game.jetRemaining>0?1:0,dying:mode==='dying',
    reducedMotion:document.body.dataset.reducedMotion==='true'
   });
   for(const event of avatar.consumeAnimationEvents())window.dispatchEvent(new CustomEvent('chimp-character-animation',{detail:event}));
   clearAnimationPulses();
  }
  if(mode==='dying'&&!splashed){
   avatar.root.updateWorldMatrix(true,true);deathBounds.setFromObject(avatar.root,true);const bottom=camera.position.y+camera.bottom/camera.zoom;
   if(deathBounds.max.y<bottom){splashed=true;window.dispatchEvent(new CustomEvent('chimp-death-offscreen',{detail:{x:deathPoint.x,y:bottom+.12}}));}
  }
 }
 if(mode==='playing'&&introTime<1.35)introTime=Math.min(1.35,introTime+dt);const intro=THREE.MathUtils.smoothstep(introTime,0,1.35),reducedMotion=document.body.dataset.reducedMotion==='true';boostZoom=THREE.MathUtils.damp(boostZoom,reducedMotion?1:game.jetRemaining>0?.93:1,3,dt);landingImpulse=reducedMotion?0:landingImpulse*Math.exp(-18*dt);
 if(mode!=='dying'&&mode!=='over'){const startZoom=2.08;camera.zoom=reducedMotion?1:THREE.MathUtils.lerp(startZoom,boostZoom,intro);camera.position.y=(reducedMotion?game.camera:THREE.MathUtils.lerp(game.y+1.05,game.camera,intro)+landingImpulse);camera.updateProjectionMatrix();}
 sun.position.set(-5,game.camera+9,12);sun.target.position.set(0,game.camera,0);drawWorld(dt);syncUI();
 let contactGround=null;
 for(const p of game.platforms){
  if(p.broken||p.y>game.y+.35||Math.abs(p.x-game.x)>p.width/2+.48)continue;
  if(contactGround===null||p.y>contactGround)contactGround=p.y;
 }
 renderPipeline.updateFrame({
  mode,themeIndex:renderThemeIndex,night:renderNight,time:visualTime,
  reducedMotion:document.body.dataset.reducedMotion==='true',fogColor:scene.fog.color,
  playerX:game.x,playerY:avatar?.root.position.y??game.y,groundY:contactGround,landing:renderLanding
 });
 renderPipeline.render(dt);
}
renderer.setAnimationLoop(renderFrame);
const runtimeSnapshot=()=>({ready:ready&&document.body.dataset.uiReady==='true',characterReady:ready,uiReady:document.body.dataset.uiReady==='true',menuReady:document.body.dataset.menuReady==='true',animationState:avatar?.animationState||null,secondaryBones:avatar?.secondaryBoneCount||0,mode,countdown:mode==='starting'?Math.max(0,Math.ceil(countdownTime/.75)-1):null,runSeed,runSession:runSession.state,onlineSubmitCapable:runSession.onlineSubmitCapable,cleanLandings,reducedMotion:document.body.dataset.reducedMotion==='true',jetRemaining:game.jetRemaining,event:game.event?.type||null,hazardCount:game.hazards.length,platformTypes:[...new Set(game.platforms.map(p=>p.type))],muted,musicPaused:music.paused,musicTime:music.currentTime,musicDuration:music.duration,musicVolume:music.volume,musicPlaybackRate:music.playbackRate,musicMuted:music.muted,cameraZoom:camera.zoom,pixelMode,courtWidth:WIDTH,selectedId,platformReady:scenery.platformReady,backgroundReady:scenery.backgroundReady,treeVisible:scenery.treeVisible,treeClimbOffset:scenery.treeClimbOffset,...scenery.treeScrollDiagnostics,characterScale:avatar?.root.scale.x||0,authoredBranches:[...platformMeshes.values()].filter(m=>m.getObjectByName('authored-branch')?.visible).length,x:game.x,y:game.y,vx:game.vx,vy:game.vy,height:game.height,bounces:game.bounces,time:game.time,theme:themes[Math.floor(game.time/30)%4].name,biome:themes[Math.floor(game.time/30)%4].name,yaw,visible:!!avatar?.model.visible,bones:avatar?.boneCount||0,platformCount:game.platforms.length,visibleBranches:[...platformMeshes.values()].filter(m=>m.parent===world&&m.visible).length,visibleHazards:[...hazardMeshes.values()].filter(m=>m.parent===world&&m.visible).length,pace:paceAt(game.time),quality:activeQualityName,qualitySettings:activeQuality,...renderPipeline.getDiagnostics(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length||0,pooledBranches:scenery.pooledBranches,assetTelemetry:assetRuntimeSnapshot(),controller:inputManager.snapshot(),diagnosticsVersion:2});
const diagnostics=installDiagnostics(window,runtimeSnapshot);
Object.defineProperty(window,'chimpJump',{value:()=>diagnostics.snapshot(),writable:false,configurable:false});
const testApiEnabled=(import.meta.env.DEV||import.meta.env.VITE_CHIMP_QA_HOOKS==='1')&&['localhost','127.0.0.1'].includes(location.hostname);
if(testApiEnabled&&new URLSearchParams(location.search).has('test')){
 window.chimpJumpTest={avatarIds:()=>catalog.map(entry=>entry.id),burst:type=>scenery.burst({type,x:game.x,y:game.y,platformType:type}),startRun:()=>{selectionConfirmed=true;start();},setQuality:name=>{selectedQuality=resolveJumpQualityProfile(name);quality();return activeQualityName;},advanceCountdown:seconds=>{if(mode!=='starting')return;countdownTime=Math.max(0,countdownTime-Math.max(0,Number(seconds)||0));if(countdownTime<=0){beginPlaying();return;}countdown.textContent=countdownTime<=.75?'GO':String(Math.max(1,Math.ceil(countdownTime/.75)-1));},finishCountdown:()=>{if(mode==='starting')beginPlaying();},settleIntro:()=>{introTime=1.35;},stepInput:count=>{for(let i=0;i<count;i++)tick(STEP,input());drawWorld();syncUI();previous=performance.now();},suspendRendering:()=>renderer.setAnimationLoop(null),resumeRendering:()=>{previous=performance.now();renderer.setAnimationLoop(renderFrame);},render:()=>{previous=performance.now();renderFrame(previous);},renderStep:(seconds=STEP)=>{const now=performance.now();previous=now-Math.max(.001,Number(seconds)||STEP)*1000;renderFrame(now);},selectAvatar:id=>selectAvatar(catalog.find(e=>e.id===id)),step:(count,control=0)=>{for(let i=0;i<count;i++)tick(STEP,control);drawWorld();syncUI();previous=performance.now();},ending:seconds=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)updateEnding(STEP);},game:()=>game};
}
