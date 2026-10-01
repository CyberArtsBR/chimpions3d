# Chimp Jump gameplay-depth mastery v1 audit

Starting main SHA: `1142bf7dc033e597481ef6ed5f4d59bb4c757e92`

Branch: `feat/jump-gameplay-depth-mastery-v1`

## Baseline gameplay loop

Chimp Jump is an auto-jump vertical climber. The player does not manually trigger the normal jump; the core skill is horizontal steering, reading future branches, landing, and preserving upward momentum. The world wraps horizontally at the vine boundary. Required-route generation is deterministic and uses a transfer viability check so seeded competitive runs remain reproducible and the required path remains physically reachable.

## Baseline landing and physics

`Game.step()` advances a fixed-step simulation. A landing is detected while descending by solving the crossing time between the player's previous/current Y and the platform's previous/current Y, then testing wrapped horizontal distance against platform width. Spring landings use the existing stronger `SPRING_JUMP`; normal branches use `JUMP`. Required-route placement is validated against the same horizontal acceleration/speed model used by gameplay.

## Platform vocabulary before this patch

The director already authored encounter steps named `leaf`, `swing`, and `vanish`, and scenery already contained presentation hooks for these names. However, optional route creation converted `leaf -> moving`, `swing -> moving`, and `vanish -> cracked`, so those authored concepts did not exist as independent gameplay mechanics.

Existing effective mechanics included solid, cracked, moving, vertical, spring, hazards, jetpacks and events.

## Platform vocabulary after this patch

- **Solid**: required SAFE-route foundation.
- **Cracked**: breaks after a successful landing.
- **Moving**: deterministic horizontal translation.
- **Vertical**: deterministic vertical translation.
- **Leaf**: stationary horizontal target with a flexible visual response and a controlled `LEAF_JUMP` rebound distinct from normal and spring jumps.
- **Swing**: deterministic pendulum-like X/Y motion; timing matters and its motion is replayable from simulation time.
- **Vanish**: stable for the landing, arms on contact, provides a warning window, then disappears independently of cracked behavior.
- **Spring/Mushroom**: retains the true spring boost and remains available as a reward-route mechanic.

## Route structure

Required branches remain `SAFE` and preserve reachability validation. Optional generated branches are classified as `RISK` or `DANGER`; DANGER is used for hazard-backed or higher-complexity challenge rewards. Optional branches receive stronger banana value than SAFE branches while remaining unnecessary for survival.

## Landing mastery

Landing quality is deterministic and computed in the physics layer from:

- normalized distance from platform center;
- player horizontal velocity relative to platform motion;
- target platform width.

Classes:

- **PERFECT**: centered and controlled.
- **GOOD**: successful normal landing.
- **EDGE**: near edge or excessive relative lateral speed.

Successful collision remains authoritative; an EDGE classification never randomly rejects a landing already accepted by collision.

## Flow

Flow is performance-driven rather than altitude-driven. Flow points feed the multiplier ladder `x1 / x1.5 / x2 / x3 / x4 / x5`.

Positive sources include PERFECT landings, RISK/DANGER routes, moving/swing execution, Fast Fall PERFECTs, near misses, and encounter completion. EDGE landings, hazard hits, and extended SAFE-only play reduce Flow. The multiplier is capped while the existing altitude pace remains uncapped.

## Score

Verified score is now:

`floor(altitude) + floor(bananas) * 10 + floor(mastery bonus)`

Mastery bonus is accumulated by authoritative simulation events and scaled by current Flow. The client does not submit an authoritative score; the server replays the trace and recomputes the same Game state and score.

## Fast Fall

Fast Fall adds one optional advanced action without changing auto-jump identity.

- Keyboard: Down Arrow / S.
- Controller: lower face button (`button[2]`) in the normalized pad state.
- Only activates while descending and after a short post-bounce safety window.
- Adds deterministic downward acceleration with a terminal-speed clamp.
- Cannot create upward height or replace the normal auto-jump.
- A Fast Fall into a PERFECT landing provides an additional mastery reward.

## Replay and server verification

The existing run trace remains run-length encoded. Normal steering segments stay `[axis,count]`. Segments using Fast Fall are encoded as `[axis,count,1]`. The server validator accepts both forms and replays the Fast Fall flag through `Game.step()`. Old two-field steering segments therefore remain valid for the new ruleset while new competitive actions stay server-verifiable.

## Input architecture

`InputManager` remains the single browser input normalizer. Left/right steering still supports keyboard, mouse, touch and gamepad. Fast Fall is layered on top of that steering state without changing menu navigation or pause controls.

## Encounter and hazard architecture

The existing director uses READ -> BUILD -> CHALLENGE -> RELEASE -> REWARD phases. Hazard families remain deterministic and telegraphed. This patch activates more of the encounter vocabulary rather than replacing the director. Hazard collision remains unchanged except that hazard hits now affect Flow; near misses are single-cycle skill events and cannot be repeatedly farmed from the same hazard activation.

## Progression

Pace remains deterministic, increases at 200 m milestones and stays uncapped. Mastery depth now adds a second difficulty axis: higher-risk route decisions and platform timing can become harder without making the required route depend on luck.

## Presentation and character hooks

The existing character animation signals, scenery/VFX events, reduced-motion setting and render-quality profiles are preserved. The mastery presentation adds compact contextual Flow and landing/risk feedback rather than permanent HUD clutter. Existing special-platform scenery groups for leaf, swing, vanish and mushroom are retained instead of being hidden by the technical platform skin.

## Scope deliberately not changed

- no manual normal-jump button;
- no character-stat advantages;
- no collision rewrite;
- no horizontal-wrap rewrite;
- no required-route random hazards;
- no graphics-quality gameplay differences;
- no merge to main;
- no deployment.
