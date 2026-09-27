// Chimpions Dash presentation audio.
// User-gesture-only Web Audio with persistent, independently mixable buses.
// Authored samples are optional layers; synthesized cues remain the resilient fallback.
const BUS_NAMES=['master','music','sfx','ui','ambience'];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

export class GameAudio {
  constructor(enabled=false){
    this.enabled=!!enabled;
    this.context=null;
    this.failed=false;
    this.nodes=null;
    this.muted=false;
    this.volumes={master:1,music:.72,sfx:.9,ui:.8,ambience:.45};
    this.music=null;
    this.musicWanted=false;
    this.musicSrc='assets/chimpions-army.mp3';
    this.musicVolume=.22;
    this.dashActive=false;
    this.dashNodes=[];
    this.ambienceNodes=[];
    this.windGain=null;
    this.windFilter=null;
    this.leavesGain=null;
    this.insectGain=null;
    this.birdGain=null;
    this.waterGain=null;
    this.flowOsc=null;
    this.flowFilter=null;
    this.flowGain=null;
    this.flowLevel=0;
    this.flowMultiplier=1;
    this.appliedFlowLevel=-1;
    this.appliedFlowMultiplier=-1;
    this.biome='emerald-wilds';
    this.speedNorm=0;
    this.appliedSpeedNorm=-1;
    this.footstepSide=0;
    this.sampleManifest={};
    this.sampleBuffers=new Map();
    this.sampleLoads=new Map();
    this.sampleFailures=new Set();
  }

