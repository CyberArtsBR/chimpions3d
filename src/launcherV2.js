import './launcher.css';
import './launcherFinal.css';

document.title='Chimpions Games';
document.body.innerHTML=`
<div class="app" id="app">
  <img class="room-bg" src="/launcher/room-background.png" alt="" />
  <div class="vignette"></div>
  <div class="header-ui">
    <img class="logo" src="/launcher/logo.png" alt="The Chimpions Games" />
    <nav class="socials" aria-label="Chimpions links">
      <a class="social-link" href="https://www.chimpions.co/" target="_blank" rel="noopener noreferrer" aria-label="Official Chimpions Site"><img src="/launcher/social-site.png" alt="Official Chimpions Site" /></a>
      <a class="social-link" href="https://x.com/TheChimpions" target="_blank" rel="noopener noreferrer" aria-label="Chimpions on X"><img src="/launcher/social-x.png" alt="Chimpions on X" /></a>
      <a class="social-link" href="https://discord.com/invite/thechimpions" target="_blank" rel="noopener noreferrer" aria-label="Discord"><img src="/launcher/social-discord.png" alt="Discord" /></a>
    </nav>
  </div>
  <div class="carousel" id="carousel">
    <div class="cart-wrap" role="button" tabindex="0" aria-label="Play Chimp Jump" data-index="0"><div class="cart-entry"><div class="float"><div class="cart-body"><img class="cart-image" alt="Chimp Jump cartridge" src="/launcher/cartridge-jump.png" /></div></div></div></div>
    <div class="cart-wrap" role="button" tabindex="0" aria-label="Play Chimp Dash" data-index="1"><div class="cart-entry"><div class="float"><div class="cart-body"><img class="cart-image" alt="Chimp Dash cartridge" src="/launcher/cartridge-dash.png" /></div></div></div></div>
    <div class="cart-wrap" role="button" tabindex="0" aria-label="Play Chimpions Card Arena" data-index="2"><div class="cart-entry"><div class="float"><div class="cart-body"><img class="cart-image" alt="Chimpions Card Arena cartridge" src="/launcher/cartridge-arena.png" /></div></div></div></div>
    <div class="cart-wrap" role="button" tabindex="0" aria-label="Play Chimpions Ski" data-index="3"><div class="cart-entry"><div class="float"><div class="cart-body"><img class="cart-image" alt="Chimpions Ski cartridge" src="/launcher/cartridge-ski-hq.webp" /></div></div></div></div>
    <div class="cart-wrap" role="button" tabindex="0" aria-label="Play Chimpions Urban Sports" data-index="4"><div class="cart-entry"><div class="float"><div class="cart-body"><img class="cart-image" alt="Chimpions Urban Sports cartridge" src="/launcher/cartridge-urban-sports.webp" /></div></div></div></div>
  </div>
  <div class="play-pill">Click to Play</div>
  <div class="controls"><span class="key">A</span><span class="key">D</span><span>Select</span><span class="sep">•</span><span class="key">↵</span><span>Play</span><span class="sep">•</span><span>Click a side cartridge to center it</span></div>
  <div class="gamepad-status" id="gamepadStatus">Gamepad: not connected</div>
  <button type="button" class="music-toggle" id="musicToggle">Play Music</button>
  <div class="music-status" id="musicStatus">Music: waiting for autoplay</div>
  <audio id="bgm" src="/launcher/chimpions.mp3" loop preload="none"></audio>
  <div class="label-zoom" id="labelZoom"><img id="labelZoomImage" alt="" /></div>
  <div class="fade-cover"></div>
</div>`;

const games=[
  {name:'Chimp Jump',url:'/?play=jump',image:'/launcher/cartridge-jump.png'},
  {name:'Chimp Dash',url:'/?dash=1',image:'/launcher/cartridge-dash.png'},
  {name:'Chimpions Card Arena',url:'/?arena=1',image:'/launcher/cartridge-arena.png'},
  {name:'Chimpions Ski',url:'https://chimpions-ski.onrender.com',image:'/launcher/cartridge-ski-hq.webp'},
  {name:'Chimpions Urban Sports',url:'https://chimpions-urban-sports.onrender.com/',image:'/launcher/cartridge-urban-sports.webp'}
];

