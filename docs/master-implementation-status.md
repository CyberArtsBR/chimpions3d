# CHIMP JUMP — Master Implementation Status

This document records the final implementation state after the Astra pass and the follow-up completion work.

## User overrides that take precedence over the original master brief

- **Progressive pace is enabled.** The simulation deliberately accelerates with run time and reaches the configured maximum pace. Do not remove this unless explicitly requested again.
- **Ambient flying biome decoration is disabled.** No butterflies, flies, floating fungi, drifting leaves or similar persistent decorative particles should be reintroduced.
- **Death is intentionally simple.** The Chimpion keeps the exact last gameplay pose and fall direction/speed, continues below the camera, and never teleports back into view or plays a death pose/flail/spin. Impact/cry and the red splash happen only after the full avatar has left the frame.
- **The procedural low-poly center trunk and its attached ivy/leaves are permanently removed** from High, Balanced and Low detail.

## Gameplay and generation

- Progressive gameplay pace restored and server/client ruleset aligned.
- Safe route remains solid and reliably generated.
- Optional route density reduced by about 20% without removing the required safe support.
- Risk/reward route generation remains deterministic.
- Moving/cracked/spring platforms remain optional difficulty tools rather than replacing the safe path.
- Vine wrap uses wrapped-distance collision and deterministic simulation.
- Score remains `altitude + bananas × 10`.

## Character feel and death

- Shared gameplay collider is unchanged across Chimpions.
- Landing preparation, takeoff, air pose and movement lean are presentation-only.
- Death presentation is now frozen-pose continuous fall with no extra animation.
- Red splash is tied to the exact offscreen event rather than the old fixed timer.
- Death audio sequence is impact → short Chimpion pain cry → wet splash.
- Quick retry remains available independently from leaderboard/result animation.

## Input

- Keyboard, touchscreen and gamepad gameplay remain supported.
- Gamepad D-pad/left stick can navigate up/down/left/right through menus, character selection, results and record screens.
- Gamepad A activates focused controls; B closes supported dialogs.
- Mouse gameplay steering is relative to movement delta, not absolute cursor position.
- Cursor is hidden during gameplay and pointer lock is used where supported so reaching the edge of the desktop cannot delay steering response.

## Camera and HUD

- Smooth upward camera tracking and no downward fall-follow during gameplay.
- Boost zoom-out and restrained landing impulse retained.
- HUD shows Height, Best, Bananas, Pause and Audio without developer pace telemetry.
- DOM HUD values update only when displayed values change.
- Arcade-style typography polish applied without an external font dependency.

## Art direction / biomes

- Main visual identity remains stylized premium jungle/canopy expedition.
- Hero lighting keeps the Chimpion readable independently from biome palette.
- Jungle Morning, Emerald Mist, Golden Canopy and Moonlit Grove are differentiated through lighting, haze, fog, color and depth rather than distracting flying decoration.
- Pixel mode remains secondary/optional.

## Background

- Removed the old procedural center trunk and its ivy/leaves.
- High detail uses the authored canopy/tree plate as distant scenery rather than a gameplay object.
- Layered procedural forest remains behind it for depth.
- Additional deterministic canopy depth layers provide parallax without adding gameplay clutter or moving ambient creatures.
- Background rendering sleeps when the game is static.

## Platforms

- Four deterministic visual branch variants are retained.
- Added stronger silhouette differentiation below the landing plane, so visual variety never changes collision geometry.
- Moving platforms receive cyan mechanical/beacon accents.
- Cracked platforms receive distinct crack/splinter signatures.
- Spring branches retain multiple mushroom/cap variants with premium base accenting.
- Small solid variant-3 branches can receive a rare deterministic premium golden-ring treatment.
- Authored branch GLB remains supported on High detail.

## Performance

- Shared geometries/materials are retained.
- Decorative elements use InstancedMesh where useful.
- Branch groups use a bounded reuse pool rather than constant create/destroy churn.
- Offscreen/inactive scenery updates are reduced.
- Static menus/results no longer require continuous full WebGL redraws.
- High detail uses realtime shadows; Balanced/mobile disable the expensive shadow path.
- Avatar shadow casting remains limited to skinned meshes.
- Mobile reduces secondary detail while retaining canopy identity, platforms, biomes and the Chimpion.

## Character selection / developer tools

- Search, pagination, selected preview, name, tribe, Random Chimpion and Play With Selected Chimpion remain available.
- Only the selected/active GLB is loaded; the complete collection is not loaded into memory.
- Load Local GLB and Rig Laboratory are hidden from the normal player menu and remain available through developer mode (`?dev=1`) / rig mode (`?rig=1`).
- Flip Avatar Facing remains removed.

## Audio

- Music and SFX volumes are independent and persist locally.
- Cached lightweight SFX cover landing, fragile branch, banana, spring, jetpack, wrap, menu, record and death impact/splash presentation.
- Death sound is now event-driven by the avatar leaving frame, not by the old death timer.
- No excessive music ducking is used.

## Asset / repository audit

- Asset audit reports sizes, large files, root GLBs, audio, image/environment assets, possible unused files and hash duplicates.
- Unused legacy `public/audio/music.mp3` was removed; `music-full.mp3` remains the active music track.
- Leftover `public/environment/platforms/test.txt` was removed.
- Six top-level GLB duplicates were removed after confirming identical SHA blobs exist at the runtime paths under `public/model/characters/`.
- No uncertain asset is automatically deleted.

## CI / verification

The repository continues to run:

- production build
- physics checks
- asset audit
- source GLB inspection

The previous unused Playwright/Chromium installation step was removed from CI because no browser test consumed it.

## Important design rule going forward

Do not treat this document as a request to revert later user-directed changes back to the older master prompt. The explicit overrides at the top are the current product decisions.
