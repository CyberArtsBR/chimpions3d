# Expedition reference update — 2026-09-27

Implements a cyan metal HUD, visible graphics selector, glowing banana pickups and metal/moss platforms: blue solid, red one-bounce breakable, yellow horizontal travel, purple vertical travel. Existing optional spring/leaf/swing/vanish routes map to the four requested behaviors; required safe routes remain solid. Vertical collision uses relative platform/player motion and reserves the vertical travel envelope.

Original user JPEGs are copied byte-for-byte to public/backgrounds/expedition. Four portrait sources and two landscape sources were supplied. Landscape neon/night use the matching portrait JPEG with cover framing; no image is converted, resized or recompressed on disk. Scenery changes every 400m in day/golden/neon/night order.

Jump poses use smoother extension/recovery and landing anticipation, with reduced mesh stretching. Existing rig, input, avatar selection and gameplay director are preserved.

User explicitly requested immediate commit/deploy without tests or benchmarks. This release uses the [build only] commit marker to run only the production build in CI and skip the downstream production audit. Normal QA remains enabled for future commits without that marker. Gameplay and visual testing were not performed.
