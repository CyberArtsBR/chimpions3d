import {createServer} from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {clientIp,ephemeralIpKey} from './clientIp.mjs';
import {MemoryRateLimiter} from './rateLimiter.mjs';
import {openStore} from './store.mjs';
import {CURRENT_RULESET_VERSION,replayRun,traceDigest,validateRunTiming,validateTrace} from './replay.mjs';
import {HttpError,MAX_RECORDS_OFFSET,PROTOCOL_VERSION,RUN_TTL_MS,TRACE_VERSION,fail,readJsonBody,requireProtocolVersion,requireTraceVersion,validatePlayerName} from './protocol.mjs';

const RUN_ID_RE=/^[a-f0-9]{48}$/;
const defaultLogger=(event,fields={})=>console.log(JSON.stringify({time:new Date().toISOString(),event,...fields}));
function normalizeOrigins(values){return new Set([...values].map(value=>{try{return new URL(value).origin;}catch{return String(value).trim();}}).filter(Boolean));}
function sendJson(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function method(req,res,expected){if(req.method!==expected){res.setHeader('Allow',expected);fail(405,'METHOD_NOT_ALLOWED',`Use ${expected} for this endpoint`);}}
function versionEnvelope(){return {protocolVersion:PROTOCOL_VERSION,rulesetVersion:CURRENT_RULESET_VERSION,traceVersion:TRACE_VERSION};}
function publicResult(store,row){const rank=store.place(row);return {...versionEnvelope(),score:row.score,meters:row.meters,bananas:row.bananas,rank:row.score>0&&rank<=10?rank:null,entries:store.board()};}

export function createLeaderboardService({
 dbPath='data/scores.sqlite',allowedOrigins=['http://localhost:5173','http://127.0.0.1:4173'],trustProxy=false,
 logger=defaultLogger,clock=()=>Date.now(),rateLimiter=new MemoryRateLimiter()
}={}){
 const store=openStore(dbPath),origins=normalizeOrigins(allowedOrigins);
 const securityLog=(event,fields={})=>logger(event,fields);
 const limit=(policy,req,res)=>{
  const key=ephemeralIpKey(clientIp(req,{trustProxy}));const result=rateLimiter.check(policy,key,clock());
  if(!result.allowed){res.setHeader('Retry-After',String(result.retryAfterSeconds));securityLog('rate_limited',{policy});fail(429,'RATE_LIMITED','Please wait before trying again');}
 };
 const handler=async(req,res)=>{
  try{
   const origin=req.headers.origin;
   if(origin){let normalized;try{normalized=new URL(origin).origin;}catch{normalized=origin;}if(!origins.has(normalized)){securityLog('origin_rejected');fail(403,'ORIGIN_REJECTED','Origin is not allowed');}res.setHeader('Access-Control-Allow-Origin',normalized);}
   res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const url=new URL(req.url||'/','http://localhost');
   if(url.pathname==='/health'){
    method(req,res,'GET');sendJson(res,200,{ok:true,service:'chimp-jump-leaderboard',...versionEnvelope()});return;
   }
   if(url.pathname==='/api/leaderboard'){
    method(req,res,'GET');limit('leaderboardRead',req,res);sendJson(res,200,{...versionEnvelope(),entries:store.board()});return;
   }
   if(url.pathname==='/api/records'){
    method(req,res,'GET');limit('recordsRead',req,res);const parsed=Number.parseInt(url.searchParams.get('offset')||'0',10);const offset=Math.max(0,Math.min(MAX_RECORDS_OFFSET,Number.isFinite(parsed)?parsed:0));sendJson(res,200,{...versionEnvelope(),entries:store.records(offset)});return;
   }
   if(url.pathname==='/api/runs'){
    method(req,res,'POST');limit('runCreate',req,res);const data=await readJsonBody(req);const protocolVersion=requireProtocolVersion(data);const traceVersion=requireTraceVersion(data);
    const requestedRuleset=data.rulesetVersion??data.ruleset;if(requestedRuleset!==CURRENT_RULESET_VERSION)fail(409,'RULESET_MISMATCH','Refresh the game to use the current scoring rules');
    const now=clock(),id=randomBytes(24).toString('hex'),seed=randomInt(0,4294967296),expires=now+RUN_TTL_MS;
    store.createRun({id,seed,started:now,expires,ruleset:CURRENT_RULESET_VERSION,protocolVersion,traceVersion});securityLog('run_created',{rulesetVersion:CURRENT_RULESET_VERSION,traceVersion});
    sendJson(res,201,{...versionEnvelope(),runId:id,id,seed,createdAt:now,expiresAt:expires});return;
   }
   const match=url.pathname.match(/^\/api\/runs\/([a-f0-9]{48})\/(finish|name)$/);
   if(!match)fail(404,'NOT_FOUND','Not found');
   method(req,res,'POST');const [,runId,action]=match;limit(action==='finish'?'runFinish':'runName',req,res);
   if(!RUN_ID_RE.test(runId))fail(404,'RUN_NOT_FOUND','Run not found');
   let row=store.getRun(runId);if(!row)fail(404,'RUN_NOT_FOUND','Run not found');const now=clock();
   if(now>(row.expires??row.started+RUN_TTL_MS)){securityLog('expired_run');fail(410,'RUN_EXPIRED','Run expired');}
   const data=await readJsonBody(req);requireProtocolVersion(data);const suppliedRuleset=data.rulesetVersion??data.ruleset;
   if(suppliedRuleset!=null&&suppliedRuleset!==row.ruleset)fail(409,'RULESET_MISMATCH','Run ruleset does not match its server ticket');
   if(action==='finish'){
    const traceVersion=requireTraceVersion(data);if(row.trace_version!=null&&traceVersion!==row.trace_version)fail(400,'TRACE_VERSION_MISMATCH','Trace version does not match its server ticket');
    if(data.seed!=null&&(!Number.isInteger(data.seed)||data.seed!==row.seed))fail(400,'SEED_MISMATCH','Submitted seed does not match its server ticket');
    validateTrace(data.trace,traceVersion);const hash=traceDigest(data.trace,traceVersion);
    if(row.finished){if(row.trace_hash&&row.trace_hash!==hash)fail(409,'RUN_ALREADY_FINISHED','Run was already finalized with different input');sendJson(res,200,publicResult(store,row));return;}
    if(row.ruleset!==CURRENT_RULESET_VERSION)fail(409,'RULESET_UNAVAILABLE','This run requires a ruleset that is not available on this server');
    const result=replayRun(row.seed,data.trace,traceVersion);validateRunTiming(row.started,now,result.seconds);const write=store.finishRun(row.id,now,result,hash);row=store.getRun(row.id);
    if(write.changes===0&&row.trace_hash&&row.trace_hash!==hash)fail(409,'RUN_ALREADY_FINISHED','Run was already finalized with different input');securityLog('run_completed',{steps:result.steps,score:row.score});sendJson(res,200,publicResult(store,row));return;
   }
   const name=validatePlayerName(data.name);if(!row.finished)fail(409,'RUN_NOT_FINISHED','Finish the run first');
   if(row.name){if(row.name!==name)fail(409,'RUN_ALREADY_NAMED','This run already has a leaderboard name');sendJson(res,200,{...versionEnvelope(),rank:store.place(row),entries:store.board()});return;}
   const result=store.withImmediateTransaction(()=>{const current=store.getRun(row.id);if(current.name){if(current.name!==name)fail(409,'RUN_ALREADY_NAMED','This run already has a leaderboard name');return {row:current,rank:store.place(current)};}const rank=store.place(current);if(rank>10||current.score<=0)fail(409,'SCORE_NOT_TOP_10','Another player moved this score out of the top 10');store.setName(current.id,name);return {row:store.getRun(current.id),rank};});
   sendJson(res,200,{...versionEnvelope(),rank:result.rank,entries:store.board()});
  }catch(error){
   const known=error instanceof HttpError;if(known){if(error.code==='BODY_TOO_LARGE')securityLog('body_too_large');else if(error.code==='INVALID_TRACE'||error.code.startsWith('TRACE_'))securityLog('invalid_trace',{code:error.code});else if(error.code==='TIMING_REJECTED')securityLog('timing_rejected');}
   else console.error(JSON.stringify({time:new Date().toISOString(),event:'internal_error',message:error?.message||'Unknown error'}));
   if(!res.headersSent)sendJson(res,known?error.status:500,{error:known?error.message:'Leaderboard temporarily unavailable',code:known?error.code:'INTERNAL_ERROR'});else res.end();
  }
 };
 const server=createServer(handler);const cleanup=setInterval(()=>{rateLimiter.cleanup(clock());store.cleanupExpired(clock());},60_000);cleanup.unref();
 return {server,store,handler,closeResources(){clearInterval(cleanup);store.close();}};
}
