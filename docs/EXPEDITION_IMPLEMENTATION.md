# Expedition implementation
## Completed
- Constant player physics; permanent solid safe route; deterministic optional risk/reward routes and capped branch acceleration.
- Exact vine-span wrapping and collision distances; paired arrival/departure cues and sound.
- Smooth, upward-only deterministic camera tracking, subtle launch/landing feedback and temporary boost zoom-out.
- Shared avatar collider and original skeleton rest pose preserved. Landing preparation, squash, lean and death flail are presentation only.
- Visible death presentation, retry available after 0.65 seconds, results around 2 seconds. Score animations do not disable retry.
- Score = floor(altitude) + 10 × bananas. Results show altitude, banana bonus, final score and personal-best altitude.
- Server migration recalculates completed scores once, preserving record names and history. Shared replay ruleset is 2026-09-expedition-v3.
- Larger selected portrait and tribe (when provided), search/pagination, random selection, local GLB and rig lab preserved. Facing-flip control removed.
- Independent persisted music/SFX sliders; cached layered PCM effects for landing, cracks, spring, banana, wrap, jetpack, falling, splash, records and menus.
- Moss/bark variants, hanging roots, moving markers and spring variations reuse geometry/materials.
- Morning butterflies, emerald mist/fungi, golden falling leaves and moonlit glowing fungi/fireflies. Tree/canopy remains present on Balanced; Pixel Mode stays optional.
- Invisible ivy/forest and offscreen branch animation skipped, background animations freeze outside play, inactive rendering capped at 20 FPS, unchanged HUD text is not rewritten.

## Deployment
Publish the client and configured leaderboard service from the same revision. Old unfinished run tickets are rejected rather than replayed with different physics.
Existing saved records remain stored; they are recalculated with the new formula when the updated backend starts.
The leaderboard still requires the existing VITE_LEADERBOARD_URL and persistent backend deployment. No new paid service is provisioned by this change.

Production build completed successfully. No gameplay/browser tests were run. Existing CI expectations were updated for the intentional rule changes; GitHub/Render retain their configured automatic checks.
Art is implemented with existing GLBs and procedural assets; no external asset pipeline or engine replacement is introduced.
