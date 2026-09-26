# Chimp Jump — AAA Gameplay Director

Branch: `feat/jump-aaa-gameplay-director`

Baseline: P0 stabilization candidate `fix/jump-p0-green-baseline` at `e27ed60cb97aca0040a22396a510da545269fccf` (PR #57). The gameplay branch is a clean descendant of that P0 head and the draft PR is temporarily targeted to the P0 branch so unrelated newer `main` commits are not mixed into gameplay validation. Nothing from this branch is merged or deployed.

## 1. Previous difficulty behavior

The previous global pace function was:

```text
pace(t) = 0.92 + 2.08 * clamp(t / 300, 0, 1)
```

That produced approximately:

| Active time | Previous pace |
| --- | ---: |
| 0 s | 0.92× |
| 60 s | 1.336× |
| 180 s | 2.168× |
| 300 s | 3.00× |
| 5+ min | 3.00× |

`paceAt()` multiplied the fixed-step physics delta used by steering acceleration, horizontal travel, gravity/jump integration, bounce age and camera smoothing. Run time itself still advanced in real seconds, so event timers, jet duration and time-keyed platform/hazard motion were not uniformly accelerated. At high pace this created much shorter player reaction windows and an increasingly asymmetric relationship between player physics and real-time world motion. Difficulty therefore rose strongly through player/camera simulation compression rather than primarily through route reading and encounter composition.

The old generator also built each row independently. It always preserved a solid safe route, but optional platform type, hazards and rewards did not form higher-level authored phrases.

Jetpacks were scheduled at fixed 30-second boundaries with a 10-second duration. Canopy events occurred on a fixed 45-second interval with a 12-second duration. These systems could create noisy overlaps without a shared intensity budget.

## 2. Changed difficulty curve

Physics constants are intentionally unchanged:

- gravity: 18
- normal jump impulse: `12.6 * sqrt(1.3)`
- spring jump impulse: `28 * sqrt(1.3)`
- horizontal speed: 6.2
- steering acceleration: 24
- landing collision tolerance remains unchanged

The new pace curve is deliberately modest:

| Active time | New pace |
| --- | ---: |
| 0 s | 0.96× |
| 60 s | 1.00× |
| 180 s | 1.10× |
| 300 s | 1.20× |
| 480 s | 1.32× |
| 720+ s | 1.42× |

Difficulty now centralizes deterministic controls for:

- altitude contribution
- active-time contribution
- required-route width
- optional reward distance
- moving-platform frequency
- hazard density
- encounter complexity
- recovery cadence
- modest pace multiplier

No device-specific difficulty and no player-skill physics adaptation are used.

## 3. Encounter grammar

The generator now selects seeded encounter templates above individual platform placement.

Pacing vocabulary:

`READ · BUILD · CHALLENGE · REWARD · RELEASE`

Templates use those phases as a phrase grammar rather than a mandatory single ordering. Hard phrases finish in `RELEASE`; reward beats can occur before that release. The central `recoveryFrequency` can also deterministically extend the release by one extra safe row, with more breathing room early and slightly less at expert intensity.

Current templates:

- `moving-choice`
- `banana-risk-cracked`
- `spring-reward-line`
- `swing-opening`
- `vanish-reunion`
- `fruit-gauntlet`

Each generated required platform stores encounter metadata:

- encounter id
- encounter type
- encounter step
- pacing phase
- required/recovery flags

Optional routes carry reward/risk metadata but never replace the required safe route.

## 4. New hazards

Existing:

- `thorn-pod`

Added:

- `swinging-pod`
  - deterministic pendulum motion
  - explicit lead-in telegraph
  - broad readable silhouette

- `vine-sweep`
  - deterministic telegraph window
  - sweep window
  - recovery window

- `falling-fruit`
  - deterministic pre-drop telegraph
  - vertical drop active window
  - recovery window

Rendering receives shared hazard identifiers plus:

- `hazard-telegraph`
- `hazard-active`
- `near-miss`
- telegraph kind
- lead time
- hazard id / deterministic cycle index

## 5. Fairness rules

Required-route generation remains solid and hazard-free.

Required transfers are validated using a fixed-step horizontal control simulation, not only maximum-speed geometry. Validation includes:

- vertical reach
- steering acceleration
- adverse initial horizontal velocity
- reversal
- horizontal wrapping
- landing margin

Generated hazards are attached to optional branches and their complete movement envelopes must remain outside the required platform safety envelope.

Dynamic hazards have a minimum deterministic telegraph lead before their active collision window.

Hazard collision and telegraph spam are suppressed while a jetpack or canopy event is active. Dynamic hazards restart their timing after the special and must telegraph again before becoming dangerous.

No hazard is allowed to convert the required route into intentional damage.

## 6. Jet / event coordination

Jetpacks no longer appear automatically every 30 seconds.

The seeded schedule now uses:

- first jet opportunity: 40–52 s
- later jet gaps: 54–72 s
- pickup lifetime: 18 s
- jet duration: 8 s

Jetpacks prefer optional/risk/reward supports so collection has meaningful positioning cost.

Canopy events now use seeded timing:

- first event opportunity: 48–62 s
- later event gaps: 56–74 s
- event duration: 12 s

A deterministic special-intensity budget prevents accidental overlap among:

- active jetpack
- available jetpack pickup
- Banana Bloom
- Spring Fever
- immediate hazard pressure

While a jetpack or canopy event is active, hazard collision/telegraph pressure is suspended. Dynamic hazard cycles restart with a fresh readable telegraph after the special. A 9-second separation budget is reserved around completed special states.

## 7. Deterministic test volume

`checks/jump-gameplay-director.mjs` covers:

- 2,000 broad generated-route seeds
- 96 additional long-height expert-route seeds through 1,400+ m
- at least 50,000 required-route transfer validations in the broad sweep
- at least 30,000 additional simulated long-height transfers
- all encounter templates
- all four hazard families
- complete moving hazard-envelope vs safe-route sampling
- telegraph-before-active assertions
- fixed-step replay determinism
- reset/restart and pause-state determinism
- wrap behavior
- spring/cracked/vanish semantics
- jet/event/hazard overlap budget
- 30 / 60 / 120 / 144 Hz render-cadence independence

The last executable FAST run before GitHub runner allocation became unavailable passed with **2,000 seeds, 175,646 validated transfers, 177,646 safe platforms and 5,059 generated hazards**, covering every encounter template and all four hazard families. The same run also passed build, source audit, determinism regression, assets and production-hook safety. Its Chromium STANDARD browser tier completed successfully. The EXTENDED run exposed a WebKit software-render timing race around the Pause control; the branch now freezes the QA render loop before that click.

The current head adds the 96-seed long-height sweep plus stricter special/hazard overlap assertions. Subsequent GitHub Actions attempts have been rejected before runner allocation (`runner_id: 0`), so those latest additive checks remain pending execution rather than being reported as passed.

The existing physics gate preserves the unchanged jump/collider fundamentals while removing assertions tied to the retired 3× pace and fixed 30-second jet schedule.

## 8. RULESET

Changed from:

`2026-09-expedition-v7-no-wind`

to:

`2026-09-expedition-v8-gameplay-director`

This is required because deterministic generation, pace semantics, hazard behavior, jet timing and event timing changed. The server replay validator imports the same RULESET from physics, so incompatible online runs cannot silently validate under the previous semantics.

## 9. Files changed

- `src/jumpGameplayDirector.js`
- `src/physics.js`
- `src/game.js`
- `src/scenery.js`
- `checks/physics.mjs`
- `checks/jump-audit.mjs`
- `checks/jump-gameplay-director.mjs`
- `checks/cross-browser-smoke.mjs`
- `docs/JUMP_AAA_GAMEPLAY_DIRECTOR.md`

Scoring implementation was not changed. The repository already has an explicit compatible authoritative `scoreFor()` contract (height plus the existing banana contribution), and that contract remains untouched. New near-miss, encounter-clear and risk-route counters are feedback/telemetry only and do not redefine leaderboard scoring.

## 10. Remaining human playtest questions

1. Does the 1.20× five-minute pace feel sufficiently urgent now that difficulty comes from route composition rather than simulation compression?
2. Are RELEASE sections long enough after high-complexity phrases to restore visual comprehension?
3. Is 8 seconds the right jetpack duration, or should the reward be 7–9 seconds after playtest?
4. Are optional reward branches visibly tempting enough to justify their increased lateral distance?
5. Are swinging-pod, vine-sweep and falling-fruit silhouettes distinguishable within one jump of first exposure?
6. Is the dynamic hazard telegraph readable with music/VFX enabled at high difficulty?
7. Does the special-intensity spacing feel curated rather than sparse?
8. Does the late-game route width retain mastery challenge without producing fatigue from repeated precision landings?
