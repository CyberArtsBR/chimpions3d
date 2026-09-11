# Chimp Jump — graphics and gameplay audit

## Decision
Keep Vite, vanilla JavaScript and Three.js. The game already renders real 3D characters. Changing language or engine would not supply better art, and would discard working rig and deployment code. This pass improves materials, lighting, composition and movement within the existing static Render deployment.

Visual target: detailed, atmospheric forest with legible arcade platforms. This is a procedural art upgrade, not a claim of photorealism. True scanned foliage/bark, authored hero trees and lighting reference would be the next art investment after playtesting.

## Findings and implemented changes

| Area | Finding | Change |
| --- | --- | --- |
| Jump | Gravity 32 / launch 14 gave a 0.875 s full arc and theoretical apex 3.06 units | Gravity 18 / launch 12.6 gives 1.40 s full arc, apex 4.41; discrete simulation lands slightly below analytical apex |
| Density | Rows every 1.25–1.85 units plus overlapping optional rows | One branch per row, 2.60–3.45 units apart; no bonus rows stacked nearby |
| Challenge | Broad platforms often shared the same horizontal position | Each row requires 1.65–2.90 units of lateral transfer; platform widths gradually reduce from 2.50 to 1.85 |
| Steering | Speed 6 felt hurried | Speed 4.4, acceleration 24; controls and turns remain immediate while arcs feel slower |
| Camera | Character small in 10 × 16 court | Court 8.6 × 13.76: about 16% closer at the same screen aspect; fixed frontal camera, entire horizontal playfield retained |
| Platform art | Plain cylinders and rectangular green tops | Rounded textured logs, bark bump detail, cut wood rings, twigs, irregular moss cap and instanced leaves |
| Item art | Single torus collectible | Three curved banana meshes with dark stem, gentle rotation/bobbing and collection particles |
| Special branches | Primarily color-coded | Moving branch has turquoise rings, fragile branch has visible dark splits, spring has a spotted mushroom |
| Background | Flat mountains and polygon trunk | Three generated forest image layers, curved bark trunk, ivy, atmospheric haze, sun shafts and floating motes |
| Lighting | Basic flat illumination | Filmic tone mapping, warm directional sun, cool rim fill and contact/cast shadows in High detail |
| Feedback | Little visual response on contact | Short landing ring and collection/spring particles; existing optional audio retained |
| Themes | Palette switches | Existing 30-second active-time cycle retained across sky, atmosphere and light; moonlit treatment for sun/shafts/motes |
| Upload | Catalog only | Local file picker, rig/size/texture checks, normalization, idle-before-reveal and restore previous avatar on rejection |
| Facing | Assumed one source forward direction | Optional “Flip avatar facing”; visual turns still pass through the character's front |
| Resource use | Simple meshes, disposal needed for new details | Shared scenery geometry/textures, instanced leaves, bounded branch/particle counts, disposal on avatar replacement and rejection |
| Mobile | One quality setting | Balanced default for coarse-pointer devices, user-selectable High/Balanced, capped pixel ratio and touch controls |
| Menu | Too little room for upload options | Responsive scrollable card, avatar feedback and quality controls |
| Preservation | Existing rig testing still useful | Original lab retained at ?rig=1; source GLB and technical rest pose unchanged |

## Avatar support
Use a self-contained GLB 2.0 with an ordinary skinned humanoid, embedded textures, Y-up orientation, and recognizable humanoid bone names. The current chimp is the verified reference. Local uploads are not sent to Render or saved across reloads.

Upload limits: 32 MB, 300,000 mesh triangles, 2,000 scene nodes and 48 million decoded texture pixels. Draco/Meshopt/KTX2-compressed exports require decoders and are rejected with an explanation. Automatic mapping requires arms/forearms plus hips, thighs, shins and feet. Uncertain names fail visibly in the UI instead of revealing an unposed character. Catalog entries can supply explicit bone-name overrides. Arbitrary non-humanoid rigs are not automatically retargeted.

Limits reduce common stalls; malformed or heavily compressed images can still be costly to decode. A Web Worker asset preflight and optional offline optimization are follow-ups if testing third-party assets becomes a core product feature.

## Validation
- Production Vite build.
- Existing rig-lab browser checks: actual model, mapping, arms, states, skeleton.
- Generated route validation across 250 seeds through 200 units, using simulated steering to land each adjacent transfer.
- Jump timing/height, one-way swept landings, horizontal wrap, deterministic seeds, spring, fragile branches and death/retry checks.
- Browser: actual uploaded chimp, malformed GLB, unsupported bone names, previous avatar recovery, no external requests during local upload.
- Browser: pause, turns, themes, mobile layout, quality toggle and bounded geometry/texture counts after repeated retries.
- Screenshots captured from the production bundle.

Render counters are useful regression evidence, not frame-rate measurements. Hardware FPS, GPU time, memory and temperature on real phones still need device playtests. Fullscreen forest coverage increases fill cost; Balanced reduces pixel ratio, shadows and one forest layer.

## Next priorities after the first playtest
1. Tune jump distance and width based on real failures: target first-run survival of roughly 30–60 seconds, without changing physics by device.
2. Test at least one older Android phone and iPhone, then measure frame time before adding more effects.
3. Audit a representative set of the remaining avatars: broad shoulders, long limbs, hats, alternate bone labels, large textures.
4. Replace the central procedural tree with an authored hero asset and use licensed PBR bark/foliage for a closer-to-real art direction.
5. Add a small set of distinct platform silhouettes and authored biome props, maintaining unmistakable collision tops.
6. Improve airborne anticipation and landing compression on diverse rigs; preserve consistent collider size for fairness.
7. Add sound balancing, reduced-motion particle options and remappable controls if player testing identifies a need.
8. Consider compressed asset variants only after adding and validating the corresponding decoder pipeline.

Excluded from this pass: multiplayer, backend, accounts, external animation files, full physics engines, unbounded postprocessing and downloading all 221 avatars at once.

Technical reference: https://threejs.org/docs/ (WebGLRenderer, GLTFLoader, InstancedMesh, MeshStandardMaterial).
