# Chimpions Dash Release Hardening v3

Starting main SHA: `0460153215e3a53c95bd03aecb20e07c0d79d3cf`

This branch is release hardening only. It must not be merged or deployed by the QA assistant that owns it.

## QA tiers

### FAST

Purpose: source contracts, physics/scoring invariants, deterministic gameplay math, asset validation and cheap presentation contracts.

```bash
npm ci
npm run build
npm run qa:fast
```

### STANDARD

Purpose: Chromium gameplay flow, responsive UI, keyboard/mouse/touch/basic controller, pause/retry and the normal browser regression set.

```bash
npm ci
VITE_CHIMP_QA_HOOKS=1 npm run build
npx playwright install --with-deps chromium
npm run preview -- --host 127.0.0.1
# In a second shell while preview is running:
npm run qa:standard
```

### RELEASE

Purpose: STANDARD plus viewport/stage pattern fuzzing, full runtime determinism, black-screen sentinel, live accessibility settings, resource stability, graphics tiers, performance/reliability and context-loss/audio-failure scenarios.

```bash
npm ci
VITE_CHIMP_QA_HOOKS=1 npm run build
npx playwright install --with-deps chromium
npm run preview -- --host 127.0.0.1
# In a second shell while preview is running:
npm run qa:release
npm run qa:network
```

GitHub Actions exposes the RELEASE gate through **workflow_dispatch → run_release=true** so normal edits do not pay for the full expensive suite.

## Release blockers

Any of these blocks release:

- black/blank gameplay canvas or no meaningful WebGL output
- unable to complete Start → picker → select → explicit Play → gameplay
- gamepad Start bypasses the picker/Play contract
- impossible deterministic obstacle or transition
- viewport warning/reaction-time contract violation
- deterministic divergence for identical rules version + seed + input timeline
- keyboard jump/slide regression
- mouse jump/slide or context-menu regression
- controller picker/pause/retry regression
- stuck touch input after pointercancel/lostpointercapture
- character failure removes the last valid playable avatar
- High Visibility does not alter GPU gameplay presentation
- Reduced Motion does not alter GPU/VFX behavior
- Screen Shake toggle does not suppress shake impulses
- Large Touch does not increase touch target geometry
- mute/audio bus controls do not alter live mix state
- supported WebGL context restore cannot recover meaningful rendering
- resource counts grow without stabilizing across retries/quality/avatar cycles

## Final integration checklist

Use an integration branch created from the intended release `main`. Merge feature branches there one at a time; after every merge run FAST, then run STANDARD after any runtime/UI/input change. Run RELEASE after all six areas are integrated.

### 1. Environment art

- GPU environment still initializes and renders meaningful geometry.
- All release viewports preserve player/hazard readability.
- Environment additions respect quality tiers and DPR ceilings.
- Decorative asset failures do not hide lethal gameplay geometry.
- No new unbounded scene objects, textures or geometries.
- Run black-screen sentinel after environment shader/material changes.

### 2. Hazards / VFX

- Every lethal hazard has valid collision geometry and visible GPU presentation.
- Perfect jump/slide, near miss, banana and golden banana events still update score/Flow/combo.
- Reduced Motion suppresses ambient motion/streaks and reduces event particles.
- High Visibility remains visible on all hazard families.
- VFX particle counts and hazard pools remain bounded.
- Pattern fuzzing has zero reaction-window/overlap failures.

### 3. Gameplay director

- Do not alter fixed 120 Hz simulation, seed semantics or collision authority without bumping the gameplay/rules version.
- Run FAST immediately after difficulty/pattern/scoring changes.
- Run RELEASE pattern fuzz across all stages/viewports.
- Identical rules version + seed + input timeline must produce identical obstacle/collectible/timing/score/distance/Flow/combo/result data.
- A genuine safety failure must be fixed; do not loosen assertions.

### 4. Character animation

- Character remains visible at all quality tiers.
- Jump/landing/slide animation may follow simulation but never drive physics/collision.
- Missing/invalid/timed-out character loads preserve the previous valid Chimpion.
- Repeated character swaps must stabilize geometry/texture counts.
- Verify representative approved rigs and local GLB fallback.

### 5. UX / audio / accessibility

- Complete menu → picker → explicit Play → gameplay → pause → results → retry flow with keyboard, mouse/touch and gamepad.
- Gamepad Start may open the picker but may not bypass Play.
- Pointer cancellation/lost capture clears held input.
- Blur/hidden-tab pause clears input and resumes without a large physics step.
- High Visibility, Reduced Motion, Screen Shake, Haptics, Large Touch, Mute and each audio bus must have observable runtime effects.
- AudioContext/autoplay/music failures may not block play.

### 6. Performance / reliability

- AUTO/LOW/BALANCED/HIGH/ULTRA remain switchable without crashes.
- DPR/shadow state must match tier intent.
- Repeated retries, quality changes and character changes must not leak renderer resources.
- Context loss/restoration must recover meaningful render output where supported.
- No critical gameplay visual depends exclusively on a remote asset.
- Avoid absolute FPS release gates; use bounded resource/draw/particle checks instead.

## Failure reproduction payload

Pattern-safety failures must preserve:

- seed
- gameplay/rules version
- game time
- stage
- speed
- viewport
- previous pattern
- next pattern
- previous action
- next action
- obstacle IDs
- available reaction time
- required reaction time
- calculated gap

Do not merge feature branches from this QA branch. Use its reports and checklist against a separate integration branch.
