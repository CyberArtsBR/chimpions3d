import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {LEADERBOARD_LIMIT,RECORDS_PAGE_SIZE,RUN_TTL_MS} from './protocol.mjs';

const EXPIRED_RUN_RETENTION_MS=24*60*60*1000;
function ensureColumn(db,name,declaration){
 const columns=new Set(db.prepare('PRAGMA table_info(runs)').all().map(row=>row.name));
 if(!columns.has(name))db.exec(`ALTER TABLE runs ADD COLUMN ${name} ${declaration}`);
}
export function openStore(dbFile){
 const dbPath=resolve(dbFile);mkdirSync(dirname(dbPath),{recursive:true});
 const db=new DatabaseSync(dbPath);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS runs(
  id TEXT PRIMARY KEY CHECK(length(id)=48),
  seed INTEGER NOT NULL CHECK(seed BETWEEN 0 AND 4294967295),
  started INTEGER NOT NULL,
  expires INTEGER,
  finished INTEGER,
  meters INTEGER CHECK(meters IS NULL OR meters>=0),
  bananas INTEGER CHECK(bananas IS NULL OR bananas>=0),
  score INTEGER CHECK(score IS NULL OR score>=0),
  name TEXT CHECK(name IS NULL OR length(name)<=10),
  ruleset TEXT NOT NULL,
  protocol_version INTEGER,
  trace_version INTEGER,
  trace_hash TEXT
 );
 CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY);`);
 ensureColumn(db,'expires','INTEGER');
 ensureColumn(db,'protocol_version','INTEGER');
 ensureColumn(db,'trace_version','INTEGER');
 ensureColumn(db,'trace_hash','TEXT');
 db.exec(`CREATE INDEX IF NOT EXISTS ranking ON runs(score DESC,finished ASC,id ASC);
 CREATE INDEX IF NOT EXISTS runs_recent ON runs(finished DESC,id DESC);
 CREATE INDEX IF NOT EXISTS runs_expiry ON runs(expires) WHERE finished IS NULL;`);
 const backfill=db.prepare('UPDATE runs SET expires=started+? WHERE expires IS NULL');backfill.run(RUN_TTL_MS);
 db.exec(`BEGIN IMMEDIATE;
 UPDATE runs SET score=MAX(0,meters)+MAX(0,bananas)*10
 WHERE finished IS NOT NULL AND NOT EXISTS(SELECT 1 FROM migrations WHERE id='altitude-plus-bananas-v1');
 INSERT OR IGNORE INTO migrations(id) VALUES('altitude-plus-bananas-v1');
 COMMIT;`);
 const q={
  board:db.prepare(`SELECT name,meters,bananas,score FROM runs WHERE name IS NOT NULL ORDER BY score DESC,finished ASC,id ASC LIMIT ${LEADERBOARD_LIMIT}`),
  records:db.prepare(`SELECT name,meters,bananas,score,finished FROM runs WHERE name IS NOT NULL ORDER BY finished DESC,id DESC LIMIT ${RECORDS_PAGE_SIZE} OFFSET ?`),
  place:db.prepare('SELECT count(*) AS n FROM runs WHERE name IS NOT NULL AND (score>? OR (score=? AND (finished<? OR (finished=? AND id<?))))'),
  insert:db.prepare('INSERT INTO runs(id,seed,started,expires,ruleset,protocol_version,trace_version) VALUES(?,?,?,?,?,?,?)'),
  get:db.prepare('SELECT * FROM runs WHERE id=?'),
  finish:db.prepare('UPDATE runs SET finished=?,meters=?,bananas=?,score=?,trace_hash=? WHERE id=? AND finished IS NULL'),
  name:db.prepare('UPDATE runs SET name=? WHERE id=? AND name IS NULL'),
  cleanup:db.prepare('DELETE FROM runs WHERE finished IS NULL AND expires<?')
 };
 const api={
  dbPath,
  board:()=>q.board.all(),
  records:offset=>q.records.all(offset),
  place:row=>1+q.place.get(row.score,row.score,row.finished,row.finished,row.id).n,
  createRun:run=>q.insert.run(run.id,run.seed,run.started,run.expires,run.ruleset,run.protocolVersion,run.traceVersion),
  getRun:id=>q.get.get(id),
  finishRun:(id,now,result,hash)=>q.finish.run(now,result.meters,result.bananas,result.score,hash,id),
  setName:(id,name)=>q.name.run(name,id),
  withImmediateTransaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},
  cleanupExpired(now=Date.now()){return q.cleanup.run(now-EXPIRED_RUN_RETENTION_MS).changes;},
  close(){db.close();}
 };
 return api;
}
