# Pace and boosts

Pace ramps from 1.16 to 3.0 in 120 active seconds, then stays capped. Ordinary jump height stays consistent using ballistic integration.

Spring impulse is 28 (previously 15.5): theoretical height increases from 6.67 to 21.78 units, approximately 3.26 times. Steering and procedural generation continue during ascent.

Every 60 active seconds, a jetpack appears off the outer edge of an upcoming platform, above the landing surface. It expires after 20 seconds or leaving the view. Collection grants five active seconds of upward flight at 24 world units/second, independent of pace. Pause freezes the timer. Normal jumping resumes at expiry. A twin-tank model, flame and HUD countdown indicate flight.

Sound defaults on and is unlocked by the start interaction. Muting remains available.

Validation: production build, 21,572 transfer fixtures, spring height ratio, minute spawn, pickup, flight duration/distance, reset and browser gameplay regression passed locally.
