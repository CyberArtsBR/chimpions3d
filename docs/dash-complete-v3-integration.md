# Chimpions Dash V3 — Final Integration Map

## Branch authority

- Repository: `CyberArtsBR/Chimp-Jump`
- Integration branch: `integrate/dash-complete-v3`
- Actual starting `main` SHA: `0460153215e3a53c95bd03aecb20e07c0d79d3cf`
- `main` remained at that SHA through final integration.
- No merge to `main`.
- No deployment.

## Specialist inputs inspected

| Stream | Branch head | Commits ahead of starting main | Integration ownership |
| --- | --- | ---: | --- |
| Environment art | `ece2e73ed423dc5f0f6cbe4602f9b6e9fcc3e5c4` | 8 | biome profiles, authored scenery kit, environment presentation |
| Hazards / VFX | `12ce9cd187b587b558486c11a6bde7a591ad9771` | 4 | hazard geometry/readability, collectible glows, gameplay VFX |
| Gameplay director | `2a09be95bd04592abb25b07e27cff0d5a63fa70c` | 16 | deterministic director, pressure/recovery, risk routes, set pieces |
| Character feel | `ac90bfb0ac5bb9ae0ee3373c74cfd62e205d5366` | 8 | procedural rig feel, foot contacts, landing/jump presentation |
| UX / audio / accessibility | `61a5849c1150ff373ac8656107c5b43b8b0ef2d2` | 15 | character selection, HUD/results, settings, input UX, audio mix |
| Runtime reliability | `474484bc95d9cb84ff3faa30c36ca202de5f3c35` | 22 | canonical quality controller, adaptive scaling, context recovery, asset discipline |
| Release hardening | `ff6945c08b21f79f0c59c8f1a47a0ab5f6b167de` | 21 | deterministic/browser gates, black-screen sentinel, accessibility/runtime tests |

All seven branches shared the same merge base: `0460153215e3a53c95bd03aecb20e07c0d79d3cf`.

## Conflict ownership decisions

### `src/chimpionsLab.js`

This file was intentionally rebuilt rather than copied from one specialist branch.

The integrated version combines:

- UX character-selection flow and explicit PLAY confirmation
- runtime WebGL context recovery
- deterministic gameplay director state and set-piece events
- character foot-contact / landing presentation hooks
- hazard precision / perfect / near-miss feedback
- accessibility settings routed to live GPU presentation
- gamepad, keyboard, mouse and touch input parity
- runtime diagnostics for QA
- emergency DOM compatibility rendering when WebGL cannot continue

Gameplay physics remain authoritative. Rendering and animation do not move the gameplay collider.

### `src/dash/rendering/DashWorldRenderer.js`

The renderer is a unified implementation rather than a branch winner.

Ownership:

- direct Three.js render path + safe mode: runtime reliability
- authored biome scenery: environment art
- hazard geometry + collectible glow: hazards/VFX
- reduced motion / high visibility / screen shake: accessibility
- black-screen diagnostics and observable GPU accessibility state: release hardening

The performance controller is the single quality authority. No second competing renderer-quality system is retained.

### `src/dash/vfx/DashVFX.js`

Hazard/VFX presentation is retained and extended with:

- reduced-motion scaling
- character foot-contact particles
- pooled particles/rings/streaks
- diagnostics used by accessibility/release tests

### Audio and assets

The richer UX audio system is retained, but runtime asset policy comes from reliability work:

- music uses the repository-owned `public/audio/music-full.mp3`
- media preload is `none` until playback is requested
- authored one-shot slots are optional
- synthesized cues remain fallback
- legacy raster Dash scenery is loaded only when the DOM compatibility fallback is activated

## Protected gameplay contracts

The integration intentionally preserves:

- 120 Hz fixed simulation
- deterministic seeds
- swept collision
- coyote time
- jump buffering
- variable jump height
- authoritative standing/sliding/player colliders
- viewport-aware warning/reaction windows
- deterministic obstacle generation
- score determinism
- GLB rig compatibility
- local GLB upload support
- keyboard/controller/mouse/touch support

## Reliability behavior

Normal path:

1. GPU Three.js world renders directly.
2. Canonical quality controller applies LOW/BALANCED/HIGH/ULTRA or AUTO adaptive scaling.
3. Context loss pauses simulation while restoration is attempted.
4. Successful restoration reapplies renderer/material/texture/quality state.

Failure path:

1. Safe direct rendering is attempted first.
2. If rendering still cannot continue, the GPU canvas is suppressed.
3. Legacy raster scenery and sprite hazards are enabled only then.
4. A lightweight fallback player proxy keeps the run visually playable.
5. Physics, scoring and input continue instead of being killed by rendering failure.

## Validation performed during integration

Source-level integration validation completed:

- presentation/runtime contract audit: **27 / 27 checks passed**
- syntax probes: all modified runtime and QA JS/MJS files parsed successfully after ESM import/export normalization
- branch comparison: integration branch is based on the recorded latest main and is not behind it
- draft PR mergeability: GitHub reports the integration branch mergeable with `main`

A draft PR was opened only to exercise CI:

- PR: **#91 — Dash V3 complete integration**
- merge: **not performed**
- deployment: **not performed**

The first GitHub Actions run ended before any runner step executed (`runner_id=0`, empty step lists on the failed jobs). That run therefore did not provide a code-level test result; it is treated as CI infrastructure availability, not as a passing or failing build signal.

## Release status

This branch is an integration candidate only.

It must remain unmerged and undeployed until CI can actually allocate runners and complete the required gates.
