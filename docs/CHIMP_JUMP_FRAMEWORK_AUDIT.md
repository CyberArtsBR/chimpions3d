# Chimp Jump — Framework Audit & Polish Pass

Date: 2026-09-21  
Scope: Chimp Jump browser/desktop only. Stack remains Vite + vanilla JavaScript + Three.js. Mobile behavior is outside the acceptance criteria for this pass.

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
| Lighting / graphics | Current scene already uses ACES tone mapping, environment lighting, warm key, cool rim/fill, fog and authored branch assets. | Keep / verify | Desktop visual acceptance is now validated in Chromium at 1440×900 and 1920×1080 before merge. |
| Desktop character picker | Controller navigation assumed three columns although the desktop grid renders four. | High | Navigation now detects the actual rendered column count so controller focus moves one real row at a time. |
| Initial avatar load | Startup selected a random GLB from the 207-character catalog before the player chose a character, making first-load cost unpredictable. | High | Startup now uses the known `model/chimpion.glb` default; the rest of the collection remains on-demand. |

## New expedition goals

1. **Canopy Scout** — reach 25 m.
2. **High Climber** — reach 100 m.
3. **Banana Pocket** — collect 10 bananas in one run.
4. **Banana Haul** — collect 25 bananas in one run.
5. **Sure Footed** — make 12 clean normal/moving-branch landings.
6. **Canopy Rhythm** — make 30 clean normal/moving-branch landings.

Goals are optional, local, and do not modify leaderboard score.

## Quality gates

The production workflow now runs `checks/jump-audit.mjs` plus a real Chromium desktop audit in addition to build, physics, and asset checks. It asserts:

- test mode reaches Chimp Jump;
- the experience layer is mounted;
- runtime enhancements cannot synthesize keyboard input for mouse steering;
- the old 1.72x opening-camera reset cannot return;
- mute/detail persistence remains present;
- startup remains pinned to the lightweight default avatar rather than a random catalog GLB;
- run summaries remain available for expedition goals;
- same-seed replay remains exposed;
- exactly six goals ship and their unlock logic is idempotent;
- 1440×900 and 1920×1080 desktop rendering completes without page errors;
- keyboard and mouse ownership stays independent;
- desktop controller navigation follows the actual four-column character grid;
- pause, 120-second pace progression, same-seed replay and local GLB validation work in Chromium;
- renderer geometry/texture counts remain bounded across repeated desktop restarts.

Existing physics checks remain the authority for deterministic route/collision behavior.

## Desktop acceptance gate

This pass is accepted on browser/desktop only. Mobile is explicitly outside the current priority and is not a release blocker.

Before production-final status, verify in desktop Chromium:

- title screen and Field Guide at 1440×900;
- active gameplay and HUD at 1440×900 and 1920×1080;
- keyboard, mouse and controller navigation;
- start → pause/resume → death → retry → replay-same-seed;
- Reduced Motion and High-Visibility HUD;
- a simulated 120-second pacing session;
- repeated restart stability and representative GLB selection/upload.

Physics should only be changed when these tests or later player evidence show a concrete problem.

## Canopy expansion delivery review — 2026-09-21

PR #13 extends the earlier pass with optional leaf/swing/vanish branches, thorn pods,
wind, seeded canopy events, bonus routes, reactive atmosphere/audio and the desktop
picker. Existing art, GLBs and music are reused; this follow-up adds no external assets.

The final review inspected the three dedicated screenshots from CI run 35658580284
(commit 3ed95b0). Mechanics and event HUD remained visible. The picker exposed a
four-child/three-column layout error and empty portrait areas when remote images
were unavailable. Explicit grid areas now keep preview, description and Play aligned,
with Random beneath Play; initials remain visible until a portrait loads, including
on failure. The Field Guide now explains all three new branch families and events.

Local production-build Chromium verification passed start, keyboard/mouse independence,
four-column controller focus, pause/resume, death/retry, same-seed replay, GLB rejection,
120 simulated seconds and bounded resources after 12 restarts. The corrected picker
screenshot was visually inspected. Automated tests and static screenshots do not
constitute human feel/audio approval or physical mobile testing.

Release checks now publish dist/version.json and wait for the exact successful main
commit on Render before testing production. The production audit checks out that same
commit, checks expansion telemetry and captures the deployed picker. Playwright 1.63.0
is pinned in the lockfile and shared by both workflows, removing the two high-severity
warnings from the former 1.55.0 test installation. One low-severity esbuild development
server advisory remains; the compatible automatic fix did not resolve it. It is a
build-tool dependency, not shipped browser code.

Rollback: revert the squash merge through a new commit on main, pass CI and let Render
redeploy (or select the preceding successful Render deployment). This pass does not
change localStorage schemas or migrate saved records. Post-merge acceptance requires
the matching live version manifest and a successful production desktop audit.
