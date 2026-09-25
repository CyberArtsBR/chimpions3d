export const TRACE_VERSION=2;
export const TRACE_QUANTIZATION=125;
export const TRACE_MAX_STEPS=108000;

const clamp=value=>Math.max(-1,Math.min(1,Number(value)||0));
const encodeBase64Url=bytes=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let out='';
 for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b||0)<<8)|(c||0);out+=alphabet[(n>>18)&63]+alphabet[(n>>12)&63]+(i+1<bytes.length?alphabet[(n>>6)&63]:'')+(i+2<bytes.length?alphabet[n&63]:'');}return out;
};
const pushVarint=(bytes,value)=>{let n=value>>>0;do{let b=n&127;n>>>=7;if(n)b|=128;bytes.push(b);}while(n);};

export class InputTrace{
 constructor({maxSteps=TRACE_MAX_STEPS}={}){this.maxSteps=maxSteps;this.steps=0;this.segments=[];this.overflowed=false;}
 reset(){this.steps=0;this.segments=[];this.overflowed=false;}
 append(control){
  const q=Math.round(clamp(control)*TRACE_QUANTIZATION),applied=q/TRACE_QUANTIZATION;
  if(this.steps>=this.maxSteps){this.overflowed=true;return applied;}this.steps++;
  const last=this.segments.at(-1);if(last&&last[0]===q)last[1]++;else this.segments.push([q,1]);return applied;
 }
 toLegacy(){return this.segments.map(([q,count])=>[q*8,count]);}
 toCompact(){const bytes=[];for(const [q,count]of this.segments){bytes.push(q+TRACE_QUANTIZATION);pushVarint(bytes,count);}return Object.freeze({v:TRACE_VERSION,q:TRACE_QUANTIZATION,steps:this.steps,segments:this.segments.length,data:encodeBase64Url(bytes)});}
 toTransport(){return Object.freeze({legacy:this.toLegacy(),compact:this.toCompact(),overflowed:this.overflowed});}
}
