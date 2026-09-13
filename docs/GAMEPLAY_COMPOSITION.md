# Gameplay composition pass

- Playfield width: 14.4 logical units, with safe-route destinations and additional optional platforms across the arena.
- Optional branches may be narrow or close to the lateral vines. The guaranteed route remains separately tagged and simulation-tested.
- Moving branches receive deterministic slow (0.62x), medium (1.0x), or fast (1.48x) motion tiers and varied travel ranges.
- Pace begins at 1.04 and reaches the existing 3.0 cap after 150 active seconds.
- The visual character root is scaled by 1.3 while the shared physics footprint remains unchanged.
- Facing uses +/-45-degree diagonal views. Input reverses immediately; only the visual turn blends over 0.28 seconds.
- A stronger cool-white rim light, following point light, and subtle additive halo keep the selected Chimpion prominent.
- Balanced/Low hides the modeled trunk, ivy, particles, authored tree image, and authored platform GLB while retaining lightweight background layers and procedural platforms.
- Lateral wrap boundaries use layered bark, highlights, leaves, glow, and shadows for a more organic vine treatment.

Validated with production build, deterministic physics/layout tests, controls test, and browser gameplay regression. Physical mobile/device performance remains a real-device check.
