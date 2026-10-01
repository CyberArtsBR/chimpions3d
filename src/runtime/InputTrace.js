export const TRACE_VERSION=2;
export const TRACE_QUANTIZATION=125;
export const TRACE_MAX_STEPS=108000;

const clamp=value=>Math.max(-1,Math.min(1,Number(value)||0));
const encodeBase64Url=bytes=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let out='';
 for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b||0)<<8)|(c||0);out+=alphabet[(n>>18)&63]+alphabet[(n>>12)&63]+(i+1<bytes.length?alphabet[(n>>6)&63]:'')+(i+2<bytes.length?alphabet[n&63]:'');}return out;
};
const pushVarint=(bytes,value)=>{let n=value>>>0;do{let b=n&127;n>>>=7;if(n)b|=128;bytes.push(b);}while(n);};
const controlValue=(steer,fastFall,direction=1)=>{
 if(!fastFall)return steer;
 const facing=Math.sign(steer)||Math.sign(direction)||1;
 return Object.freeze({steer,fastFall:true,direction:facing,valueOf(){return Math.abs(steer)>.0001?steer:facing*1e-9;},toString(){return String(steer);}});
};

export class InputTrace{
 constructor({maxSteps=TRACE_MAX_STEPS}={}){this.maxSteps=maxSteps;this.steps=0;this.segments=[];this.overflowed=false;this.hasFastFall=false;}
 reset(){this.steps=0;this.segments=[];this.overflowed=false;this.hasFastFall=false;}
 append(control){
  const fastFall=!!control?.fastFall,raw=control&&typeof control==='object'&&Number.isFinite(Number(control.steer))?Number(control.steer):Number(control);
  const q=Math.round(clamp(raw)*TRACE_QUANTIZATION),applied=q/TRACE_QUANTIZATION,direction=control?.direction||Math.sign(applied)||1;
  if(this.steps>=this.maxSteps){this.overflowed=true;return controlValue(applied,fastFall,direction);}this.steps++;this.hasFastFall||=fastFall;
  const last=this.segments.at(-1),lastFast=!!last?.[2];
  if(last&&last[0]===q&&lastFast===fastFall)last[1]++;
  else this.segments.push(fastFall?[q,1,1]:[q,1]);
  return controlValue(applied,fastFall,direction);
 }
 toLegacy(){return this.segments.map(segment=>segment[2]?[segment[0]*8,segment[1],1]:[segment[0]*8,segment[1]]);}
 toCompact(){const bytes=[];for(const [q,count]of this.segments){bytes.push(q+TRACE_QUANTIZATION);pushVarint(bytes,count);}return Object.freeze({v:TRACE_VERSION,q:TRACE_QUANTIZATION,steps:this.steps,segments:this.segments.length,data:encodeBase64Url(bytes)});}
 toTransport(){return Object.freeze({legacy:this.toLegacy(),compact:this.hasFastFall?null:this.toCompact(),overflowed:this.overflowed});}
}
