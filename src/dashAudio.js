// Chimpions Dash presentation audio.
// User-gesture-only Web Audio with persistent, independently mixable buses.
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

  play(kind,{gain=1,pitch=1}={}){
    if(!this.enabled||this.failed)return;
    try{
      const c=this.ensure();
      if(kind==='jump'){
        this.hoot(c.currentTime,300*pitch,540*pitch,.13,gain*.72);
        this.hoot(c.currentTime+.13,480*pitch,260*pitch,.17,gain*.72);
        return;
      }
      if(kind==='dead'||kind==='hit')this.setDash(false);
      this.oneShot(kind,gain,pitch);
    }catch{
      this.failed=true;this.enabled=false;this.stopDashLoop(false);this.stopAmbience();
    }
  }

  oneShot(kind,gain=1,pitch=1){
    const c=this.context;
    const notes={
      footstep:105,land:110,slide:145,pass:670,'near-miss':540,'perfect-jump':920,'perfect-slide':840,
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
    o.connect(filter);filter.connect(g);g.connect(this.target(ui?'ui':'sfx'));
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
    gain.gain.setValueAtTime(.0001,c.currentTime);gain.gain.linearRampToValueAtTime(.035,c.currentTime+.035);
    lfo.connect(lfoGain);lfoGain.connect(osc.frequency);osc.connect(filter);filter.connect(gain);gain.connect(this.target('sfx'));
    osc.start();lfo.start();

    const buffer=c.createBuffer(1,c.sampleRate,Math.floor(c.sampleRate*.45)),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.14;
    const noise=c.createBufferSource(),noiseFilter=c.createBiquadFilter(),noiseGain=c.createGain();
    noise.buffer=buffer;noise.loop=true;noiseFilter.type='bandpass';noiseFilter.frequency.value=1200;noiseFilter.Q.value=.7;
    noiseGain.gain.setValueAtTime(.0001,c.currentTime);noiseGain.gain.linearRampToValueAtTime(.012,c.currentTime+.035);
    noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(this.target('sfx'));noise.start();
    this.dashNodes=[osc,lfo,noise];this.dashGain=gain;this.dashNoiseGain=noiseGain;
  }

  stopDashNodes(fade=true){
    const c=this.context;if(!c)return;
    const now=c.currentTime,tail=fade?.08:.01;
    for(const gain of [this.dashGain,this.dashNoiseGain]){
      try{
        if(gain){gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value||.01),now);gain.gain.exponentialRampToValueAtTime(.0001,now+tail)}
      }catch{}
    }
    for(const node of this.dashNodes){try{node.stop(now+tail+.02)}catch{}}
    this.dashNodes=[];this.dashGain=null;this.dashNoiseGain=null;
  }

  stopDashLoop(fade=true){this.dashActive=false;this.stopDashNodes(fade)}

  startAmbience(){
    if(!this.enabled||this.failed||this.ambienceNodes.length)return;
    try{
      const c=this.ensure();
      const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate*2),data=buffer.getChannelData(0);
      let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;data[i]=brown*.9}
      const noise=c.createBufferSource(),windFilter=c.createBiquadFilter(),windGain=c.createGain();
      const leavesFilter=c.createBiquadFilter(),leavesGain=c.createGain();
      noise.buffer=buffer;noise.loop=true;
      windFilter.type='bandpass';windFilter.frequency.value=620;windFilter.Q.value=.45;windGain.gain.value=.034;
      leavesFilter.type='highpass';leavesFilter.frequency.value=2600;leavesGain.gain.value=.0045;
      noise.connect(windFilter);windFilter.connect(windGain);windGain.connect(this.target('ambience'));
      noise.connect(leavesFilter);leavesFilter.connect(leavesGain);leavesGain.connect(this.target('ambience'));noise.start();

      const insects=c.createOscillator(),insectGain=c.createGain();
      insects.type='sine';insects.frequency.value=4650;insectGain.gain.value=.003;
      insects.connect(insectGain);insectGain.connect(this.target('ambience'));insects.start();

      const bird=c.createOscillator(),birdLfo=c.createOscillator(),birdDepth=c.createGain(),birdGain=c.createGain(),birdFilter=c.createBiquadFilter();
      bird.type='triangle';bird.frequency.value=1780;birdLfo.type='sine';birdLfo.frequency.value=.19;birdDepth.gain.value=420;
      birdFilter.type='bandpass';birdFilter.frequency.value=2050;birdFilter.Q.value=2.1;birdGain.gain.value=.0009;
      birdLfo.connect(birdDepth);birdDepth.connect(bird.frequency);bird.connect(birdFilter);birdFilter.connect(birdGain);birdGain.connect(this.target('ambience'));
      bird.start();birdLfo.start();

      this.windGain=windGain;this.windFilter=windFilter;this.ambienceNodes=[noise,insects,bird,birdLfo];
    }catch{this.failed=true}
  }

  setSpeed(normalized=1){
    if(!this.windGain||!this.context)return;
    const n=clamp((normalized-.7)/1.8,0,1),now=this.context.currentTime;
    this.windGain.gain.setTargetAtTime(.025+n*.045,now,.12);
    this.windFilter?.frequency.setTargetAtTime(520+n*720,now,.15);
  }

  stopAmbience(){
    for(const node of this.ambienceNodes){try{node.stop?.()}catch{}}
    this.ambienceNodes=[];this.windGain=null;this.windFilter=null;
  }

  diagnostics(){return{enabled:this.enabled,failed:this.failed,muted:this.muted,volumes:{...this.volumes},musicWanted:this.musicWanted,musicBlocked:!!this.musicBlocked,musicError:!!this.musicError,dashActive:this.dashActive,ambienceActive:this.ambienceNodes.length>0,contextState:this.context?.state||'uninitialized'};}

  destroy(){
    this.stopMusic();this.stopDashLoop(false);this.stopAmbience();
    try{this.context?.close?.()}catch{}
    this.context=null;this.nodes=null;
  }
}
