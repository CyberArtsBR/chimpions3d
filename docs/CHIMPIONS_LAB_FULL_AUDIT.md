# Chimpions Lab / Chimpion Dash — Full Audit

Date: 2026-09-14

## Scope

Audit of the current Chimpions Lab 2.5D mode inside `Chimp-Jump`, cross-checked against the proven systems and art direction of `CyberArtsBR/chimpions-dash`.

This audit covers gameplay, movement feel, rig animation, rendering, art/readability, UI/UX, controls, performance, responsive behavior, assets and regression risk.

## Executive summary

The first Lab prototype used free third-person 3D movement and did not match the successful lateral-runner identity of the existing Chimpions Dash. The current implementation has been rebuilt as an automatic 2.5D side runner: a real rigged GLB Chimpion runs over the lateral 2D jungle world while the player only chooses jump/slide timing.

The largest technical cause of the previous slow-looking run was screen-space scaling. `265 px/s` was being treated as literal monitor pixels. The original Dash uses a logical virtual width and scales it to the physical screen, so the same base speed looks substantially faster on wide desktops. The Lab now follows that virtual-coordinate approach.

## Current score after this pass

| Area | Score | Notes |
|---|---:|---|
| Core gameplay | 8.3/10 | Automatic side-run, variable jump, slide, coyote/buffer and safe patterns |
| Game feel | 7.9/10 | Correct screen-speed scaling and run cadence; browser playtest still needed |
| Rig / animation | 7.8/10 | World-space rig preparation and speed-synced cadence reduce twisting risk |
| Graphics | 7.6/10 | Original Dash assets + 3D hero integration + stronger depth/light |
| Art direction | 8.0/10 | Consistent jungle runner identity instead of generic 3D test arena |
| UI / UX | 8.0/10 | Clear HUD, pause, touch/gamepad, selected Chimpion continuity |
| Controls | 8.4/10 | No left/right movement ambiguity; jump/slide vocabulary matches old Dash |
| Performance | 8.1/10 | 120 Hz fixed simulation, object pooling and cached HUD writes |
| Mobile readiness | 7.6/10 | DPR budget and touch controls are present; physical-device tuning remains |
| Stability | 8.0/10 | Build/physics/assets CI protects main repo; Lab visual QA still needs coverage |
| Overall | **7.9/10** | Strong playable foundation; remaining gains are visual QA, local assets and feedback |

Scores are engineering estimates from code/system inspection. Pixel-perfect visual composition, animation quality on every GLB and input feel still require human browser/device playtesting.

## What was corrected in this audit

### 1. Runner speed and screen scaling — fixed

The Lab now uses the original Dash-style logical viewport:

- virtual width derived from aspect ratio and a 500-unit reference height;
- logical base speed remains `265`;
- logical maximum speed remains `540`;
- all obstacles, pickups, background motion and the 3D Chimpion position are converted through the same screen scale.

This prevents a 1920 px desktop from making the runner look artificially slow.

### 2. Run animation cadence — fixed

The character animation no longer caps its leg cadence at Stage 1 speed. Foot-cycle frequency increases with the actual world-speed ratio while stride amplitude remains bounded to protect different GLB rigs.

### 3. Fixed-timestep gameplay — upgraded

The Lab uses `STEP = 1 / 120`, matching the old Dash design philosophy. Rendering can vary with monitor refresh rate without changing simulation speed.

### 4. Jump / slide feel — upgraded

Implemented or retained:

- variable-height jump;
- jump hold window;
- stronger gravity on descent;
- coyote time;
- jump buffer;
- minimum slide time;
- stand-up blocking underneath overhead hazards.

### 5. Encounter generation — upgraded

The simple random rows were replaced with a weighted, stage-gated pattern catalog based on the old Dash logic.

Important properties:

- Stage 1 does not introduce slide-only vocabulary;
- later stages progressively introduce high, overhead, flex and combination patterns;
- recovery spacing scales with world speed;
- after a very difficult pattern the generator deliberately gives an easier pattern;
- seeded RNG is used per run.

### 6. Rig safety — upgraded

The Lab reuses the world-space preparation strategy from the working Rig Laboratory rather than applying arbitrary Euler rotations directly to imported bone local axes.

The Lab validates required arm/leg bones and rejects incompatible mappings instead of knowingly displaying a heavily twisted model.

### 7. 2.5D presentation — upgraded

The presentation now emphasizes:

