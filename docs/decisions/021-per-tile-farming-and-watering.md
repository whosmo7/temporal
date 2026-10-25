# 021: Per-tile farming, plant then water, and the watering can

**Status:** decided 2026-10-24 by the user · **Section:** `13` · **Changes:** `01` › Actions, `03` › plots, `04` › interaction, the locked 8-action list in `00`

## Context

[019](019-per-tile-actions-take-time.md) already made each field tile its own plot, worked with the tile you face. The user
also wanted crops that need watering before they grow, with a can filled at a water source.

## Options

1. A new **Water** action (chosen), replacing the locked eight-action list.
2. Fold watering into Plant Crops as a second step on the same key.
3. Replace an existing action to keep eight.

## Decision

- **Every field tile is its own plot** (019) with its own stage and clock: plant, water, grow and harvest per tile.
- **Plant Crops** leaves a tile `sown`. It doesn't grow until **watered once**. The tile's ripening clock starts at the pour.
- **Water** is a new action. Plant Orchard goes away ([024](024-emergent-orchards-and-flowers.md)), so there are still eight.
- **The watering can** holds **3** pours (first pass). You fill it at a dug well, the reservoir, a pond or the sea edge.
  **Filling never costs stored Water.** It's an interaction, not a logged action.
- **An unwatered seed carries over** to the next player, and **withers 2 generations after planting** if nobody waters it.
- Stamina stays at 0 cost (019) and is a placeholder. Water takes `[PLACEHOLDER 1 s]` in `actionSeconds`.

## Consequences

- **Contract changes (A):** `ActionType` loses `plantOrchard` and gains `water`. New `can`
  state, new tile stages `sown`, `watered`, `withered`, new cause rule `wither`.
- Worldgen (B) marks water-source tiles.
- The walk to a source and back becomes part of a day's time budget.