const app=document.getElementById('app');
const cards=[...document.querySelectorAll('.cart-wrap')];
const labelZoomImage=document.getElementById('labelZoomImage');
const gamepadStatus=document.getElementById('gamepadStatus');
const musicStatus=document.getElementById('musicStatus');
const musicToggle=document.getElementById('musicToggle');
const bgm=document.getElementById('bgm');
let active=0,locked=false,ready=false,touchStartX=null,musicEnabled=true,musicPending=false;

bgm.volume=.4;
function updateMusicStatus(){
  const playing=!bgm.paused;
  musicStatus.textContent=playing?'Music: playing':'Music: paused';
  musicStatus.classList.toggle('on',playing);
  musicToggle.textContent=playing?'Pause Music':'Play Music';
}
async function tryStartMusic(){
  if(!musicEnabled||musicPending||locked||document.hidden)return;
  musicPending=true;
  try{await bgm.play();updateMusicStatus();}
  catch{musicStatus.textContent='Music: click anywhere to start';musicStatus.classList.remove('on');musicToggle.textContent='Play Music';}
  finally{musicPending=false;}
}
musicToggle.addEventListener('click',e=>{e.stopPropagation();if(bgm.paused){musicEnabled=true;void tryStartMusic();}else{musicEnabled=false;bgm.pause();updateMusicStatus();}});

let audioCtx=null;
function ensureAudio(){
  if(!audioCtx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;audioCtx=new Audio();}
  if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
  return audioCtx;
}
function beep({type='triangle',freq=320,slideTo=440,duration=.07,gain=.020,delay=0}){
  const ctx=ensureAudio();if(!ctx)return;const t0=ctx.currentTime+delay,osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t0);if(slideTo)osc.frequency.exponentialRampToValueAtTime(slideTo,t0+duration);
  amp.gain.setValueAtTime(.0001,t0);amp.gain.exponentialRampToValueAtTime(gain,t0+.01);amp.gain.exponentialRampToValueAtTime(.0001,t0+duration);
  osc.connect(amp).connect(ctx.destination);osc.start(t0);osc.stop(t0+duration+.03);
}
function noiseBurst(duration=.10,gain=.014){
  const ctx=ensureAudio();if(!ctx)return;const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.60;
  const src=ctx.createBufferSource(),amp=ctx.createGain();amp.gain.value=gain;src.buffer=buffer;src.connect(amp).connect(ctx.destination);src.start();
}
function rotateSound(){beep({freq:280,slideTo:405,duration:.075,gain:.020});beep({freq:430,slideTo:520,duration:.05,gain:.012,delay:.035});}
function launchSound(){noiseBurst(.10,.012);beep({type:'sawtooth',freq:170,slideTo:430,duration:.23,gain:.026});beep({freq:540,slideTo:900,duration:.19,gain:.016,delay:.05});}

function layout(){
  const spread=Math.min(420,innerWidth*.30);
  cards.forEach((card,i)=>{
    card.classList.remove('is-front','is-back','is-far');
    const rel=(i-active+cards.length)%cards.length;card.dataset.rel=String(rel);
    if(rel===0){
      card.classList.add('is-front');
      card.style.transform='translate3d(0px, 0px, 270px) scale(1.10) rotateY(0deg)';
      card.style.opacity='1';
    }else if(rel===1){
      card.classList.add('is-back');
      card.style.transform=`translate3d(${spread}px, 62px, -170px) scale(.73) rotateY(-25deg)`;
      card.style.opacity='.95';
    }else if(rel===cards.length-1){
      card.classList.add('is-back');
      card.style.transform=`translate3d(${-spread}px, 62px, -170px) scale(.73) rotateY(25deg)`;
      card.style.opacity='.95';
    }else{
      card.classList.add('is-far');
      const farSpread=Math.min(650,spread*1.58);
      const isFarLeft=rel>cards.length/2;
      const x=isFarLeft?-farSpread:farSpread;
      const yaw=isFarLeft?34:-34;
      card.style.transform=`translate3d(${x}px, 88px, -300px) scale(.60) rotateY(${yaw}deg)`;
      card.style.opacity='.78';
    }
  });
}
function rotate(step){if(!ready||locked)return;active=(active+step+games.length)%games.length;rotateSound();layout();}
function clickCartridge(index){
  if(!ready||locked)return;
  if(index===active){launch();return;}
  const rel=Number(cards[index].dataset.rel);
  if(rel===1)rotate(1);
  else if(rel===cards.length-1)rotate(-1);
  else if(rel===2)rotate(2);
  else if(rel===cards.length-2)rotate(-2);
}
function launch(){
  if(!ready||locked)return;
  locked=true;launchSound();labelZoomImage.src=games[active].image;labelZoomImage.alt=games[active].name+' cartridge';app.classList.add('launching');
  setTimeout(()=>{bgm.pause();window.location.href=games[active].url;},2400);
}

