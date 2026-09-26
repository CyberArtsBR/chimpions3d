# Chimpions Dash legacy / old 2D cleanup audit

Date: 2026-09-26

Target repository: `CyberArtsBR/Chimp-Jump`

Authoritative game: `https://chimp-jump.onrender.com/?dash=1`

This audit is intentionally documentation-only. It does not delete runtime code or assets while the parallel AAA specialist branches are active.

## Executive conclusion

There are two separate things commonly described as "the old 2D Dash":

1. The standalone repository `CyberArtsBR/chimpions-dash`.
2. Legacy DOM/raster fallback remnants still embedded inside `CyberArtsBR/Chimp-Jump`.

The standalone repository is not deployed as a separate Render service in the current Cyberwork workspace. However, the current `?dash=1` runtime still references one asset from it: the pinned music file `dist/assets/chimpions-army.mp3`.

Therefore the standalone repository must NOT be deleted until that music asset has been migrated to `Chimp-Jump` or another controlled same-origin asset location.

Inside `Chimp-Jump`, the current game is GPU/Three.js authoritative (`GPU_WORLD=true`). The old raster world is hidden once the GPU renderer initializes, but several old DOM nodes, CSS rules, preload calls and 14 legacy raster assets are still present.

## Standalone old repository

Repository:

`CyberArtsBR/chimpions-dash`

Current main at audit time:

`62a6f4a95cf729b535d7fb04d3c0265a7104f4aa`

Approximate repository tree payload:

- 489 files
- about 15.9 MB of current blob payload
- old 2D runtime in `dist/app.js` / `dist/engine.js`
- large old raster assets
- old character/head collections
- music file `dist/assets/chimpions-army.mp3` (~4.51 MB)

No active Render service in the current Cyberwork workspace points to this repository.

### Current dependency from the real Dash

`src/chimpionsLab.js` imports `DASH_MUSIC_URL`.

`src/dashAssets.js` currently defines that URL as a pinned GitHub Raw URL into `CyberArtsBR/chimpions-dash`.

That is the only confirmed direct runtime dependency discovered during this audit.

### Recommendation

After the music is copied/versioned locally and all external references are removed:

1. archive `CyberArtsBR/chimpions-dash`
2. keep it archived through one stable release cycle
3. delete it later only if desired

Archiving first is safer than immediate deletion because the repository still contains historical source/assets useful for rollback and provenance.

## Legacy 2D remnants inside Chimp-Jump

### Legacy DOM plates still created at runtime

`src/chimpionsLab.js` still creates:

- `#dash-sky`
- `#dash-far`
- `#dash-mid`
- `#dash-light`
- `#dash-objects`
- `#dash-ground`
- `#dash-shadow`

The current Three.js path is authoritative and `src/dash/rendering/dashWorld.css` hides these plates after GPU initialization.

### Legacy raster rendering code still present

`src/chimpionsLab.js` still contains:

- `GPU_WORLD=true`
- `dashSpriteUrl`
- `warmDashImages`
- legacy DOM sprite pooling
- `acquire()`
- `recycle()`
- `renderObjects()`
- old `#dash-shadow` update logic guarded by `!GPU_WORLD`

Because `GPU_WORLD` is hardcoded true, the DOM sprite creation path is currently unreachable during normal gameplay.

### Legacy raster asset package

`public/dash/assets/` currently contains 14 files totaling:

- 2,083,846 bytes
- approximately 1.987 MiB

Files:

- `jungle-v2.1f8e991e.webp`
- `ground-green.5163bede.png`
- 12 raster hazard/collectible sprites

The current GPU world renders hazards and environment geometry without requiring those images.

However, the repository's current asset checks still classify these files as Dash critical assets. They cannot simply be deleted without updating QA contracts.

### Current QA coupling that must be removed first

`checks/assets.mjs` explicitly asserts that all 14 localized Dash raster files exist.

`scripts/dash-assets.mjs` also verifies hashes for all 14 files during the build.

`checks/dash-resources.mjs` intentionally blocks `/dash/assets/**` and confirms that the GPU world still renders hazards correctly, which is useful evidence that the raster package is no longer required by the active GPU gameplay path.

The correct cleanup is therefore:

1. remove legacy raster preloading from active GPU startup
2. remove unreachable DOM sprite fallback code or replace it with a deliberate fallback strategy
3. update `checks/assets.mjs`
4. update/remove `scripts/dash-assets.mjs`
5. only then delete `public/dash/assets/`

