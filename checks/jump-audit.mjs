import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JUMP_GOALS,evaluateJumpGoals} from '../src/jumpGoals.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('src/main.js'),game=read('src/game.js'),runtime=read('src/runtimeEnhancements.js'),results=read('src/results.js'),physics=read('src/physics.js'),scenery=read('src/scenery.js'),audio=read('src/audio.js');

assert(main.includes("'test'"),'test mode must route to Chimp Jump, not the launcher');
assert(main.includes("setupJumpExperience"),'the framework experience layer must mount');
assert(!runtime.includes('new KeyboardEvent'),'mouse steering must never synthesize keyboard key-up/down events');
assert(!runtime.includes('columns=3'),'desktop character navigation must not hardcode the old three-column grid');
assert(game.includes('countdownTime=3')&&game.includes('introTime=0'),'fresh runs must begin in the frozen countdown close-up');
assert(game.includes('const startZoom=2.08'),'countdown and intro must keep the requested character close-up');
assert(!game.includes('const startZoom=1.72'),'the old opening zoom must not return');
assert(game.includes("chimp-jump-muted")&&game.includes("chimp-jump-detail"),'player preferences must persist');
assert(game.includes("entry.id==='chimpion'"),'startup must use the known lightweight default avatar instead of a random GLB');
assert(game.includes("chimp-run-finished"),'completed runs must publish a summary for goals');
assert(results.includes('Replay this trail'),'results must expose reproducible same-seed practice');
for(const type of ["'leaf'","'vanish'","'swing'"])assert(physics.includes(type),'canopy expansion must retain '+type+' platform generation');
assert(!physics.includes('windAt')&&physics.includes("'event-start'"),'wind must be absent while timed canopy events remain wired into physics');
assert(physics.includes("'thorn-pod'"),'environmental thorn hazards must remain enabled');
assert(scenery.includes('animateHazard')&&scenery.includes('jetTrail'),'hazard animation and jet trail polish must remain');
assert(audio.includes('setIntensity')&&audio.includes('milestone'),'reactive music and milestone audio must remain');
assert(game.includes("countdown.id='countdown'")&&game.includes("mode='starting'")&&game.includes('finishCountdown'),'run countdown must remain wired before gameplay');
assert(game.includes('BANANA_HEIGHT+Math.sin'),'banana visuals must remain elevated above branches');
assert(physics.includes('BANANA_HEIGHT=1.35')&&physics.includes('safeBanana')&&physics.includes('optionalBanana'),'banana height and randomized spawn distribution must remain');
assert(!scenery.includes('const edgeVines=new THREE.Group'),'screen-edge vine curtain must stay removed');
assert(!scenery.includes('rope=mesh(logGeo,vineGlow,swingRig'),'swing branches must not draw long ropes into the screen border');

assert.equal(JUMP_GOALS.length,6,'ship six optional expedition goals');
const sample=evaluateJumpGoals({meters:120,bananas:28,cleanLandings:32},[]);
assert.equal(sample.unlocked.length,6,'a qualifying run should unlock all goals');
const repeat=evaluateJumpGoals({meters:120,bananas:28,cleanLandings:32},sample.unlocked);
assert.equal(repeat.newlyUnlocked.length,0,'goals must not announce twice');

console.log('PASS Chimp Jump audit gates: routing, desktop input/navigation, camera, persistence, replay, goals and canopy expansion');
