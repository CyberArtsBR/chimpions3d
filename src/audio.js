// Lightweight procedural audio vocabulary for Chimp Jump.
// SFX are rendered once to PCM buffers and replayed; ambience/jet sustain are tiny
// looped procedural buffers, so the presentation pass adds no network audio payload.
export function createAudio(music){
 let context,master,muted=false,intensity=0,gameplayActive=false,jetActive=false;
 const buffers=new Map(),loops=new Map();
 let bananaVoice=0,lastLandingAt=-Infinity;
 let settings={music:.16,sfx:.65};
 try{settings={...settings,...JSON.parse(localStorage.getItem('chimp-audio')||'{}')};}catch{}
 for(const key of ['music','sfx'])settings[key]=Number.isFinite(settings[key])?Math.max(0,Math.min(1,settings[key])):(key==='music'?.16:.65);
 settings.music=.16;
 try{localStorage.setItem('chimp-audio',JSON.stringify(settings));}catch{}

 const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
 function syncMusic(){
  music.volume=settings.music;
  music.playbackRate=.985+.055*intensity;
 }
 syncMusic();

 function unlock(){
  try{
   context??=new AudioContext();
   if(!master){master=context.createGain();master.connect(context.destination);}
   master.gain.value=muted?0:settings.sfx;
   context.resume().catch(()=>{});
   ensureLoops();
  }catch{}
 }

 function durationFor(type){
  return {
   impact:.24,cry:.72,splash:.62,'jet-start':.34,'jet-end':.38,wrap:.28,
   coin1:.19,coin2:.21,coin3:.23,record:.65,crack:.24,'fragile-break':.34,
   menu:.08,confirm:.12,back:.12,'spring-compress':.17,spring:.42,bounce:.16,
   moving:.2,leaf:.23,swing:.3,'vanish-warning':.3,'vanish-break':.36,
   'hazard-warning':.25,hazard:.31,'event-in':.48,'event-out':.38,milestone:.62,
   ambience:5.8,'jet-sustain':1.2
  }[type]||.16;
 }

 function makeBuffer(type){
  const duration=durationFor(type);
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
  const data=buffer.getChannelData(0);
  let seed=187,phase=0,phase2=0,noise=0,wind=0;
  for(let i=0;i<data.length;i++){
   const t=i/context.sampleRate,u=t/duration;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   noise=noise*.7+(seed/4294967296*2-1)*.3;
   wind=wind*.965+noise*.035;
   let sample=0;
   if(type==='ambience'){
    const insects=Math.sin(t*Math.PI*2*2850)*(Math.sin(t*Math.PI*.42)>.82?.045:0);
    sample=wind*.16+insects;
   }else if(type==='jet-sustain'){
    phase+=Math.PI*2*(82+5*Math.sin(t*5.2))/context.sampleRate;
    sample=Math.sin(phase)*.2+wind*.5;
   }else if(type==='impact'){
    phase+=Math.PI*2*(72-28*u)/context.sampleRate;
    sample=Math.sin(phase)*.62*Math.exp(-t*16)+noise*.22*Math.exp(-t*12);
   }else if(type==='cry'){
    const hz=430-205*u+28*Math.sin(u*Math.PI*5);
    phase+=Math.PI*2*hz/context.sampleRate;phase2+=Math.PI*2*(hz*2.06)/context.sampleRate;
    const env=Math.pow(Math.sin(Math.PI*Math.min(1,u)),.48)*Math.pow(1-u,.22);
    sample=(Math.sin(phase)+.34*Math.sin(phase2)+.11*Math.sin(phase*3.02)+wind*.15)*env*.68;
   }else if(type==='splash'){
    phase+=Math.PI*2*(115-65*u)/context.sampleRate;
    sample=(noise*.72+wind*.32)*Math.exp(-t*4.3)+Math.sin(phase)*.3*Math.exp(-t*8);
   }else{
    const coinIndex=type==='coin1'?0:type==='coin2'?1:type==='coin3'?2:-1;
    const hz=coinIndex>=0?[830,930,1040][coinIndex]*(u<.48?1:1.34):
     type==='record'?[523,659,784,1047][Math.min(3,Math.floor(u*4))]:
     type==='milestone'?[392,523,659,784][Math.min(3,Math.floor(u*4))]:
     type==='event-in'?300+Math.sin(u*Math.PI)*540:
     type==='event-out'?540-220*u:
     type==='hazard-warning'?760-250*u:
     type==='hazard'?125+90*(1-u):
     type==='vanish-warning'?690-260*u:
     type==='vanish-break'?360-210*u:
     type==='leaf'?330+90*Math.sin(u*Math.PI):
     type==='swing'?260+250*u:
     type==='spring-compress'?210-65*u:
     type==='spring'?250+920*u:
     type==='moving'?205+110*Math.sin(u*Math.PI*2):
     type==='crack'||type==='fragile-break'?175-70*u:
     type==='wrap'?350+Math.sin(u*Math.PI)*600:
     type==='confirm'?520+260*u:
     type==='back'?390-140*u:190+220*u;
    phase+=Math.PI*2*hz/context.sampleRate;
    const tone=Math.sin(phase)+.23*Math.sin(phase*2)+.1*Math.sin(phase*3);
    const noisy=['crack','fragile-break','hazard','vanish-break'].includes(type);
    sample=noisy?noise*.46+tone*.14:tone*.23+noise*.018;
    if(type==='milestone'||type==='event-in')sample*=.7+.3*Math.sin(Math.PI*u);
    sample*=Math.pow(1-u,2);
   }
   data[i]=sample*Math.min(1,t/.006);
  }
  return buffer;
 }

 function getBuffer(type){
  if(!buffers.has(type))buffers.set(type,makeBuffer(type));
  return buffers.get(type);
 }

 function playRaw(type,delay=0,gain=1,rate=1){
  if(muted)return;unlock();if(!context)return;
  const source=context.createBufferSource(),volume=context.createGain();
  source.buffer=getBuffer(type);source.playbackRate.value=rate;volume.gain.value=gain;
  source.connect(volume);volume.connect(master);
  source.onended=()=>{source.disconnect();volume.disconnect();};
  source.start(context.currentTime+delay);
 }

 function setLoopLevel(name,value,seconds=.14){
  const loop=loops.get(name);if(!loop||!context)return;
  const now=context.currentTime,target=muted?0:clamp(value);
  loop.gain.gain.cancelScheduledValues(now);
  loop.gain.gain.setTargetAtTime(target,now,Math.max(.015,seconds));
 }

 function ensureLoop(name,type){
  if(!context||loops.has(name))return;
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=getBuffer(type);source.loop=true;gain.gain.value=0;
  source.connect(gain);gain.connect(master);source.start();
  loops.set(name,{source,gain});
 }

 function ensureLoops(){
  if(!context)return;
  ensureLoop('ambience','ambience');
  ensureLoop('jet','jet-sustain');
  setLoopLevel('ambience',gameplayActive ? .08 : 0,.25);
  setLoopLevel('jet',jetActive ? .2 : 0,.08);
 }

 function play(type){
  if(type==='death'||type==='splash')return;
  if(type==='coin'){
   const voice=['coin1','coin2','coin3'][bananaVoice++%3];
   playRaw(voice,0,.5,[.99,1.02,1][bananaVoice%3]);return;
  }
  if(type==='bounce'){
   if(context&&context.currentTime-lastLandingAt<.075)return;
   if(context)lastLandingAt=context.currentTime;
   playRaw('bounce',0,.34);return;
  }
  if(type==='moving'){playRaw('moving',0,.36);return;}
  if(type==='leaf'){playRaw('leaf',0,.42);return;}
  if(type==='swing'){playRaw('swing',0,.47);return;}
  if(type==='spring-compress'){playRaw('spring-compress',0,.34);return;}
  if(type==='spring'){playRaw('spring-compress',0,.3);playRaw('spring',.07,.56);return;}
  if(type==='fragile'||type==='crack'){playRaw('crack',0,.5);playRaw('fragile-break',.08,.38);return;}
  if(type==='vanish-warning'){playRaw('vanish-warning',0,.42);return;}
  if(type==='vanish'){playRaw('vanish-break',0,.48);return;}
  if(type==='hazard-warning'){playRaw('hazard-warning',0,.34);return;}
  if(type==='hazard'){playRaw('hazard',0,.63);return;}
  if(type==='jet'){playRaw('jet-start',0,.62);return;}
  if(type==='jet-end'){playRaw('jet-end',0,.43);return;}
  if(type==='event'){playRaw('event-in',0,.56);return;}
  if(type==='event-out'){playRaw('event-out',0,.4);return;}
  if(type==='milestone'){playRaw('milestone',0,.56);return;}
  if(type==='menu'){playRaw('menu',0,.3);return;}
  if(type==='confirm'){playRaw('confirm',0,.34);return;}
  if(type==='back'){playRaw('back',0,.28);return;}
  playRaw(type,0,.5);
 }

 const onDeathOffscreen=()=>{
  playRaw('impact',0,.7);playRaw('cry',.035,.5);playRaw('splash',.11,.78);
 };

 window.addEventListener('chimp-death-offscreen',onDeathOffscreen);
 const panel=document.createElement('details');panel.id='audio-settings';panel.innerHTML='<summary>Audio</summary>';
 for(const [key,label] of [['music','Music volume'],['sfx','SFX volume']]){
  const row=document.createElement('label'),input=document.createElement('input');
  row.textContent=label;input.type='range';input.min=0;input.max=100;input.value=Math.round(settings[key]*100);input.setAttribute('aria-label',label);
  input.oninput=()=>{
   settings[key]=Number(input.value)/100;syncMusic();
   if(master)master.gain.value=muted?0:settings.sfx;
   try{localStorage.setItem('chimp-audio',JSON.stringify(settings));}catch{}
  };
  row.append(input);panel.append(row);
 }
 document.body.append(panel);
 document.addEventListener('pointerdown',unlock,{once:true});
 document.addEventListener('keydown',unlock,{once:true});

 return {
  play,unlock,
  setIntensity(value){intensity=clamp(value);syncMusic();},
  setGameplayActive(value){
   value=!!value;if(value===gameplayActive)return;gameplayActive=value;
   if(context)ensureLoops();setLoopLevel('ambience',value ? .08 : 0,.28);
  },
  setJetActive(value){
   value=!!value;if(value===jetActive)return;jetActive=value;
   if(context)ensureLoops();setLoopLevel('jet',value ? .2 : 0,.08);
  },
  setMuted(value){
   muted=!!value;music.muted=muted;
   if(master)master.gain.value=muted?0:settings.sfx;
  },
  dispose(){
   window.removeEventListener('chimp-death-offscreen',onDeathOffscreen);
   for(const loop of loops.values()){try{loop.source.stop();}catch{}loop.source.disconnect();loop.gain.disconnect();}
   loops.clear();
  }
 };
}
