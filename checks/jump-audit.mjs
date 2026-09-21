import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JUMP_GOALS,evaluateJumpGoals} from '../src/jumpGoals.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('src/main.js'),game=read('src/game.js'),runtime=read('src/runtimeEnhancements.js'),results=read('src/results.js');

assert(main.includes("'test'"),'test mode must route to Chimp Jump, not the launcher');
assert(main.includes("setupJumpExperience"),'the framework experience layer must mount');
assert(!runtime.includes('new KeyboardEvent'),'mouse steering must never synthesize keyboard key-up/down events');
assert(game.includes('introTime=3'),'new runs must begin at the full-route camera view');
assert(!game.includes('introTime=0'),'the old 1.72x opening zoom must not return');
assert(game.includes("chimp-jump-muted")&&game.includes("chimp-jump-detail"),'player preferences must persist');
assert(game.includes("chimp-run-finished"),'completed runs must publish a summary for goals');
assert(results.includes('Replay this trail'),'results must expose reproducible same-seed practice');

assert.equal(JUMP_GOALS.length,6,'ship six optional expedition goals');
const sample=evaluateJumpGoals({meters:120,bananas:28,cleanLandings:32},[]);
assert.equal(sample.unlocked.length,6,'a qualifying run should unlock all goals');
const repeat=evaluateJumpGoals({meters:120,bananas:28,cleanLandings:32},sample.unlocked);
assert.equal(repeat.newlyUnlocked.length,0,'goals must not announce twice');

console.log('PASS Chimp Jump audit gates: routing, single-owner input, camera, persistence, replay and goals');
