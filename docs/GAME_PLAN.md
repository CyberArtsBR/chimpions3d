# Chimp Jump — gameplay and production plan

Version 1 • 11 September 2026 • Repository: [CyberArtsBR/Chimp-Jump](https://github.com/CyberArtsBR/Chimp-Jump)

Status: implementation-ready design. The current application is the working rig sandbox. This document specifies the next game; its features are planned unless explicitly identified as already present.

## 1. The game in one sentence

A fast, friendly 2.5D endless jumper: choose your chimp, steer left and right while it automatically bounces up a giant tree, and survive long enough to see the jungle transform every 30 seconds.

The appeal is readable jumps, satisfying landings, expressive avatars, and immediate retries. The core challenge is choosing the next landing while already in the air.

## 2. Design decisions

| Area | Decision |
|---|---|
| Rendering | 3D GLB characters and simple 3D branches, presented on one flat gameplay plane |
| Camera | Orthographic, straight at the tree, locked angle; upward translation only |
| Movement | Left/right steering with automatic bounce on landing |
| Facing | Left or right profile; quick turns pass through the camera-facing pose |
| Failure | Falling fully below the playfield ends the run |
| World | Recycled trunk sections and branch platforms; guaranteed reachable route |
| Environments | Four lightweight themes; change every 30 seconds of active play |
| Characters | Shared movement rules; a catalog designed for 221 avatars |
| Online release | Public single-player browser game on Render Static Sites |
| Stack | Existing Vite, vanilla JavaScript, Three.js, GLTFLoader; HTML/CSS interface |

The first release uses one life. The red mist from the concept images is atmosphere at the bottom edge, not a separate timer that kills the player. This keeps failure understandable: missing the climb causes the loss. Hearts, enemies, shooting, power-up inventories, accounts, multiplayer, and global rankings are outside this first release.

## 3. What already works

The current main branch contains procedural idle, walking, running, jumping and landing; automatic bone identification; a manual mapping override; SkeletonHelper; a verified hidden-before-idle load sequence; and relaxed arms at 22 degrees.

The supplied GLB is approximately 2.76 MB. Earlier browser verification found 26 bones and mapped all 19 requested humanoid slots. At inspection time, only public/model/chimpion.glb is in the repository. The remaining 220 GLBs will need to be supplied or located before the full collection can be verified and enabled.

Preserve the rig laboratory through a separate /?rig=1 mode when the game becomes the default. Its Idle/Walk/Run/Jump controls, bone hierarchy logging, and skeleton overlay remain available. The public game gets a clean gameplay interface.

## 4. Player experience

1. Open the URL; load the default or last selected chimp in an already posed state.
2. See Play, Choose Chimp, local best height, and a concise control hint.
3. Play begins on a broad safe branch with a short ready cue; bounce begins automatically.
4. Steer between landing targets, take optional banana detours, and use the edges to wrap around.
5. New heights introduce a small number of platform variations. Themes shift independently every 30 active seconds.
6. A missed climb ends the run. Show height, bananas, personal best, and a prominent Retry button.
7. Retry resets the run immediately using the already loaded avatar.

Primary score is maximum height achieved, never current height or survival time. Display floor(maxHeight - startHeight) in game metres. Bananas are a separate run statistic in version one. Repeated bouncing at one altitude cannot increase the height score.

Desktop: A/D or Left/Right steer; P/Escape pauses; Enter starts or retries when the relevant menu is visible.
Touch: two large bottom-edge left/right hold zones with pointer capture and multi-touch handling. Release, cancel, blur, and app switching clear held input. No mandatory tilt controls.

Pause freezes physics, moving platforms, score, and theme time. Losing browser focus pauses the run and requires an explicit resume. A reduced-motion setting keeps the camera fixed in angle and makes turns instantaneous while preserving responsive input.

## 5. Camera, space, and visibility

Use world X for horizontal motion and world Y for height. The player's physical Z remains fixed at zero. The tree sits behind the gameplay plane; decorative depth never changes collision.

Start with a 10-unit-wide by 16-unit-tall gameplay court. Fit the same logical court inside different screen sizes so wide monitors do not gain an easier route or a larger survival area. Extra desktop width can show decorative background. Resize must not alter the score, death boundary, or generated route.

The camera begins anchored to the start area. It rises only after the player passes approximately 55% of the court height from the bottom. Once raised, it never descends. Update camera height and the loss boundary within the fixed physics simulation, then interpolate the rendered camera between simulation samples. Use bounded smoothing in simulation time; rendering frame rate must never determine deaths. Falling completely below its bottom edge ends the run.

Player motion stops influencing camera yaw, pitch, horizontal position, and zoom. Landing targets must remain readable at all times; a trunk must never obscure the character. Show at least the next two safe landing choices.

Left/right edges wrap: crossing an edge preserves height and velocity and continues at the other edge. Crossing time splits the horizontal motion segment so collision cannot falsely sweep across the whole court. Platforms near the boundary use the same periodic collision rules. Briefly render a visual copy near the opposite edge if needed for continuity.

## 6. Side-facing character and fast turns

Calibrate each avatar so local +Z is its face direction. Put the game camera on +Z, looking toward the X/Y plane. This makes yaw 0 face the camera, yaw +90 degrees face screen-right, and yaw -90 degrees face screen-left.

Turn between those two side angles through yaw 0 in approximately 100 ms. Interpolate a bounded scalar yaw in [-90, +90] rather than trusting quaternion interpolation to select the desired half of a 180-degree turn. That guarantees a front-facing intermediate pose and avoids the rear-facing route.

Movement responds on the same simulation step as the new direction. The turn is cosmetic: it never locks input, pauses gravity, delays landing, changes jump height, or changes the collision box. Rapid left/right taps retarget from the current visual angle without queuing full turns. Neutral input keeps the last requested facing.

Rig preparation must happen in a canonical avatar frame before applying the outer side-facing rotation. The existing solver derives axes from world transforms; capturing those axes after turning the avatar would misalign the procedural movements. Preserve neutral preparation and rotate an outer presentation group afterwards.

## 7. Procedural bounce and collision

Reuse the existing pose definitions and bone mapping. Keep the original GLB/rest pose and inverse bind matrices intact. Every load and avatar change follows: hidden model → map and validate bones → apply relaxed pose → update matrices → reveal.

The sandbox's jump currently waits through a grounded crouch and landing sequence. The game needs immediate bouncing: landing sets upward velocity immediately, while a 60–90 ms visual knee compression blends over the first part of ascent. Do not carry the sandbox's full 0.18-second crouch and 0.26-second landing delays into every game bounce.

Pose phases: takeoff compression, leg extension, mild tuck around the apex, legs reaching for landing. Arms stay comfortably open, head motion stays subtle, and the existing bone blends continue during turns. Separate gameplay state (MENU/PLAYING/PAUSED/GAME_OVER) from animation state (IDLE/JUMP/LAND and lab-only WALK/RUN).

Proposed starting values, to be playtested:

| Parameter | Initial value |
|---|---:|
| Gravity magnitude | 32 units/s² |
| Bounce velocity | 14 units/s |
| Maximum rise from a normal bounce | 3.06 units |
| Time to apex | 0.438 s |
| Same-level flight duration | 0.875 s |
| Horizontal speed limit | 6 units/s |
| Horizontal acceleration / reversal | 36 units/s² |
| Safe-chain vertical gap | 1.2–2.0 units |
| Initial safe-chain horizontal centre gap | At most 1.8 units |
| Normal platform width | 1.8–2.4 units |
| Shared foot collision width | Approximately 0.55 units |

The rise is v²/(2g), and time to apex is v/g. Maximum theoretical reach is not a fair generation target.

Run physics at a fixed 1/60-second step with interpolated rendering. Catch up a bounded number of steps; pause on major stalls rather than suddenly advancing a suspended tab. Test 30, 60, and 120 Hz rendering against the same simulation.

A platform catches the player only while descending and when the feet cross its top between two simulation samples. Evaluate horizontal overlap at that crossing time, including platform movement. Clamp to the surface, bounce once, and consume the remaining substep consistently. Pass through platforms from below. Hair, swords, tails, and arm movements do not enlarge collision.

## 8. Fair endless generation

Build a guaranteed route first; add optional risk/reward platforms second. Every route segment must contain a reachable solid landing with a useful margin. A moving, breaking, or spring platform is never the only required first-release route.

Validate candidate jumps with the actual movement model: current/reachable horizontal speed, acceleration, reversal, jump arc, feet width, and landing window. The descending crossing time for a platform height difference d is (v + sqrt(v² - 2gd)) / g. Reject candidates with a negative discriminant. Use this time as an initial screen, then check the simulated landing interval; do not assume instantaneous maximum speed.

Use seeded generation so failures can be reproduced. If a candidate fails, try a bounded number of alternatives, then insert an easy solid platform. Generate ahead of the camera and recycle only below the death boundary. Rebase world height periodically during long runs to avoid floating-point drift while preserving score and seed state.

First platform set:

| Type | Readable cue | Behaviour |
|---|---|---|
| Solid branch | Broad green moss edge | Reliable normal bounce |
| Moving branch | Arrow mark and clear side motion | Predictable horizontal oscillation |
| Cracked branch | Visible split in the wood | Allows one bounce, then falls away |
| Spring branch | Mushroom spring on the surface | Stronger bounce; safe destination visible |

Introduce solid branches first, then one variation at a time with an easy landing afterwards. Increase challenge by altitude through modestly narrower optional platforms and wider choices, while preserving the guaranteed route. Do not change gravity, steering, or bounce strength unexpectedly. Hold the difficulty ceiling once the fair limits are reached.

## 9. A different mood every 30 seconds

Theme time counts PLAYING time only. At each boundary start a 1.5-second smooth transition. Restart returns to the first theme.

| Active run time | Theme | Cheap visual treatment |
|---|---|---|
| 0–30 seconds | Jungle Morning | Pale blue sky, fresh green leaves, warm bark |
| 30–60 seconds | Emerald Mist | Teal sky, deeper leaves, soft distant silhouettes |
| 60–90 seconds | Golden Canopy | Peach sky, amber foliage, warmer light |
| 90–120 seconds | Moonlit Grove | Blue-violet sky, cool bark highlights, sparse stars |
| 120 seconds onward | Repeat sequence | Retain current difficulty and altitude |

Change background gradient, atmosphere colour, leaf/material tints, light colour, and one or two silhouette layers. Reuse geometry. Load any optional artwork before play; a transition must never require a network response or swap the whole scene.

All themes keep platform edges, bananas, and character silhouettes readable. Theme changes are visual, independent of platform collision and difficulty. No flashes or sudden camera movement. Shader/material programs should be ready before first use.

## 10. The 221-avatar collection

Use a small manifest with stable ID, display name, thumbnail URL, GLB URL, orientation correction, scale/foot offset, and optional bone overrides. Only existing valid entries appear as selectable characters.

The selection grid uses lazy-loaded thumbnail images. Load a GLB only for the currently selected preview/player; dispose replaced geometry, textures, and materials when no longer shared. Reuse the selected model on restart. Cancel or ignore stale load requests so rapid selection cannot reveal the wrong avatar.

All avatars share the same collider, jump strength, and steering. Scale and foot calibration align their visible stance; accessories do not create an advantage. Preview only in a posed state. If mapping or loading fails, retain the previous valid selection and explain which avatar failed.

Audit the collection before enabling it: GLB validity, required limb chains, orientation, bone count, geometry/material count, decoded texture sizes, and representative idle/jump screenshots. Test side-facing motion on a varied sample before running the full audit. Similar bone names alone do not prove identical skinning quality.

At the current avatar's size, 221 similar files would total roughly 609 MB before thumbnails or variation. That may be repository storage, but must never be the initial browser download. Launch with the available chimp, add a small representative batch, then expand the catalog after audit.

## 11. Art, audio, and performance targets

Use three reusable trunk sections, four branch behaviours built from about six mesh variants, one mushroom, one banana, two leaf clusters, and inexpensive sky/silhouette layers. Keep the trunk darker than playable ledges. The camera remains straight-on even if lighting gives assets 3D volume.

The detailed waterfalls and distant forests in earlier concept images are mood references. Begin with gradients and flat silhouettes for the background. No new external animation files, physics engine, backend framework, or React migration.

Use one directional and one hemisphere light. Prefer a small blob/contact shadow under the character; reserve real shadow maps for an optional quality setting. Cap device pixel ratio, reuse temporary vectors, pool platforms, and instance repeated props. Use simple procedural bounce/pickup/fail sounds after the first user gesture, with mute available.

Measure these goals on real hardware; they are targets rather than guarantees:

- Smooth 60 FPS on the chosen desktop test machine; at least 30 FPS on a representative midrange phone.
- Initial compressed transfer target at most 6 MB with the first avatar; revise only after measuring GLB texture/mesh costs.
- Scene draw-call target below 60, excluding an explicitly enabled rig overlay.
- Flat counts for platforms, geometries, textures, and event listeners after ten-minute runs and repeated retries.
- One selected/avatar preview model; never 221 models in memory.
- All core movement feels equivalent across supported frame rates.

## 12. Small code structure

Keep plain JavaScript modules with direct responsibilities. Introduce modules as needed, without an engine framework.

| Module | Responsibility |
|---|---|
| main.js | Boot, screen flow, render loop |
| character.js | GLB loading, mapping, procedural poses, visual facing |
| game.js | Input-driven player physics, camera/death boundary, score |
| platforms.js | Seeded generation, landing checks, recycling |
| themes.js | Active-time schedule and colour/background blending |
| ui.js | Menus, touch controls, avatar selection, local settings |
| rig-lab.js | Existing inspection mode using the shared character code |

Tuning constants live together. The rig lab and game share one pose/loading implementation. Tests target meaningful behaviour: safe reveal, reachable generation, collision, turn path, lifecycle cleanup, and theme timing.

## 13. Build stages and completion gates

| Stage | Deliverable | Exit check |
|---|---|---|
| A — playable core | Existing chimp, orthographic camera, automatic bounce, steering, wrap, solid platforms, death/retry | Two-minute playable run; restart reuses avatar; descending-only landings verified |
| B — character feel | Shared rig module, front-passing fast turns, adapted bounce poses, preserved rig lab | Both turn directions and rapid reversals stay frontward; physics is independent of visual turn |
| C — variety | Safe seeded routes, moving/cracked/spring branches, bananas, four timed themes | Thousands of generated transitions checked; 29.9/30/60-second boundaries and pauses behave correctly |
| D — collection and touch | Manifest selector, thumbnail grid, mobile controls, representative avatar batch | No eager full-catalog downloads; failed/stale selections handled; touch cancel never sticks |
| E — release polish | Menus, local best, audio, measured quality options, Render release | Build, browser regression checks, real-phone playtest, ten-minute soak, hosted URL/GLB checked |

Keep a playable version at every stage. If development capacity is tight, finish A and B plus the required 30-second palette changes first. Then complete the remaining variety, collection audit, and polish in that order. Do not promise a token count or a complete 221-avatar audit before the files are available.

## 14. Render deployment

The supplied screenshot reports render.yaml missing from main. A root Blueprint can describe one static site that builds the Vite project and publishes dist; this is supported by [Render's Blueprint specification](https://render.com/docs/blueprint-spec).

The companion render.yaml uses Node 22.23.2, installs development dependencies for the Vite build, publishes dist, and waits for passing checks for later automatic deployments. It adds no database or running application server. The exact patch is pinned to the Node version used successfully by this repository's earlier CI runs.

On the existing Render screen: select main, keep Blueprint Path as render.yaml, click Retry, and review the detected static site. Completing creation there produces the public URL. The current build will show the rig sandbox until the game implementation is committed.

Render supplies HTTPS and an onrender.com address for static sites. Static delivery still counts toward account bandwidth and build allowances. See [Render Static Sites](https://render.com/docs/static-sites). A public single-player game works with localStorage best scores; a trustworthy shared leaderboard would be a separate backend feature.

After deployment, verify the home page, /model/chimpion.glb, reload, touch controls, pause/resume, and a retry on the actual URL. Do not describe it as live until that URL has been opened successfully.

## 15. Reference and acceptance checklist

The linked [itsR0sen/Doodle-Jump README](https://github.com/itsR0sen/Doodle-Jump) describes a C++/SFML implementation with automatic jumping, platform recycling, upward scrolling, pause, and saved high scores. These are useful behavioural references. Chimp Jump will implement its own browser logic and use the supplied chimp assets.

First playable release is ready when:

- Opening the game, retrying, changing avatars, and resuming never exposes a T-pose.
- The 22-degree relaxed arms and manual bone overrides remain usable.
- Facing is left/right at rest; turns travel through the front and complete quickly with no input penalty.
- The camera angle never changes; player collision stays on the X/Y plane.
- Every generated required landing remains reachable; optional routes can be risky.
- Platforms catch only descending feet, including at frame boundaries and screen wrap.
- Background themes change every 30 active seconds and pause with gameplay.
- Resize and device frame rate cannot change the court, jump rules, or score.
- Current rig laboratory controls remain available in their separate mode.
- The avatar selector supports all supplied, audited entries without loading the full collection.
- Production build and meaningful browser checks pass; the public deployment is tested separately.
