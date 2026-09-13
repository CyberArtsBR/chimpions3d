# Platform balance

Platforms are reduced a further 25% from the previous version (scale 1.5 * .75 * .75). Items retain their size.

Moving platforms travel 1.1 units to either side, twice the previous amplitude. Actual peak lateral speed increases 75%, then compounds by 20% at every 30-second level, including after the four visual environments cycle. Because amplitude doubled, angular frequency is multiplied by 1.75 / 2 to achieve a 75% linear speed increase. Phase is integrated per level to avoid position jumps at transitions. Size-based speed ordering remains.

One shared placement rule checks every platform within a 2.2-unit vertical band, reserving both platforms' complete travel envelopes and a 0.8-unit gap for decorative silhouettes. Bounds reserve travel and a margin inside the vines. Optional branches are omitted when no valid space exists. New moving branches start at their current phase position.

Stationary platforms still become fragile from pace 2.5, including mushrooms. Jetpacks still spawn in random open-air positions every 30 seconds with five-second flight.

No tests or local build executed, per user request. Existing automatic CI remains enabled.