## Duplicate Dash start artwork

Two files are byte-identical:

- `public/screens/chimp-dash-start.png`
- `public/screens/chimp-dash-start-853ee5d1.png`

Both have the same Git blob SHA:

`853ee5d1bc2189662ff178b980904e7f1915a0a5`

Each file is 2,713,903 bytes (~2.588 MiB).

Current CSS references both names in different stylesheets:

- `menuScreensV2.css` uses `chimp-dash-start.png`
- `menuScreensFinal.css` uses `chimp-dash-start-853ee5d1.png`

One copy can be removed after consolidating CSS to a single canonical file.

Potential deployment payload saving:

~2.588 MiB.

Do NOT remove both; this artwork is the current approved Dash entry screen.

## Files that must be kept

These are part of the current real `?dash=1` game and are NOT old-game trash:

- `src/chimpionsLab.js` as a whole, until its runtime responsibilities are modularized
- `src/chimpionsLab.css` as a whole, until legacy-only sections are separated
- `src/labRunnerCharacter.js`
- `src/dashAudio.js`
- `src/dashPerformance.js`
- `src/dash/`
- `src/dash/rendering/DashWorldRenderer.js`
- `src/dash/vfx/DashVFX.js`
- `public/model/characters/*.glb`
- `public/avatars.json`
- `public/screens/chimp-dash-start*.png` at least one canonical copy
- `public/launcher/cartridge-dash.png`

The filename `chimpionsLab.js` is historical/misleading, but the file now contains the active Dash runtime. Deleting it would delete the real game.

## Separate rig sandbox

`src/rig-lab.js` is a standalone developer rig sandbox reached through `?rig`.

It is not the old 2D Dash gameplay.

It can be evaluated separately as a dev-tool cleanup, but it should not be removed as part of "delete old 2D Dash" unless the team intentionally retires the rig sandbox.

## Legacy route

`src/main.js` already treats `?dash=1` as canonical.

Old `?lab` links redirect to `?dash=1`.

This is the correct behavior and should remain until old external links are no longer expected.

Later, the `?lab` redirect can be removed entirely, but deleting it now has almost no payload benefit.

## Safe cleanup phases

### Phase A — safe during AAA integration

Documentation / no behavior change:

- keep `?dash=1` canonical
- identify old repo dependency
- identify duplicate start-screen file
- prevent new references to old repo
- prevent new legacy DOM/raster dependencies

### Phase B — after specialist branches integrate

Low-risk runtime cleanup:

- migrate Dash music local/same-origin
- remove `DASH_MUSIC_URL` dependency on old repo
- stop `warmDashImages()` in GPU mode
- remove legacy `dashSpriteUrl` imports from the active path
- remove old DOM sprite pool/render functions
- remove legacy DOM scenery nodes
- remove legacy-only CSS selectors
- update QA to describe the GPU world as authoritative

### Phase C — asset deletion

After browser/resource tests prove GPU mode and fallback behavior:

- delete all 14 `public/dash/assets/` raster fallback files if no longer used
- remove old hash manifest entries / build checks
- consolidate the duplicate start-screen artwork to one file

Estimated direct static payload reduction from:

- legacy raster package: ~1.987 MiB
- duplicate start artwork: ~2.588 MiB

Combined immediate repository/deploy payload reduction:

~4.575 MiB

This excludes the much larger standalone old repository.

### Phase D — retire standalone repository

Only after music migration and reference scan:

- archive `CyberArtsBR/chimpions-dash`
- verify `?dash=1` in production with old repo unavailable
- keep archived for a stable release cycle
- optionally delete later

## Acceptance checks before deleting old assets/repository

Required:

- `?dash=1` boots with the old repository unavailable
- character picker works
- music plays from same origin
- gameplay starts
- all hazard types render
- bananas/golden bananas render
- all seven biomes render
- LOW/BALANCED/HIGH/ULTRA work
- production network log contains no request to `CyberArtsBR/chimpions-dash`
- normal Chimp Jump is unaffected
- Dash resource/soak tests pass
- no hidden legacy raster request occurs during normal GPU startup

## Integration note for Assistant 7

Do not cherry-pick a deletion patch before the rendering/performance specialists finish.

Assistant 6 is likely to touch the same asset/loading areas and may already implement some of this cleanup.

Use this audit as the deletion checklist after the six specialist branches are reconciled.
