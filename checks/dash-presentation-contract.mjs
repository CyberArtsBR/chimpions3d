import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu=fs.readFileSync('src/menuScreensV2.js','utf8');
const finalCss=fs.readFileSync('src/menuScreensFinal.css','utf8');
const dash=fs.readFileSync('src/chimpionsLab.js','utf8');
const dashCss=fs.readFileSync('src/chimpionsLab.css','utf8');
const audio=fs.readFileSync('src/dashAudio.js','utf8');

assert(!menu.includes('beginWhenReady'),'Dash picker must not poll for avatar readiness');
assert(!menu.includes('setTimeout(beginWhenReady'),'Dash picker must not poll a disabled start button');
assert(menu.includes("className='dash-entry-start'"),'Dash START must be a real HTML button');
assert(menu.includes("start.textContent='START DASH'"),'Dash START must have visible text');
assert(finalCss.includes('.dash-entry-actions>.dash-entry-start'),'Dash START must have explicit visible CSS');
assert(finalCss.includes('opacity:1!important'),'Dash entry controls must be visible');
assert(menu.includes("api.selectAvatar(selected.id,{timeoutMs:15000})"),'Picker must await explicit avatar readiness with timeout');
assert(dash.includes('Chimpion load timed out'),'Runtime must enforce avatar load timeout');
assert(dash.includes('cancelAvatarLoad'),'Runtime must expose avatar load cancellation');
for(const bus of ['master','music','sfx','ui','ambience'])assert(audio.includes(`'${bus}'`),`Missing ${bus} audio bus`);
for(const id of ['dash-score','dash-distance','dash-best','dash-bananas','dash-flow-value','dash-mult','dash-stage-number'])assert(dash.includes(`id="${id}"`),`Missing HUD field ${id}`);
for(const id of ['result-score','result-distance','result-bananas','result-golden','result-stage','result-flow','result-combo','result-best','result-pb'])assert(dash.includes(`id="${id}"`),`Missing result field ${id}`);
for(const id of ['setting-master','setting-music','setting-sfx','setting-ui','setting-ambience','setting-mute','setting-reduced-motion','setting-high-visibility','setting-screen-shake','setting-haptics','setting-large-touch'])assert(dash.includes(`id="${id}"`),`Missing setting ${id}`);
assert(dash.includes("slideCodes=new Set(['ArrowDown','ShiftLeft','ShiftRight','KeyS'])"),'Keyboard slide bindings must match the presentation spec');
assert(dash.includes('chimpions-dash-foot-contact'),'Footsteps must consume foot-contact events instead of using a timer');
assert(dash.includes('pagehide'),'Audio must clean up on page exit');
assert(dashCss.includes('safe-area-inset-top')&&dashCss.includes('safe-area-inset-bottom'),'Dash UI must respect safe areas');
assert(finalCss.includes('safe-area-inset-left')&&finalCss.includes('safe-area-inset-right'),'Dash entry UI must respect safe areas');
assert(dashCss.includes('dash-reduced-motion'),'Reduced Motion styling missing');
assert(dashCss.includes('dash-high-visibility'),'High Visibility styling missing');
assert(dashCss.includes('data-input-device="touch"'),'Active input device styling missing');

console.log('PASS dash presentation contract');
