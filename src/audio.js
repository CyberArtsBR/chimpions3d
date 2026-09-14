// Cached, layered PCM effects: no per-event oscillators or downloaded sound pack.
export function createAudio(music){
 let context,master,muted=false;
 const buffers=new Map();
 let settings={music:.19,sfx:.65};
 try{settings={...settings,...JSON.parse(localStorage.getItem('chimp-audio')||'{}')};}catch{}
 for(const key of ['music','sfx'])settings[key]=Number.isFinite(settings[key])?Math.max(0,Math.min(1,settings[key])):(key==='music'?.19:.65);
 music.volume=settings.music;
 function unlock(){try{context??=new AudioContext();if(!master){master=context.createGain();master.connect(context.destination);}master.gain.value=muted?0:settings.sfx;context.resume().catch(()=>{});}catch{}}
 function play(type){
  if(muted)return;unlock();if(!context)return;
  if(!buffers.has(type)){
   const duration={death:.7,splash:.4,jet:.5,wrap:.28,coin:.25,record:.65,fragile:.22,menu:.09,spring:.4,bounce:.16}[type]||.16;
   const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
   let seed=187,phase=0,noise=0;
   for(let i=0;i<data.length;i++){
    const t=i/context.sampleRate,u=t/duration;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise=noise*.7+(seed/4294967296*2-1)*.3;
    const hz=type==='coin'?880*(u<.4?1:1.5):type==='record'?[523,659,784,1047][Math.min(3,Math.floor(u*4))]:
     type==='death'?500*Math.pow(.12,u):type==='spring'?240+900*u:type==='wrap'?350+Math.sin(u*Math.PI)*600:190+220*u;
    phase+=Math.PI*2*hz/context.sampleRate;
    const tone=Math.sin(phase)+.23*Math.sin(phase*2)+.1*Math.sin(phase*3);
    const noisy=['splash','fragile','jet','death'].includes(type);
    data[i]=(noisy?noise*.55+tone*.12:tone*.23+noise*.02)*Math.min(1,t/.006)*Math.pow(1-u,2);
   }
   buffers.set(type,buffer);
  }
  const source=context.createBufferSource();source.buffer=buffers.get(type);source.connect(master);source.onended=()=>source.disconnect();source.start();
 }
 const panel=document.createElement('details');panel.id='audio-settings';panel.innerHTML='<summary>Audio</summary>';
 for(const [key,label] of [['music','Music volume'],['sfx','SFX volume']]){
  const row=document.createElement('label'),input=document.createElement('input');
  row.textContent=label;input.type='range';input.min=0;input.max=100;input.value=Math.round(settings[key]*100);input.setAttribute('aria-label',label);
  input.oninput=()=>{settings[key]=Number(input.value)/100;music.volume=settings.music;if(master)master.gain.value=muted?0:settings.sfx;try{localStorage.setItem('chimp-audio',JSON.stringify(settings));}catch{}};
  row.append(input);panel.append(row);
 }
 document.body.append(panel);
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 return {play,unlock,setMuted(value){muted=value;music.muted=value;if(master)master.gain.value=value?0:settings.sfx;}};
}