  ensure(){
    if(this.failed)throw new Error('Dash audio is unavailable');
    const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextCtor)throw new Error('Web Audio is not supported');
    this.context??=new AudioContextCtor();
    if(!this.nodes){
      const c=this.context;
      const master=c.createGain(),sfx=c.createGain(),ui=c.createGain(),ambience=c.createGain();
      sfx.connect(master);ui.connect(master);ambience.connect(master);master.connect(c.destination);
      this.nodes={master,sfx,ui,ambience};
      this.applyMix();
    }
    if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    return this.context;
  }

  unlock(){if(!this.enabled||this.failed)return false;try{this.ensure();return true}catch{this.failed=true;return false}}

  applyMix(){
    const master=this.muted?0:this.volumes.master;
    if(this.nodes){
      this.nodes.master.gain.value=master;
      this.nodes.sfx.gain.value=this.volumes.sfx;
      this.nodes.ui.gain.value=this.volumes.ui;
      this.nodes.ambience.gain.value=this.volumes.ambience;
    }
    if(this.music)this.music.volume=clamp(this.musicVolume*master*this.volumes.music);
  }

  setBusVolume(bus,value){
    if(!BUS_NAMES.includes(bus))return;
    this.volumes[bus]=clamp(value);
    this.applyMix();
  }

  setVolumes(next={}){
    for(const bus of BUS_NAMES)if(next[bus]!=null)this.volumes[bus]=clamp(next[bus]);
    this.applyMix();
  }

  setMuted(muted){this.muted=!!muted;this.applyMix()}
  setEnabled(enabled){
    this.enabled=!!enabled;
    if(!this.enabled){this.setDash(false);this.suspendMusic();this.stopAmbience()}
    else if(this.musicWanted)this.resumeMusic();
  }

  setSampleManifest(manifest={}){
    this.sampleManifest=Object.fromEntries(Object.entries(manifest||{}).filter(([,url])=>typeof url==='string'&&url));
    this.sampleFailures.clear();
  }

  async loadSample(kind,url){
    if(!url||this.sampleBuffers.has(kind)||this.sampleFailures.has(kind))return;
    if(this.sampleLoads.has(kind))return this.sampleLoads.get(kind);
    const promise=(async()=>{
      try{
        const response=await fetch(url,{cache:'force-cache'});
        if(!response.ok)throw new Error('sample '+response.status);
        const bytes=await response.arrayBuffer(),c=this.ensure();
        const buffer=await c.decodeAudioData(bytes.slice(0));
        this.sampleBuffers.set(kind,buffer);
      }catch(error){
        this.sampleFailures.add(kind);
        console.warn?.('Dash authored sample unavailable:',kind,error?.message||error);
      }finally{this.sampleLoads.delete(kind)}
    })();
    this.sampleLoads.set(kind,promise);return promise;
  }

  route(node,gain,destination,pan=0){
    const c=this.context;
    node.connect(gain);
    if(c?.createStereoPanner&&Math.abs(pan)>.001){
      const panner=c.createStereoPanner();panner.pan.value=clamp(pan,-1,1);gain.connect(panner);panner.connect(destination);return panner;
    }
    gain.connect(destination);return null;
  }

  playSample(kind,{gain=1,pitch=1,pan=0,bus='sfx'}={}){
    const url=this.sampleManifest[kind];
    if(!url||this.sampleFailures.has(kind))return false;
    const buffer=this.sampleBuffers.get(kind);
    if(!buffer){void this.loadSample(kind,url);return false}
    const c=this.ensure(),source=c.createBufferSource(),g=c.createGain();
    source.buffer=buffer;source.playbackRate.value=clamp(pitch,.55,1.75);g.gain.value=clamp(gain,0,1.5);
    this.route(source,g,this.target(bus),pan);source.start();return true;
  }

  musicNode(){
    if(this.music)return this.music;
    if(typeof window.Audio!=='function')return null;
    const m=new window.Audio(this.musicSrc);
    m.loop=true;m.preload='auto';m.setAttribute?.('playsinline','');
    m.addEventListener('error',()=>{this.musicError=true},{once:true});
    this.music=m;this.applyMix();return m;
  }

  startMusic(){
    this.musicWanted=true;
    if(!this.enabled||this.failed)return;
    const m=this.musicNode();if(!m)return;
    this.applyMix();
    const p=m.play?.();
    p?.catch?.(()=>{this.musicBlocked=true});
  }

  suspendMusic(){this.music?.pause?.()}
  resumeMusic(){if(this.musicWanted&&this.enabled)this.startMusic()}
  stopMusic(){
    this.musicWanted=false;
    if(this.music){this.music.pause?.();try{this.music.currentTime=0}catch{}}
  }

  target(kind='sfx'){
    this.ensure();
    return kind==='ui'?this.nodes.ui:kind==='ambience'?this.nodes.ambience:this.nodes.sfx;
  }

  play(kind,{gain=1,pitch=1,pan=0,variant=''}={}){
    if(!this.enabled||this.failed)return;
    try{
      const c=this.ensure();
      let sampleKind=kind;
      if(kind==='footstep'){
        this.footstepSide^=1;
        sampleKind=variant||(this.footstepSide?'footstepLeft':'footstepRight');
        pan=variant==='footstepLeft'?-.18:variant==='footstepRight'?.18:(this.footstepSide?-.18:.18);
      }
      if(kind==='dead'||kind==='hit')this.setDash(false);
      const bus=['click','back','confirm','error'].includes(kind)?'ui':'sfx';
      const sampled=this.playSample(sampleKind,{gain,pitch,pan,bus});
      if(kind==='jump'){
        if(!sampled){this.hoot(c.currentTime,300*pitch,540*pitch,.13,gain*.72);this.hoot(c.currentTime+.13,480*pitch,260*pitch,.17,gain*.72)}
        else this.oneShot('jump',gain*.18,pitch,pan);
        return;
      }
      if(sampled){
        if(['perfect-jump','perfect-slide','flow','multiplier','record'].includes(kind))this.oneShot(kind,gain*.2,pitch,pan);
        return;
      }
      this.oneShot(kind,gain,pitch,pan);
    }catch{
      this.failed=true;this.enabled=false;this.stopDashLoop(false);this.stopAmbience();
    }
  }

  oneShot(kind,gain=1,pitch=1,pan=0){
    const c=this.context;
    const notes={
      footstep:105,jump:390,land:110,slide:145,pass:670,'near-miss':540,'perfect-jump':920,'perfect-slide':840,
      banana:1150,golden:1480,flow:890,multiplier:980,stage:760,hit:96,dead:85,record:1040,click:320,
      back:250,confirm:520,error:150
    };
    const base=(notes[kind]||300)*pitch*(.985+Math.random()*.03);
    const ui=['click','back','confirm','error'].includes(kind);
    const o=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter();
    o.type=['banana','golden','record','confirm'].includes(kind)?'sine':'triangle';
    o.frequency.setValueAtTime(base,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(42,base*(['banana','golden','stage','flow','multiplier','confirm'].includes(kind)?1.42:.56)),c.currentTime+.12);
    filter.type='lowpass';filter.frequency.value=ui?3600:2800;
    o.connect(filter);
    this.route(filter,g,this.target(ui?'ui':'sfx'),pan);
    const peak=clamp((ui?.045:.055)*gain,0,.18);
    g.gain.setValueAtTime(.0001,c.currentTime);
    g.gain.linearRampToValueAtTime(peak,c.currentTime+.008);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.16);
    o.start();o.stop(c.currentTime+.18);
  }

  hoot(t,start,end,length,gain=1){
    const c=this.context,o=c.createOscillator(),filter=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(start,t);
    o.frequency.exponentialRampToValueAtTime(end,t+length*.55);
    o.frequency.exponentialRampToValueAtTime(Math.max(40,start*.8),t+length);
    filter.type='bandpass';filter.frequency.setValueAtTime(850,t);filter.frequency.exponentialRampToValueAtTime(580,t+length);filter.Q.value=2.5;
    o.connect(filter);filter.connect(g);g.connect(this.target('sfx'));
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(clamp(.11*gain,0,.18),t+.02);g.gain.exponentialRampToValueAtTime(.001,t+length);
    o.start(t);o.stop(t+length+.01);
  }

  setDash(active){
    if(!this.enabled||this.failed){if(this.dashActive)this.stopDashLoop();return}
    try{
      this.ensure();active=!!active;
      if(active===this.dashActive)return;
      this.dashActive=active;
      if(active)this.startDashLoop();else this.stopDashLoop();
    }catch{this.failed=true;this.enabled=false;this.stopDashLoop(false)}
  }

  startDashLoop(){
    const c=this.ensure();this.stopDashNodes(false);
    const osc=c.createOscillator(),lfo=c.createOscillator(),lfoGain=c.createGain(),filter=c.createBiquadFilter(),gain=c.createGain();
    osc.type='sawtooth';osc.frequency.setValueAtTime(88,c.currentTime);
    lfo.type='sine';lfo.frequency.setValueAtTime(7.2,c.currentTime);lfoGain.gain.setValueAtTime(9,c.currentTime);
    filter.type='lowpass';filter.frequency.setValueAtTime(620,c.currentTime);filter.Q.value=.75;
    gain.gain.setValueAtTime(.0001,c.currentTime);gain.gain.linearRampToValueAtTime(.018,c.currentTime+.035);
    lfo.connect(lfoGain);lfoGain.connect(osc.frequency);osc.connect(filter);filter.connect(gain);gain.connect(this.target('sfx'));
    osc.start();lfo.start();

    const buffer=c.createBuffer(1,c.sampleRate,Math.floor(c.sampleRate*.45)),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.14;
    const noise=c.createBufferSource(),noiseFilter=c.createBiquadFilter(),noiseGain=c.createGain();
    noise.buffer=buffer;noise.loop=true;noiseFilter.type='bandpass';noiseFilter.frequency.value=1200;noiseFilter.Q.value=.7;
    noiseGain.gain.setValueAtTime(.0001,c.currentTime);noiseGain.gain.linearRampToValueAtTime(.006,c.currentTime+.035);
    noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(this.target('sfx'));noise.start();

    const flowOsc=c.createOscillator(),flowFilter=c.createBiquadFilter(),flowGain=c.createGain();
    flowOsc.type='triangle';flowOsc.frequency.value=132;flowFilter.type='bandpass';flowFilter.frequency.value=740;flowFilter.Q.value=1.1;flowGain.gain.value=.0001;
    flowOsc.connect(flowFilter);flowFilter.connect(flowGain);flowGain.connect(this.target('sfx'));flowOsc.start();

    this.dashNodes=[osc,lfo,noise,flowOsc];this.dashGain=gain;this.dashNoiseGain=noiseGain;this.dashFilter=filter;this.flowOsc=flowOsc;this.flowFilter=flowFilter;this.flowGain=flowGain;
    this.setFlow(this.flowLevel,this.flowMultiplier);
  }

  setFlow(flow=0,multiplier=1){
    this.flowLevel=Math.max(0,Number(flow)||0);this.flowMultiplier=Math.max(1,Number(multiplier)||1);
    if(!this.context||!this.flowOsc||!this.flowFilter||!this.flowGain)return;
    if(Math.abs(this.flowLevel-this.appliedFlowLevel)<.65&&this.flowMultiplier===this.appliedFlowMultiplier)return;
    this.appliedFlowLevel=this.flowLevel;this.appliedFlowMultiplier=this.flowMultiplier;
    const n=clamp(this.flowLevel/100),now=this.context.currentTime;
    this.flowOsc.frequency.setTargetAtTime(126+n*86+(this.flowMultiplier-1)*17,now,.12);
    this.flowFilter.frequency.setTargetAtTime(650+n*1550,now,.15);
    this.flowFilter.Q.setTargetAtTime(.9+n*1.7,now,.16);
    this.flowGain.gain.setTargetAtTime(n<.18?.0001:.002+n*.008,now,.2);
    this.dashFilter?.frequency.setTargetAtTime(600+n*260,now,.18);
  }

  stopDashNodes(fade=true){
    const c=this.context;if(!c)return;
    const now=c.currentTime,tail=fade?.08:.01;
    for(const gain of [this.dashGain,this.dashNoiseGain,this.flowGain]){
      try{
        if(gain){gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.01),now);gain.gain.exponentialRampToValueAtTime(.0001,now+tail)}
      }catch{}
    }
    for(const node of this.dashNodes){try{node.stop(now+tail+.02)}catch{}}
    this.dashNodes=[];this.dashGain=null;this.dashNoiseGain=null;this.dashFilter=null;this.flowOsc=null;this.flowFilter=null;this.flowGain=null;this.appliedFlowLevel=-1;this.appliedFlowMultiplier=-1;
  }

  stopDashLoop(fade=true){this.dashActive=false;this.stopDashNodes(fade)}

  ambienceMix(){
    const key=String(this.biome||'').toLowerCase();
    if(key.includes('waterfall'))return{wind:.026,leaves:.003,insects:.001,birds:.0007,water:.055};
    if(key.includes('storm'))return{wind:.064,leaves:.006,insects:0,birds:0,water:.018};
    if(key.includes('moon'))return{wind:.018,leaves:.002,insects:.008,birds:.0001,water:0};
    if(key.includes('canopy run'))return{wind:.043,leaves:.006,insects:.001,birds:.0005,water:0};
    if(key.includes('ancient'))return{wind:.024,leaves:.003,insects:.003,birds:.00035,water:0};
    if(key.includes('golden'))return{wind:.021,leaves:.0025,insects:.0015,birds:.00055,water:0};
    return{wind:.029,leaves:.0045,insects:.0025,birds:.0009,water:0};
  }

  applyAmbienceMix(){
    if(!this.context)return;
    const mix=this.ambienceMix(),now=this.context.currentTime,speed=clamp(this.speedNorm,0,1);
    this.windGain?.gain.setTargetAtTime(mix.wind*(.82+speed*.5),now,.35);
    this.leavesGain?.gain.setTargetAtTime(mix.leaves,now,.4);
    this.insectGain?.gain.setTargetAtTime(mix.insects,now,.45);
    this.birdGain?.gain.setTargetAtTime(mix.birds,now,.45);
    this.waterGain?.gain.setTargetAtTime(mix.water,now,.45);
    this.windFilter?.frequency.setTargetAtTime(520+speed*720+(String(this.biome).toLowerCase().includes('storm')?180:0),now,.25);
  }

  setBiome(name=''){
    const next=String(name||'THE EMERALD WILDS');
    const changed=next!==this.biome;if(!changed)return;
    this.biome=next;this.applyAmbienceMix();
    if(this.dashActive&&next.toLowerCase().includes('storm'))this.play('stage',{gain:.22,pitch:.52});
  }

  startAmbience(){
    if(!this.enabled||this.failed)return;
    if(this.ambienceNodes.length){this.applyAmbienceMix();return}
    try{
      const c=this.ensure();
      const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate*2),data=buffer.getChannelData(0);
      let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;data[i]=brown*.9}
      const noise=c.createBufferSource(),windFilter=c.createBiquadFilter(),windGain=c.createGain();
      const leavesFilter=c.createBiquadFilter(),leavesGain=c.createGain(),waterFilter=c.createBiquadFilter(),waterGain=c.createGain();
      noise.buffer=buffer;noise.loop=true;
      windFilter.type='bandpass';windFilter.frequency.value=620;windFilter.Q.value=.45;windGain.gain.value=.0001;
      leavesFilter.type='highpass';leavesFilter.frequency.value=2600;leavesGain.gain.value=.0001;
      waterFilter.type='bandpass';waterFilter.frequency.value=940;waterFilter.Q.value=.35;waterGain.gain.value=.0001;
      noise.connect(windFilter);windFilter.connect(windGain);windGain.connect(this.target('ambience'));
      noise.connect(leavesFilter);leavesFilter.connect(leavesGain);leavesGain.connect(this.target('ambience'));
      noise.connect(waterFilter);waterFilter.connect(waterGain);waterGain.connect(this.target('ambience'));noise.start();

      const insects=c.createOscillator(),insectGain=c.createGain();
      insects.type='sine';insects.frequency.value=4650;insectGain.gain.value=.0001;
      insects.connect(insectGain);insectGain.connect(this.target('ambience'));insects.start();

      const bird=c.createOscillator(),birdLfo=c.createOscillator(),birdDepth=c.createGain(),birdGain=c.createGain(),birdFilter=c.createBiquadFilter();
      bird.type='triangle';bird.frequency.value=1780;birdLfo.type='sine';birdLfo.frequency.value=.19;birdDepth.gain.value=420;
      birdFilter.type='bandpass';birdFilter.frequency.value=2050;birdFilter.Q.value=2.1;birdGain.gain.value=.0001;
      birdLfo.connect(birdDepth);birdDepth.connect(bird.frequency);bird.connect(birdFilter);birdFilter.connect(birdGain);birdGain.connect(this.target('ambience'));
      bird.start();birdLfo.start();

      this.windGain=windGain;this.windFilter=windFilter;this.leavesGain=leavesGain;this.insectGain=insectGain;this.birdGain=birdGain;this.waterGain=waterGain;
      this.ambienceNodes=[noise,insects,bird,birdLfo];this.applyAmbienceMix();
    }catch{this.failed=true}
  }

  setSpeed(normalized=1){
    this.speedNorm=clamp((normalized-.7)/1.8,0,1);
    if(Math.abs(this.speedNorm-this.appliedSpeedNorm)<.018)return;
    this.appliedSpeedNorm=this.speedNorm;this.applyAmbienceMix();
  }

  stopAmbience(){
    for(const node of this.ambienceNodes){try{node.stop?.()}catch{}}
    this.ambienceNodes=[];this.windGain=null;this.windFilter=null;this.leavesGain=null;this.insectGain=null;this.birdGain=null;this.waterGain=null;this.appliedSpeedNorm=-1;
  }

  destroy(){
    this.stopMusic();this.stopDashLoop(false);this.stopAmbience();
    this.sampleBuffers.clear();this.sampleLoads.clear();
    try{this.context?.close?.()}catch{}
    this.context=null;this.nodes=null;
  }
}