cards.forEach((card,index)=>card.addEventListener('click',()=>{ensureAudio();void tryStartMusic();clickCartridge(index);}));
window.addEventListener('keydown',e=>{
  if(!ready||locked||e.repeat)return;
  const target=e.target instanceof Element?e.target:null;if(target?.closest('.socials,.music-toggle'))return;
  const key=e.key.toLowerCase();
  if(key==='a'||e.key==='ArrowLeft'){e.preventDefault();ensureAudio();void tryStartMusic();rotate(-1);}
  else if(key==='d'||e.key==='ArrowRight'){e.preventDefault();ensureAudio();void tryStartMusic();rotate(1);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();ensureAudio();void tryStartMusic();const card=target?.closest('.cart-wrap');card?clickCartridge(Number(card.dataset.index)):launch();}
});
app.addEventListener('touchstart',e=>{if(e.touches.length===1)touchStartX=e.touches[0].clientX;},{passive:true});
app.addEventListener('touchend',e=>{if(!ready||locked||touchStartX==null)return;const dx=e.changedTouches[0].clientX-touchStartX;touchStartX=null;if(Math.abs(dx)<45)return;ensureAudio();void tryStartMusic();rotate(dx<0?1:-1);},{passive:true});

const gpState={left:false,right:false,confirm:false};
const btnPressed=btn=>!!btn&&(typeof btn==='object'?btn.pressed:btn===1);
function updateGamepadStatus(){
  gpState.left=gpState.right=gpState.confirm=false;const gp=[...(navigator.getGamepads?.()||[])].find(Boolean);
  gamepadStatus.textContent=gp?'Gamepad: connected':'Gamepad: not connected';gamepadStatus.classList.toggle('on',!!gp);
}
function pollGamepad(){
  if(ready&&!locked&&!document.hidden&&navigator.getGamepads){
    const gp=[...navigator.getGamepads()].find(Boolean);
    if(gp){
      const axisX=gp.axes?.[0]||0,left=btnPressed(gp.buttons?.[14])||axisX<-.55,right=btnPressed(gp.buttons?.[15])||axisX>.55,confirm=btnPressed(gp.buttons?.[0])||btnPressed(gp.buttons?.[9]);
      if(left&&!gpState.left){ensureAudio();void tryStartMusic();rotate(-1);}
      if(right&&!gpState.right){ensureAudio();void tryStartMusic();rotate(1);}
      if(confirm&&!gpState.confirm){ensureAudio();void tryStartMusic();launch();}
      gpState.left=left;gpState.right=right;gpState.confirm=confirm;
    }
  }
  requestAnimationFrame(pollGamepad);
}
window.addEventListener('gamepadconnected',updateGamepadStatus);window.addEventListener('gamepaddisconnected',updateGamepadStatus);
window.addEventListener('resize',layout);
document.addEventListener('visibilitychange',()=>{if(document.hidden)bgm.pause();else void tryStartMusic();});
window.addEventListener('pageshow',e=>{if(e.persisted){locked=false;app.classList.remove('launching');void tryStartMusic();}});
layout();updateGamepadStatus();requestAnimationFrame(pollGamepad);
setTimeout(()=>{ready=true;app.classList.add('cards-ready');},1500);
tryStartMusic();
['pointerdown','touchstart'].forEach(eventName=>window.addEventListener(eventName,()=>{try{ensureAudio();void tryStartMusic();}catch{}},{once:true,passive:true}));
