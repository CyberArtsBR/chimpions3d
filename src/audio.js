// Lightweight cached PCM SFX with independent music/SFX controls.
// Gameplay stays asset-light; each effect is rendered once, cached, then replayed.
export function createAudio(music){
 let context,master,muted=false,intensity=0;
 const buffers=new Map();
 let settings={music:.16,sfx:.65};
 try{settings={...settings,...JSON.parse(localStorage.getItem('chimp-audio')||'{}')};}catch{}
 for(const key of ['music','sfx'])settings[key]=Number.isFinite(settings[key])?Math.max(0,Math.min(1,settings[key])):(key==='music'?.16:.65);
 // Product request: reduce music to 40% of the previous launcher/game loudness.
 // Force the migrated value once so an older localStorage preference cannot
 // silently restore the louder mix after deployment.
 settings.music=.16;
 try{localStorage.setItem('chimp-audio',JSON.stringify(settings));}catch{}
 function syncMusic(){
  music.volume=settings.music;
  music.playbackRate=.985+.055*intensity;
 }
 syncMusic();
 function unlock(){
  try{
   context??=new AudioContext();
   if(!master){master=context.createGain();master.connect(context.destination);}
   master.gain.value=muted?0:settings.sfx;context.resume().catch(()=>{});
  }catch{}
 }
 function makeBuffer(type){
  const duration={
   impact:.24,cry:.72,splash:.62,jet:.5,wrap:.28,coin:.25,record:.65,fragile:.22,
   menu:.09,spring:.4,bounce:.16,leaf:.22,swing:.28,vanish:.34,hazard:.3,event:.46,milestone:.62
  }[type]||.16;
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
  let seed=187,phase=0,phase2=0,noise=0,wind=0;
  for(let i=0;i<data.length;i++){
   const t=i/context.sampleRate,u=t/duration;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise=noise*.70+(seed/4294967296*2-1)*.30;wind=wind*.94+noise*.06;
   let sample=0;
   if(type==='impact'){
    phase+=Math.PI*2*(72-28*u)/context.sampleRate;
    sample=Math.sin(phase)*.62*Math.exp(-t*16)+noise*.22*Math.exp(-t*12);
   }else if(type==='cry'){
    const hz=430-205*u+28*Math.sin(u*Math.PI*5);phase+=Math.PI*2*hz/context.sampleRate;phase2+=Math.PI*2*(hz*2.06)/context.sampleRate;
    const env=Math.pow(Math.sin(Math.PI*Math.min(1,u)),.48)*Math.pow(1-u,.22);
    const chirp=Math.sin(phase)+.34*Math.sin(phase2)+.11*Math.sin(phase*3.02);
    sample=(chirp*.68+wind*.15)*env;
   }else if(type==='splash'){
    phase+=Math.PI*2*(115-65*u)/context.sampleRate;
    const wet=(noise*.72+wind*.32)*Math.exp(-t*4.3),body=Math.sin(phase)*.3*Math.exp(-t*8);
    sample=wet+body;
   }else{
    const hz=type==='coin'?880*(u<.42?1:1.5):
     type==='record'?[523,659,784,1047][Math.min(3,Math.floor(u*4))]:
     type==='milestone'?[392,523,659,784][Math.min(3,Math.floor(u*4))]:
     type==='event'?310+Math.sin(u*Math.PI)*520:
     type==='hazard'?125+90*(1-u):
     type==='vanish'?620-320*u:
     type==='leaf'?330+90*Math.sin(u*Math.PI):
     type==='swing'?270+240*u:
     type==='spring'?240+900*u:
     type==='wrap'?350+Math.sin(u*Math.PI)*600:190+220*u;
    phase+=Math.PI*2*hz/context.sampleRate;
    const tone=Math.sin(phase)+.23*Math.sin(phase*2)+.1*Math.sin(phase*3);
    const noisy=['fragile','jet','hazard','vanish'].includes(type);
    sample=noisy?noise*.5+tone*.15:tone*.23+noise*.02;
    if(type==='milestone'||type==='event')sample*=.7+.3*Math.sin(Math.PI*u);
    sample*=Math.pow(1-u,2);
   }
   data[i]=sample*Math.min(1,t/.006);
  }
  return buffer;
 }
 function playRaw(type,delay=0,gain=1){
  if(muted)return;unlock();if(!context)return;
  if(!buffers.has(type))buffers.set(type,makeBuffer(type));
  const source=context.createBufferSource(),volume=context.createGain();source.buffer=buffers.get(type);volume.gain.value=gain;source.connect(volume);volume.connect(master);
  source.onended=()=>{source.disconnect();volume.disconnect();};source.start(context.currentTime+delay);
 }
 function play(type){
  if(type==='death'||type==='splash')return;
  if(type==='bounce'){playRaw(type,0,.46);return;}
  if(type==='leaf'){playRaw(type,0,.55);return;}
  if(type==='swing'){playRaw(type,0,.62);return;}
  playRaw(type);
 }
 const onDeathOffscreen=()=>{
  playRaw('impact',0,.72);playRaw('cry',.035,.58);playRaw('splash',.11,.86);
 };
 window.addEventListener('chimp-death-offscreen',onDeathOffscreen);
 const panel=document.createElement('details');panel.id='audio-settings';panel.innerHTML='<summary>Audio</summary>';
 for(const [key,label] of [['music','Music volume'],['sfx','SFX volume']]){
  const row=document.createElement('label'),input=document.createElement('input');row.textContent=label;input.type='range';input.min=0;input.max=100;input.value=Math.round(settings[key]*100);input.setAttribute('aria-label',label);
  input.oninput=()=>{settings[key]=Number(input.value)/100;syncMusic();if(master)master.gain.value=muted?0:settings.sfx;try{localStorage.setItem('chimp-audio',JSON.stringify(settings));}catch{}};
  row.append(input);panel.append(row);
 }
 document.body.append(panel);
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 return {
  play,unlock,
  setIntensity(value){intensity=Math.max(0,Math.min(1,Number(value)||0));syncMusic();},
  setMuted(value){muted=value;music.muted=value;if(master)master.gain.value=value?0:settings.sfx;},
  dispose(){window.removeEventListener('chimp-death-offscreen',onDeathOffscreen);}
 };
}
