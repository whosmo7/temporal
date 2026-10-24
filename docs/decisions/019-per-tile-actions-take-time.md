# 019 — Fields and orchards are worked tile by tile, and every action takes time instead of stamina

**Status:** decided 2026-10-24 by B, at the user's request · **Changes:** `01` › Actions and Config values, `02` ›
plots, `03` › orchard size, `04` › Interaction model, ids.md › plot IDs, [016](016-hunger.md) (eat yields per tile)

## Context

The user wanted the player to work each tile on its own, with each action taking time, and stamina kept in the game
but costing nothing for now. Until now a whole 3×3 field was sown or harvested in one press, and the orchard was one
big tree.

## Options and choices

| Question | Options | Chosen |
|---|---|---|
| Which plots go per tile | fields and orchard · fields only · everything | **Fields and orchard.** Reservoir, well and wild stay one target each |
| Which tile an action goes to | the tile you face · the nearest tile · the tile under you | **The tile you face**, outlined |
| How actions take time | a duration per action · one for all · hold the key | **A duration per action**, in config, with a progress bar |
| Yields per tile | new per-tile numbers · today's numbers per tile | **New per-tile numbers**, so a full plot gives about what it did |
| Orchard look | bigger plot with 2×2 trees · four 1-tile trees · orchard stays whole | **Four 1-tile trees** on the 2×2 plot |
| Water for sowing a tile | none · 1 per tile | **None.** A tree costs 1 water |
| Fast Track rows | one per plot · one per tile · faced tile only | **One per tile** ("Field tile 4", "Tree 2") |

## Decision

- **Every field and orchard tile is its own plot in the engine,** keyed `<plot>:<x>,<y>` (`field-1:2,0`), with
  `tile: { plot, x, y }` on its `PlotState` and `VisiblePlot`. Ripening, rot, wear, maintenance, storms, causes and
  Fast Track work on tiles with no rule changes. The whole `field-1` is no longer an engine plot. Helpers in
  `src/engine/tiles.ts`.
- **Numbers** (config): `cropYield` 1 per field tile (9 per full field, was 5), `orchardYield` 4 per tree (16 per full
  orchard, was 15), `plantCropsWater` 0, `plantOrchardWater` 1 per tree. **Every stamina cost is 0**; stamina, the
  bar and `weakened` stay.
- **Durations** (`CONFIG.actionSeconds`, turn seconds): harvest 1, sow 1.5, plant a tree 3, repair 8, dig 6,
  fish/hunt 3, tend 3, hurry 2. The player stands still with a bar over their head. The store applies the action
  through the engine **when the time is up**, at that time, so the log, the server re-run and the replay see it then.
  An action that can't finish before 6 am isn't started ("Not enough time left today"); one under way at the end of
  the day is dropped.
- **Targeting:** the tile next to the player's feet in the direction they face, if it's a field or orchard tile, is
  outlined and gets the prompt. Otherwise the nearest whole plot, as before. Fields stay walkable; the orchard stays
  solid.
- **Worldgen** retries a layout until every tree has a side the player can reach, and rejects an orchard more than 2
  tiles thick both ways (an inner tree could never be reached). Seeds whose maps were already fine are unchanged.

## Consequences

- **Contract change (A):** plot ids for fields and orchards are tile ids; `PlotState.tile`, `VisiblePlot.tile`,
  `CONFIG.actionSeconds` are new. Saved worlds from before this change don't load (their plots are whole plots).
- **The engine doesn't enforce durations.** A commit with actions closer together than their durations is accepted.
  `commit-turn` could check the gaps if cheating matters.
- **Balance (C):** with stamina free, nothing limits actions but time. Fast Track on crops costs nothing and only takes
  2 s, and a repair can be hurried for free. `simulate` runs, but its strategies and the dilemma need a new look
  (`inheritance-balance`).
- **Art (whosmo77):** field tiles use their cell of the existing `field/<stage>` frames (edge cells on edge tiles). Trees
  are code-drawn for now; atlas frames named `orchard/tree-<stage>` (one tile, overhanging up) replace them when added.
- Cost summary: "crops rotted" counts tiles ("3 patches of crops rotted"). Replay lines merge by wording, so nine tile
  harvests read as one line.
