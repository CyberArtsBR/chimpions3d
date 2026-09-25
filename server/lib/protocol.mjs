export const PROTOCOL_VERSION=1;
export const TRACE_VERSION=1;
export const MAX_BODY_BYTES=1_500_000;
export const MAX_STEPS=108_000;
export const MAX_TRACE_SEGMENTS=108_000;
export const MAX_SEGMENT_STEPS=108_000;
export const RUN_TTL_MS=24*60*60*1000;
export const TIMING_GRACE_MS=5_000;
export const LEADERBOARD_LIMIT=10;
export const RECORDS_PAGE_SIZE=20;
export const MAX_RECORDS_OFFSET=10_000;

export class HttpError extends Error{
 constructor(status,code,message){super(message);this.name='HttpError';this.status=status;this.code=code;}
}
export function fail(status,code,message){throw new HttpError(status,code,message);}
export function asObject(value,code='INVALID_REQUEST'){
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,code,'Request body must be a JSON object');
 return value;
}
export function requireProtocolVersion(data,{legacy=true}={}){
 const value=data.protocolVersion;
 if(value==null&&legacy)return PROTOCOL_VERSION;
 if(!Number.isInteger(value)||value!==PROTOCOL_VERSION)fail(409,'UNSUPPORTED_PROTOCOL','Refresh the game to use the supported leaderboard protocol');
 return value;
}
export function requireTraceVersion(data,{legacy=true}={}){
 const value=data.traceVersion;
 if(value==null&&legacy)return TRACE_VERSION;
 if(!Number.isInteger(value)||value!==TRACE_VERSION)fail(400,'UNSUPPORTED_TRACE_VERSION','Unsupported input trace version');
 return value;
}
export function validatePlayerName(value){
 const name=typeof value==='string'?value.trim().normalize('NFC'):'';
 if(!/^[\p{L}\p{N} ._-]{1,10}$/u.test(name))fail(400,'INVALID_PLAYER_NAME','Use 1–10 letters, numbers, spaces, dots, underscores or hyphens');
 return name;
}
export async function readJsonBody(req,{maxBytes=MAX_BODY_BYTES}={}){
 const type=String(req.headers['content-type']||'').split(';',1)[0].trim().toLowerCase();
 if(type!=='application/json')fail(415,'UNSUPPORTED_MEDIA_TYPE','Content-Type must be application/json');
 const declared=Number(req.headers['content-length']);
 if(Number.isFinite(declared)&&declared>maxBytes)fail(413,'BODY_TOO_LARGE','Request body is too large');
 let size=0;const chunks=[];
 for await(const part of req){
  const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);size+=chunk.length;
  if(size>maxBytes){req.resume?.();fail(413,'BODY_TOO_LARGE','Request body is too large');}
  chunks.push(chunk);
 }
 if(size===0)fail(400,'INVALID_JSON','Request body must contain JSON');
 try{return asObject(JSON.parse(Buffer.concat(chunks,size).toString('utf8')));}
 catch(error){if(error instanceof HttpError)throw error;fail(400,'INVALID_JSON','Malformed JSON');}
}
