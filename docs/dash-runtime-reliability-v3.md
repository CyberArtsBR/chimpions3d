# Dash runtime reliability v3 — asset and rendering audit

Baseline: `0460153215e3a53c95bd03aecb20e07c0d79d3cf` (latest `main` when this branch was created on 2026-09-27).

## Rendering architecture

Dash intentionally remains on direct `WebGLRenderer.render(scene, camera)`. The previous performance-controller `postprocessing` flag did not correspond to an active composer and was removed instead of adding a fragile effect chain.

`src/dash/rendering/quality.js` is the canonical tier/hardware definition. `src/dashPerformance.js` is the sole runtime authority for requested quality, resolved hardware tier, Auto degradation, DPR, shadow enablement/resolution, presentation densities, and accessibility overrides. `DashWorldRenderer` consumes the resolved presentation state and no longer writes renderer DPR or shadow-map configuration.

Auto degradation is staged: particles/foreground first, then vegetation/light shafts, then shadow resolution, DPR, denser presentation cuts, optional dynamic shadows, and finally a deeper DPR/density reduction. Recovery requires a longer sustained healthy window than degradation, reducing oscillation.

There is no post-processing render target/composer lifecycle because there is no post pipeline. Presentation finishing remains tone mapping plus restrained CSS finishing. Direct rendering is always the primary path.

## Reliability and lifecycle

The canvas now handles `webglcontextlost` and `webglcontextrestored`. Gameplay simulation is frozen while the context is invalid so a player is not killed by an invisible run. On restore, renderer state, materials/textures, instancing, quality state, viewport sizing, music and ambience are reapplied. A failed restore shows a readable recovery state and does not enter a reload loop.

A direct-render exception enters a safe presentation mode: optional environment/VFX are removed, a solid fallback background is used, gameplay meshes remain, and direct rendering is retried. If even safe direct rendering fails, the runtime freezes and shows the recovery UI rather than silently continuing behind a black canvas.

Page teardown now stops the animation loop and disposes character, Dash world/VFX, renderer and audio resources. Hazard pools/maps are cleared by the Dash renderer. Repeated runs continue to reuse the existing gameplay pools instead of creating per-run GPU resources.

## Dash asset findings

Largest selectable GLBs in the repository at audit time:

| Asset | Bytes | Approx. MiB |
| --- | ---: | ---: |
| The Archon.glb | 14,111,420 | 13.46 |
| The Bosun.glb | 5,936,252 | 5.66 |
| The Apologetic.glb | 5,925,040 | 5.65 |
| The Commodore.glb | 3,843,040 | 3.66 |
| The Pioneer.glb | 3,366,924 | 3.21 |
| The Angsty.glb | 3,362,104 | 3.21 |
| The Adolescent.glb | 2,838,612 | 2.71 |
| The Street Fighter.glb | 2,151,896 | 2.05 |
| The Punk.glb | 1,662,604 | 1.59 |
| The Heretic.glb | 1,604,068 | 1.53 |

Largest Dash-relevant images/audio:

| Asset | Bytes | Approx. MiB | Runtime note |
| --- | ---: | ---: | --- |
| public/audio/music-full.mp3 | 4,260,793 | 4.06 | Lazy on run start; repository-owned |
| public/launcher/cartridge-dash.png | 2,802,794 | 2.67 | Launcher art, not gameplay hot path |
| public/screens/chimp-dash-start.png | 2,713,903 | 2.59 | Exact duplicate exists with hashed filename |
| public/dash/assets/jungle-v2.1f8e991e.webp | 689,844 | 0.66 | Legacy DOM fallback only |
| public/dash/assets/ground-green.5163bede.png | 524,513 | 0.50 | Legacy DOM fallback only |
| largest fallback sprite (spike) | 120,562 | 0.11 | Legacy DOM fallback only |

Exact duplicate found: `public/screens/chimp-dash-start.png` and `public/screens/chimp-dash-start-853ee5d1.png` are both 2,713,903 bytes with Git blob SHA `853ee5d1bc2189662ff178b980904e7f1915a0a5`. They are documented rather than deleted because launcher/start-screen references must be audited before removing either public URL.

The active GPU Dash renderer does not use the legacy DOM jungle, ground or obstacle sprites. Previously these were eagerly warmed at startup, and the legacy jungle/ground URLs also remained unconditional CSS backgrounds. JavaScript warming is removed and those CSS URLs are now gated behind the explicit `.dash-dom-world` fallback class. The fallback assets, sprite URL mapping and DOM renderer are retained, so an intentionally activated DOM fallback can still load its assets lazily without charging GPU sessions for them.

## Music migration

Dash no longer references `raw.githubusercontent.com/CyberArtsBR/chimpions-dash/...` at runtime. It now uses the existing current-repository master `public/audio/music-full.mp3` through `/audio/music-full.mp3?v=9606f223`. The revision is derived from the Git blob SHA, making release URL changes explicit and cache-safe. The audio element uses `preload="none"`, so music does not block menu/game startup.

`scripts/dash-assets.mjs` now verifies the music blob together with the prepared Dash runtime visuals. The repository remains the production dependency; GitHub Raw is no longer involved at runtime.

## Hot-path findings

The world renderer already used module-level matrix/vector/quaternion temporaries for instancing. This branch additionally removes per-frame `THREE.Color` creation in biome interpolation, reuses biome feature/blend objects, and reuses the hazard-live `Set` instead of allocating one each frame.

Existing instancing for background foliage, ground detail and bananas is preserved. Decorative environment meshes remain non-shadow-casting. Auto/reduced-motion/high-visibility states reduce transparent foreground, particles, shafts and mist before sacrificing gameplay-important geometry.

The character animation path still creates pose structures per animation frame. That is a remaining CPU/GC optimization opportunity, but it was deliberately not rewritten in this reliability branch because broad imported-rig compatibility is higher risk than the current allocation cost.

## Remaining risks

- The 13.46 MiB Archon GLB is the largest selectable runtime asset and can dominate first-character load on slow networks. It should be optimized independently with visual regression checks rather than aggressively recompressed in a reliability change.
- The exact duplicate Dash start-screen files should be consolidated only after all launcher/cache URLs are confirmed.
- Context restoration remains browser/driver dependent. The runtime now fails visibly and safely, but a device that cannot restore WebGL still requires a user-initiated page refresh.
- No heavy post effects were added. If bloom/color grading are introduced later, they should live behind a dedicated disposable pipeline with direct-render fallback and context-restoration tests.
