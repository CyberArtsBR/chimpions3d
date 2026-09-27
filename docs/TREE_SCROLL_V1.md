# Infinite tree scroll v1

Base: `e18766d8aa523ef2e65185dedb244dc0fa70692d` (fetched origin/main).
Branch: `feat/jump-infinite-tree-scroll-v1`.
The implementation commit is the commit containing this report (`git log -1 --format=%H -- docs/TREE_SCROLL_V1.md`). No merge or deployment was performed. Work is isolated from the user's dirty main checkout.

## Implementation

- `src/scenery.js`: one camera-centered tree plane; upward camera travel advances V so bark moves downward. `TREE_SCROLL_PER_SCREEN = 0.32`; the crop's repeatY converts screen distance into texture distance, so the visible movement rate is consistent across aspect ratios. The former physical displacement and lateral tree sway are removed.
- `src/game.js`: only read-only scenery diagnostics added to the existing snapshot; no gameplay changes.
- `public/environment.json`: portrait and landscape select the same prepared long strip, with aspect-correct centered cropping. Distinct future orientation URLs remain supported. URL-based caching avoids loading the same strip twice.
- `public/environment/tree-climb-abc-v1.webp`: 724 x 2172, 593,572 bytes. A prepared image derived with imagegen from the user's three references, not a literal lossless A/B/C concatenation. Original assets remain unchanged.
- `scripts/asset-manifest.mjs`: includes the new asset for hashing/versioned loading and payload accounting.
- `checks/tree-scroll.mjs`, `checks/tree-scroll-game-browser.mjs`, and `checks/tree-scroll/`: focused checks, machine-readable results, and screenshots.

## Texture and transition

sRGB, ClampToEdgeWrapping on S, RepeatWrapping on T, anisotropy 4, default mipmaps and filtering retained. Both the supplied references and the prepared strip have mismatched top/bottom bark and silhouettes. Raw repetition is therefore not used. A configurable 12% smooth overlap joins the end to the start inside the existing material, with at most one extra texture sample in the overlap. Explicit continuous UV derivatives prevent mip-filter lines at fract boundaries. No additional planes, postprocessing, or per-frame canvas work.

The overlap is mathematically periodic but is not an artist-authored seamless bark join. Slight double detail/softening can be seen within the transition, and a finite strip eventually repeats. A future artist-retouched strip with matching bark and silhouettes can replace the file through environment.json; set `treeScrollOverlap` to `0` for a truly seamless texture. Keep the current overlap for this asset. No further processing is necessary to run this branch, but hand-retouching is required if completely uninterrupted bark detail is the acceptance standard.

## Lifecycle, quality, and cost

Reset clears origin, phase bias, and climb offset; the next scenery update captures the camera origin. Existing retry/new-run/replay calls use the same reset path. Actual menu-to-new-run reset was browser-tested; seed replay and death/quick-retry use the inspected shared reset path but were not separately exercised.

Resize preserves origin, climb distance, and the center texture phase while recalculating the aspect-correct crop. A phase bias prevents rotation from snapping back to the beginning. Reduced motion uses 25% speed (effective factor 0.08) and preserves phase when toggled. Existing forest/mist and biome/day-night tint are retained.

Balanced and constrained mobile retain their existing forest fallback. High/Ultra retain the authored trunk where the existing budget allows it. Portrait authored rendering is also tested independently of that budget gate. There is no per-frame geometry/texture/vector creation in the new scroll logic, no growing panel list, and a single texture is shared across orientations. Approximate decoded texture cost including mipmaps is 8 MiB. No physical-device GPU timing or hours-long soak claim is made.

## Validation

Passed:

- `node checks/core-regression.mjs`: existing physics/gameplay suite.
- `node checks/determinism-regression.mjs`: 64 deterministic seeded simulations.
- `node checks/tree-scroll.mjs`: zero start; positive climb; actual downward pixel displacement; wrapping; camera heights 100, 1,000, 10,000, 100,000 and 1e12; reset; resize phase preservation; reduced-motion phase preservation; quality fallback/restoration; stable resource counts through 1,200 rendered climb updates; no browser/shader errors.
- Five authored-tree viewports: 390x844, 844x390, 768x1024, 1440x900, 2560x1080.
- `node checks/tree-scroll-game-browser.mjs`: actual Jump boot/start/climb, camera lock, menu/new-run reset, desktop and constrained-mobile captures. Uses only existing development QA hooks. The synthetic climb changes only the test's game instance, not production gameplay code.
- Rendered wrap continuity: average channel difference approximately 0.001/255 between frames immediately before/after a full normalized cycle.
- GPU counts remained 7 geometries / 5 textures in the isolated scenery fixture.
- `npm run build`.
- `node checks/asset-budget.mjs`: environment payload 8.92 MiB under the unchanged 9 MiB cap.
- `node checks/production-hook-safety.mjs`: no mutable QA API in the production bundle.
- `git diff --check`.

The broader `checks/game-browser.mjs` was attempted but stops at line 37: it expects `cinematic-max` while the running checkout defaults to `high`. That suite did not pass and was not rewritten as part of this visual task. Dash/launcher source is unchanged; a dedicated Dash browser run was not performed.

## Evidence and integration

See `checks/tree-scroll/gameplay-desktop.png`, `gameplay-mobile.png`, the five orientation captures, `overlap-portrait.png`, `report.json`, and `gameplay-report.json`. The mobile gameplay capture intentionally shows the existing budget-gated forest fallback.

Check out this feature branch, run `npm ci`, then `npm run dev` or `npm run build`. Asset preparation/manifest generation remains part of the normal build. For focused QA, serve Vite on 4173 and run `node checks/tree-scroll.mjs`. Start a separate local server with `VITE_CHIMP_QA_HOOKS=1` on 4174 for `node checks/tree-scroll-game-browser.mjs`; do not enable this variable for production. `CHIMP_TEST_URL` can override either test URL. No new dependencies.

## Source provenance

User attachment SHA-256:

- A: `a36c1e17fde8e4f36ce48bd05977e7b6ae708ce46572334d223f2ac342d7344e`
- B: `f0d99c2276e696ada4fd4cb5ecd625e64b70e29d247ea22a7a8d9792ee24f9c9`
- C: `71dd84234038d3194b1796047b629824fd9a9d26ae8eba0e6700beaebe097bec`
- Runtime WebP: `871317fdcb5342de3e906e9393efd129f83a0e5dc81fe974fbf3b413f1f57d35`

Prepared strip preserves the supplied warm brown realistic bark, dark green forest margins, and central giant trunk. Its backdrop is darker and less mossy than the older tree-wide images, consistent with the new supplied references. The exact original artwork is retained in the repository for comparison.
