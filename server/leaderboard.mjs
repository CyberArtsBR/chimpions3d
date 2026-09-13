import {createServer} from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Game,STEP,RULESET} from '../src/physics.js';
import {scoreFor} from '../src/score.js';

const dbPath=resolve(process.env.SCORES_DB||'data/scores.sqlite');mkdirSync(dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,seed INTEGER NOT NULL,started INTEGER NOT NULL,finished INTEGER,meters INTEGER,bananas INTEGER,score INTEGER,name TEXT,ruleset TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ranking ON runs(score DESC,finished ASC,id ASC);`);
const origins=new Set((process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:4173').split(',').map(s=>s.trim()));
const board=()=>db.prepare('SELECT name,meters,bananas,score FROM runs WHERE name IS NOT NULL ORDER BY score DESC,finished ASC,id ASC LIMIT 10').all();
const place=row=>1+db.prepare('SELECT count(*) AS n FROM runs WHERE name IS NOT NULL AND (score>? OR (score=? AND (finished<? OR (finished=? AND id<?))))').get(row.score,row.score,row.finished,row.finished,row.id).n;
const limits=new Map();
setInterval(()=>{const now=Date.now();for(const [key,v]of limits)if(v.until<now)limits.delete(key);db.prepare('DELETE FROM runs WHERE finished IS NULL AND started<?').run(now-86400000);},60000).unref();
function fail(status,message){throw Object.assign(new Error(message),{status});}
async function body(req){let text='',size=0;for await(const part of req){size+=part.length;if(size>1500000)fail(413,'Run data is too large');text+=part;}try{return JSON.parse(text);}catch{fail(400,'Invalid JSON');}}
function replay(seed,trace){
 if(!Array.isArray(trace)||trace.length>108000)fail(400,'Invalid run');
 const g=new Game(seed);let steps=0;
 for(const segment of trace){
  if(!Array.isArray(segment)||segment.length!==2)fail(400,'Invalid input');
  const [axis,count]=segment;
  if(!Number.isInteger(axis)||Math.abs(axis)>1000||!Number.isInteger(count)||count<1||count>108000||(steps+=count)>108000)fail(400,'Invalid input');
  for(let i=0;i<count;i++){if(g.dead)fail(400,'Input after game over');g.step(axis/1000,STEP);}
 }
 if(!g.dead)fail(400,'Run has not ended');
 return {meters:Math.floor(g.height),bananas:g.bananas,score:scoreFor(g.height,g.bananas),seconds:steps*STEP};
}
createServer(async(req,res)=>{
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{
  const origin=req.headers.origin;if(origin&&!origins.has(origin))fail(403,'Origin is not allowed');
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health'){send(200,{ok:true});return;}
  if(req.method==='GET'&&url.pathname==='/api/leaderboard'){send(200,{entries:board()});return;}
  if(req.method==='GET'&&url.pathname==='/api/records'){
   const offset=Math.max(0,Math.min(1000000,Number.parseInt(url.searchParams.get('offset')||'0',10)||0));
   send(200,{entries:db.prepare('SELECT name,meters,bananas,score,finished FROM runs WHERE name IS NOT NULL ORDER BY finished DESC,id DESC LIMIT 20 OFFSET ?').all(offset)});return;
  }
  if(req.method!=='POST')fail(404,'Not found');
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];const now=Date.now();let rate=limits.get(ip);
  if(!rate||rate.until<now){rate={count:0,until:now+60000};limits.set(ip,rate);}if(++rate.count>30)fail(429,'Please wait before trying again');
  if(url.pathname==='/api/runs'){
   const data=await body(req);if(data.ruleset!==RULESET)fail(409,'Refresh the game to use the current scoring rules');
   const id=randomBytes(24).toString('hex'),seed=randomInt(0,4294967296);db.prepare('INSERT INTO runs(id,seed,started,ruleset) VALUES(?,?,?,?)').run(id,seed,now,RULESET);send(201,{id,seed});return;
  }
  const match=url.pathname.match(/^\/api\/runs\/([a-f0-9]{48})\/(finish|name)$/);if(!match)fail(404,'Not found');
  const row=db.prepare('SELECT * FROM runs WHERE id=?').get(match[1]);if(!row)fail(404,'Run expired');
  if(now-row.started>86400000)fail(410,'Run expired');
  const data=await body(req);
  if(match[2]==='finish'){
   if(!row.finished){
    if(row.ruleset!==RULESET)fail(409,'The scoring rules changed during this run. Start a new run.');
    const result=replay(row.seed,data.trace);
    if(result.seconds>(now-row.started)/1000+5)fail(400,'Run timing is invalid');
    db.prepare('UPDATE runs SET finished=?,meters=?,bananas=?,score=? WHERE id=? AND finished IS NULL').run(now,result.meters,result.bananas,result.score,row.id);
   }
   const saved=db.prepare('SELECT * FROM runs WHERE id=?').get(row.id),rank=place(saved);
   send(200,{score:saved.score,meters:saved.meters,bananas:saved.bananas,rank:saved.score>0&&rank<=10?rank:null,entries:board()});return;
  }
  if(!row.finished)fail(409,'Finish the run first');
  const name=typeof data.name==='string'?data.name.trim().normalize('NFC'):'';
  if(!/^[\p{L}\p{N} ._-]{1,10}$/u.test(name))fail(400,'Use 1–10 letters, numbers or spaces');
  if(row.name){send(200,{rank:place(row),entries:board()});return;}
  // This synchronous transaction makes simultaneous tenth-place claims atomic.
  db.exec('BEGIN IMMEDIATE');
  try{
   const rank=place(row);if(rank>10||row.score<=0)fail(409,'Another player moved this score out of the top 10');
   db.prepare('UPDATE runs SET name=? WHERE id=?').run(name,row.id);db.exec('COMMIT');send(200,{rank,entries:board()});
  }catch(error){db.exec('ROLLBACK');throw error;}
 }catch(error){if(!error.status)console.error(error);if(!res.headersSent)send(error.status||500,{error:error.status?error.message:'Leaderboard temporarily unavailable'});else res.end();}
}).listen(Number(process.env.PORT||3001),'0.0.0.0',()=>console.log('Leaderboard listening'));