- lateral jungle movement;
- original Chimpions Dash jungle/ground/hazard language;
- 3D Chimpion as the visual hero;
- stronger key/rim lighting;
- better character contact shadow;
- cleaner parallax hierarchy;
- more restrained midground overlap;
- subtle speed-line feedback while running;
- improved HUD/panel contrast.

### 8. Runtime performance — upgraded

- hazard DOM elements are pooled;
- banana DOM elements are pooled;
- HUD text writes are cached and only change when the displayed value changes;
- GLB DPR is capped lower on small screens;
- fixed simulation accumulation has a maximum catch-up budget;
- only the current Chimpion GLB is loaded.

## Full findings / remaining opportunities

### P1 — Make Lab art assets local to Chimp-Jump

The Lab currently references old Dash graphics over the network. That gives visual continuity quickly, but it creates a production dependency on another deployment. The final production version should copy the approved `jungle-v2.webp`, `ground-green.png` and active `sprites-clean/*` files into Chimp-Jump and reference them locally.

Expected benefit: reliability, cache control and asset-audit coverage.

### P1 — Add real visual regression coverage

Current CI catches build, physics and asset problems in the main project, but it does not prove that:

- the 3D runner is correctly grounded;
- a specific GLB has not visually twisted;
- a sprite is at the correct apparent scale;
- HUD elements do not overlap at 16:9 / 9:16 / ultrawide sizes.

Recommended next release-hardening step: one automated browser screenshot for Lab menu + running state at desktop and mobile resolutions after a visual baseline is approved.

### P1 — Human tune Stages 6–10

Reachability and reaction spacing can be reasoned about in code, but final fairness at high speed must be tested with a human on:

- keyboard at 60/120/144 Hz;
- common gamepads;
- mobile touch with browser chrome visible.

### P1 — Multi-avatar rig validation sample

Test a representative set of GLBs with different skeleton proportions and tribes. The loader fails safely when key bones cannot be resolved, but compatible skeletons can still need small visual scale/orientation overrides.

Recommended sample: at least 15–20 diverse Chimpions before declaring the Lab collection-wide ready.

### P2 — Pickup feedback

Bananas should have a clearly readable pickup pulse/spark and lightweight sound. The current collection logic is functional; visual/audio confirmation can be stronger without filling the screen with particles.

### P2 — Hazard feedback

Add restrained contact cues:

- tiny landing dust/contact shadow change;
- near-miss accent;
- collision impact freeze of roughly 50–80 ms;
- no large camera shake.

### P2 — High-jump onboarding

A short first-run hold indicator would communicate that holding jump produces a higher arc better than permanent text.

### P2 — Audio identity

Chimpions Lab currently benefits most from stronger gameplay SFX rather than more music systems. Priorities:

1. footsteps / running texture kept subtle;
2. jump/landing;
3. banana pickup;
4. slide/whoosh;
5. hit/death;
6. stage transition.

### P2 — Gamepad/menu focus polish

Gameplay gamepad actions are supported. A final pass should make D-pad/stick focus movement and A/B behavior completely symmetrical across Lab menu, pause and results.

### P3 — Separate encounter data

Once the Lab stabilizes visually, move pattern/type constants to a small `chimpionsLabEncounters.js`. This reduces accidental graphics/gameplay coupling without introducing a framework or large refactor.

### P3 — Local best/save versioning

The Lab currently stores its best locally. Before adding richer progression, version its save object rather than creating more independent localStorage keys.

## Art direction rules going forward

1. The GLB Chimpion must remain the largest/clearest moving subject.
2. Hazards must read before decoration.
3. Background foliage must never resemble hazards or bananas.
4. Avoid translucent full-screen bands or large atmospheric planes.
5. Keep one shared ground baseline between 2D colliders and 3D feet.
6. Do not stretch hazard sprites beyond their intended silhouette.
7. Speed should be communicated by ground/background motion and leg cadence, not camera shake.
8. No free left/right movement: Chimpion Dash is a lateral auto-runner.

## Recommended release checklist

- Test 16:9 desktop at 1080p and 1440p.
- Test ultrawide desktop.
- Test portrait mobile and landscape mobile.
- Test keyboard, gamepad and touch.
- Test short vs held jump.
- Test slide under every overhead type.
- Test Stages 1, 3, 6 and 10.
- Test at least 15 different Chimpion GLBs.
- Confirm local/approved asset paths before public release.
- Capture approved baseline screenshots for future regression testing.

## Status

The Lab is now structurally aligned with the original Chimpions Dash instead of being a third-person movement test. Remaining work is primarily production hardening, collection-wide rig QA, localizing the approved art package, and browser/device visual tuning rather than another architecture rewrite.
