# Platform balance

Platforms are reduced a further 25% from the previous version (scale 1.5 * .75 * .75). Items retain their size.

Moving platforms travel 1.65 units to either side, 50% farther than the previous version. Their frequency is also 20% faster. The existing 20% speed increase at every 30-second level remains, including after the four visual environments cycle. Phase is integrated per level to avoid position jumps at transitions. Size-based speed ordering remains.

One shared placement rule checks every platform within a 2.2-unit vertical band, reserving both platforms' complete travel envelopes and a 0.8-unit gap for decorative silhouettes. Bounds reserve travel and a margin inside the vines. Generation now targets 2.7 platforms per row, an 80% increase over the former 1.5 average; optional branches are still omitted when no safe space exists. New moving branches start at their current phase position.

Stationary platforms still become fragile from pace 2.5, including mushrooms. Jetpacks still spawn in random open-air positions every 30 seconds with five-second flight.

No tests or local build executed, per user request. Existing automatic CI remains enabled.
