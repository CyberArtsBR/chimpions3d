# Platform balance

Platform thickness uses scale 1.5 * .75 * .75. Length is now 30% greater through the separate PLATFORM_LENGTH constant, so physics and graphics agree. Items retain their size.

Moving platforms travel 1.65 units to either side, 50% farther than the previous version. Their frequency is also 20% faster. The existing 20% speed increase at every 30-second level remains, including after the four visual environments cycle. Phase is integrated per level to avoid position jumps at transitions. Size-based speed ordering remains.

One shared placement rule checks every platform within a 2.2-unit vertical band, reserving both platforms' complete travel envelopes and a 0.8-unit gap for decorative silhouettes. Bounds reserve travel and a margin inside the vines. Generation now targets 3.51 candidates per row, a 30% increase over 2.7; optional branches are still omitted when no safe space exists. New moving branches start at their current phase position.

Stationary platforms still become fragile from pace 2.5, including mushrooms. Jetpacks spawn in random open-air positions every 30 seconds with ten-second flight.

No tests or local build executed, per user request. Existing automatic CI remains enabled.
