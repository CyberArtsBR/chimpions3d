# Chimp Jump — Framework Audit & Polish Pass

Date: 2026-09-21  
Scope: Chimp Jump only. Stack remains Vite + vanilla JavaScript + Three.js.

## Experience target

**Mechanics:** automatic bounce, left/right air steering, deterministic seeded routes, edge wrap, readable branch types, bananas, jetpack, one-life runs.  
**Dynamics:** the player reads the next landing while already airborne, decides between the guaranteed route and optional risk/reward branches, and gradually adapts to the pace ramp.  
**Aesthetics:** a warm expedition through a living canopy; readable arcade silhouettes take priority over cinematic camera effects.

The pass deliberately does not change gravity, steering speed, landing forgiveness, generated route rules, or leaderboard scoring. Those systems already have deterministic simulation coverage and changing them without real playtest evidence would risk fairness.

## Audit findings and changes

| Area | Finding | Risk | Action |
| --- | --- | --- | --- |
| Test routing | Browser checks use `?test=1`, but the app router did not recognize `test`, so checks opened the cartridge launcher instead of Chimp Jump. | Critical | `test` now routes to Chimp Jump and the test API. |
| Mouse / keyboard | Mouse steering existed in both `game.js` and `runtimeEnhancements.js`. The second path synthesized Arrow key events; its synthetic key-up could cancel a real held key. | High | Removed synthetic mouse-key translation. `game.js` is the single gameplay mouse-input owner. |
| Opening camera | Fresh runs reset `introTime=0`, starting at 1.72x zoom and following the avatar for three seconds. This hid route context during the most important onboarding jumps and contradicted the design brief. | High | Fresh runs begin at the full gameplay view. Spring/jet camera feedback remains subtle; Reduced Motion fixes zoom at 1.0. |
| Title-screen GPU work | The opaque illustrated title screen hid the Three.js world, but the renderer kept drawing it at idle cadence. | Medium | Skip world rendering while the opaque Chimp Jump menu is active. Loading and UI state continue normally. |
| Menu status | The illustrated menu intentionally hides most legacy HTML, which also hid model loading/error feedback and control explanation. | Medium | Added independent, accessible runtime status plus a compact control hint and Field Guide. |
| Accessibility | CSS respected OS reduced-motion in a few places, but gameplay turn/camera feedback did not have a persistent player setting. | Medium | Added persistent Reduced Motion and High-Visibility HUD settings. Reduced Motion removes camera impulse/zoom and makes facing changes immediate. |
| Settings persistence | Audio sliders persisted, but mute and desktop detail preference did not. | Low | Mute and desktop detail now persist locally. |
| Repetitive SFX | Normal landing is the most frequent gameplay sound and competed with music over long runs. | Low | Normal bounce SFX gain reduced; special branch impacts retain stronger feedback. |
| Replayability | A failed deterministic route could not be intentionally retried, despite every run already having a seed. | Medium | Results now offer **Replay this trail**. Same-seed replay is explicitly practice/offline so it cannot mismatch server leaderboard validation. |
| Content goals | Progress was mostly personal best / leaderboard. | Medium | Added six optional persistent expedition goals: two altitude, two banana, two clean-landing goals. |
| Collision forgiveness | Landing already uses swept descending collision and an extra horizontal margin of 0.24 world units. | Keep | Retained. No evidence justified making the collider stricter or looser. |
| Difficulty progression | Guaranteed route is generated before optional risk routes; altitude narrows choices while the real-time pace increases gradually. | Keep / playtest | Retained for this pass. Tune only from measured player failure data. |
| Lighting / graphics | Current scene already uses ACES tone mapping, environment lighting, warm key, cool rim/fill, fog, authored branch assets and mobile detail budgeting. | Keep | No speculative lighting retune without a visual/device comparison. Improvements in this pass target route readability and HUD clarity instead. |
| Mobile | Core touch targets are already large and physics are device-independent. | Keep + improve | Field Guide/comfort UI uses safe-area-aware responsive layout; gameplay rules remain identical. |

## New expedition goals

1. **Canopy Scout** — reach 25 m.
2. **High Climber** — reach 100 m.
3. **Banana Pocket** — collect 10 bananas in one run.
4. **Banana Haul** — collect 25 bananas in one run.
5. **Sure Footed** — make 12 clean normal/moving-branch landings.
6. **Canopy Rhythm** — make 30 clean normal/moving-branch landings.

Goals are optional, local, and do not modify leaderboard score.

## Quality gates

The production workflow now runs `checks/jump-audit.mjs` in addition to build, physics, and asset checks. It asserts:

- test mode reaches Chimp Jump;
- the experience layer is mounted;
- runtime enhancements cannot synthesize keyboard input for mouse steering;
- the old 1.72x opening-camera reset cannot return;
- mute/detail persistence remains present;
- run summaries remain available for expedition goals;
- same-seed replay remains exposed;
- exactly six goals ship and their unlock logic is idempotent.

Existing physics checks remain the authority for deterministic route/collision behavior.

## Manual/device gates still required

Automated checks cannot honestly establish sustained FPS, thermal behavior, controller feel, or whether a HUD overlaps a specific phone cutout. Before calling the pass production-final, playtest:

- one current desktop browser with keyboard, mouse and controller;
- one narrow iPhone-class viewport and one midrange Android device;
- start → pause/resume → death → retry → replay-same-seed;
- reduced motion on/off and high-visibility HUD on/off;
- at least one 5+ minute run to judge the late pace ramp and repeated landing audio;
- representative large-accessory and wide-shoulder Chimpion rigs.

Recommended tuning criterion after human testing: record the altitude/time of the first three failures for new players before changing physics. Prefer route/difficulty changes supported by those failures rather than camera or collider guesswork.
