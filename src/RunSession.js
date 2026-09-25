export const RUN_STATE=Object.freeze({IDLE:'IDLE',PREPARING:'PREPARING',ONLINE_READY:'ONLINE_READY',OFFLINE_READY:'OFFLINE_READY',STARTING:'STARTING',PLAYING:'PLAYING',FINISHED:'FINISHED'});
const defaultSeed=()=>{const a=new Uint32Array(1);globalThis.crypto?.getRandomValues?.(a);return (a[0]??Math.floor(Math.random()*4294967296))>>>0;};
const validTicket=ticket=>ticket&&typeof ticket.id==='string'&&ticket.id&&Number.isFinite(Number(ticket.seed));

export class RunSession{
 constructor({beginOnline,randomSeed=defaultSeed,now=()=>Date.now(),retryCooldownMs=5000}={}){this.beginOnline=beginOnline;this.randomSeed=randomSeed;this.now=now;this.retryCooldownMs=retryCooldownMs;this.state=RUN_STATE.IDLE;this.epoch=0;this.ticket=null;this.pending=null;this.lastFailureAt=-Infinity;this.current=null;}
 prepare(){
  if(!this.beginOnline||this.ticket||this.pending||[RUN_STATE.STARTING,RUN_STATE.PLAYING].includes(this.state)||this.now()-this.lastFailureAt<this.retryCooldownMs)return this.pending;
  const epoch=this.epoch;this.state=RUN_STATE.PREPARING;
  const pending=Promise.resolve().then(()=>this.beginOnline()).then(ticket=>{
   if(this.epoch!==epoch||this.pending!==pending)return null;
   if(!validTicket(ticket))throw new Error('Invalid online run ticket');this.ticket={id:ticket.id,seed:Number(ticket.seed)>>>0};this.state=RUN_STATE.ONLINE_READY;return this.ticket;
  }).catch(()=>{if(this.epoch===epoch&&this.pending===pending){this.ticket=null;this.lastFailureAt=this.now();this.state=RUN_STATE.OFFLINE_READY;}return null;}).finally(()=>{if(this.pending===pending)this.pending=null;});
  this.pending=pending;return pending;
 }
 commit({replaySeed=null}={}){
  const readyTicket=this.ticket;this.epoch++;this.ticket=null;this.pending=null;this.state=RUN_STATE.STARTING;
  if(replaySeed!==null&&replaySeed!==undefined){this.current={seed:Number(replaySeed)>>>0,ticket:null,online:false,practice:true};return Object.freeze({...this.current});}
  if(validTicket(readyTicket))this.current={seed:Number(readyTicket.seed)>>>0,ticket:readyTicket,online:true,practice:false};
  else this.current={seed:this.randomSeed()>>>0,ticket:null,online:false,practice:false};
  return Object.freeze({...this.current});
 }
 markPlaying(){if(this.state===RUN_STATE.STARTING)this.state=RUN_STATE.PLAYING;}
 finish(){this.state=RUN_STATE.FINISHED;return this.current;}
 abandon(){this.epoch++;this.ticket=null;this.pending=null;this.current=null;this.state=RUN_STATE.IDLE;}
 get onlineSubmitCapable(){return !!this.current?.online&&!!this.current?.ticket?.id;}
}
