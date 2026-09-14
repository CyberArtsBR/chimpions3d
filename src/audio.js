// Cached, layered PCM effects: lightweight local synthesis with independent music/SFX control.
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
  // Death itself is intentionally silent. The chimp simply falls; the impact, pain cry
  // and wet splash all happen together one second later when game.js fires "splash".
  if(type==='death')return;
  if(!buffers.has(type)){
   const duration={splash:.95,jet:.5,wrap:.28,coin:.25,record:.65,fragile:.22,menu:.09,spring:.4,bounce:.16}[type]||.16;
   const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
   let seed=187,phase=0,voicePhase=0,noise=0,wind=0;
   for(let i=0;i<data.length;i++){
    const t=i/context.sampleRate,u=t/duration;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise=noise*.72+(seed/4294967296*2-1)*.28;
    wind=wind*.92+noise*.08;
    const hz=type==='coin'?880*(u<.4?1:1.5):type==='record'?[523,659,784,1047][Math.min(3,Math.floor(u*4))]:
     type==='spring'?240+900*u:type==='wrap'?350+Math.sin(u*Math.PI)*600:190+220*u;
    phase+=Math.PI*2*hz/context.sampleRate;
    const tone=Math.sin(phase)+.23*Math.sin(phase*2)+.1*Math.sin(phase*3);
    let sample,fade=Math.pow(1-u,2);
    if(type==='splash'){
     // Single impact event: low thud + liquid burst + a short descending pain cry.
     const wet=noise*.72*Math.exp(-t*5.2)+wind*.18*Math.exp(-t*3.4);
     const impact=Math.sin(Math.PI*2*64*t)*Math.exp(-t*13);
     const voiceT=Math.max(0,t-.045),voiceU=Math.min(1,voiceT/.78);
     const voiceHz=335-150*voiceU+18*Math.sin(voiceU*Math.PI*4);
     voicePhase+=Math.PI*2*voiceHz/context.sampleRate;
     const voiceEnvelope=t<.045?0:Math.pow(Math.sin(Math.PI*Math.min(1,voiceU)),.55)*Math.pow(1-voiceU,.28);
     const cry=(Math.sin(voicePhase)+.38*Math.sin(voicePhase*2.03)+.16*Math.sin(voicePhase*3.08))*voiceEnvelope;
     sample=wet*.55+impact*.58+cry*.34;
     fade=Math.max(.18,1-u);
    }else{
     const noisy=['fragile','jet'].includes(type);
     sample=noisy?noise*.55+tone*.12:tone*.23+noise*.02;
    }
    data[i]=sample*Math.min(1,t/.006)*fade;
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
