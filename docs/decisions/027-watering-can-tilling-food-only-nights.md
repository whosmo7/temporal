# 027 — Watering as built: a logged can fill, tending retills rotten tiles, nights take food only

**Status:** decided 2026-10-25 by B, at the user's request · **Builds on:** [021](021-per-tile-farming-and-watering.md) ·
**Settles:** `13` open question 4 · **Changes:** `13` › Watering can and Tile lifecycle, `01` › Upkeep, `04` › HUD,
[002](002-upkeep-timing.md) (the "Needed by nightfall" line)

## Context

Building 021's sow-then-water loop and the watering can raised four questions the plan left open or didn't foresee.

## Options and choices

| Question | Options | Chosen |
|---|---|---|
| Tilling | none · a separate Till action · Tend does it | **Tend does it.** Soil starts tilled and stays tilled after a harvest. A rotten (or withered) tile can't be sown until it's tended, which clears it and tills it |
| Can at the start of a turn, sources | empty, any source · empty, working sources only · full | **Empty; any source:** a pond, the sea edge, a dug well (clear or stagnant), the reservoir (cracked or not) |
| The HUD's water count | — | **Shows the can** ("3/4") instead of stored water |
| Stored water and the night | keep the nightfall line · drop water from upkeep · drop all upkeep | **Nights take food only**, and the "Needed by nightfall" line goes |
| Plant Orchard | keep until trees come with level · remove now | **Kept for now**; Water is a ninth action alongside it |

## Decision

- **Tiles:** `empty` (tilled) → sow → `sown` → water → `watered` → (halfway) `growing` → `ripe` → harvest → `empty`.
  At the end of the day `watered` and `ripe` tiles rot; `sown` tiles wait for the next player and turn `withered`
  `witherGens` (2) generations after planting (cause `rule: 'wither'`, crediting the planter). Tending (`maintain`) a
  `rotten` or `withered` tile sets it back to `empty`; sowing one is refused ("Clear it first").
- **Water** (`water`, 1 s) needs a pour and a `sown` tile, and schedules that tile's ripening from the pour. Fast Track
  on it ripens it now.
- **The can** is the resource `can` (pours), capacity `canCapacity` (4). `beginTurn` empties it (step 7, `newTurn`).
- **Filling is a logged action, `fillCan`,** free and 1.5 s, but not on the hotbar: it's the prompt at a source. 021
  said filling isn't logged, but the server re-runs every turn from the log, and without fills it would see an empty
  can and reject every Water. `plotId` is `well` or `reservoir`; a pond or the sea edge has none, since the engine has
  no map, so the client checks the player faces water there. Filling never touches stored water.
- **Upkeep:** `upkeepWater` is 0. The shortfall averages only what the night asks for, so it's food alone now.
- **HUD:** food, the can's pours, stamina, hunger, the generation. No stored water, no nightfall line.

## Consequences

- **Contract (A):** `ResourceKey` gains `can`; `ActionType` gains `water` and `fillCan`; `CauseRule` gains `wither`;
  field stages gain `watered` and `withered`; config gains `canCapacity`, `witherGens`, `actionSeconds.water` and
  `.fillCan`. This covers 13's A tasks for the water action, the can, carry-over and withering, and Fast Track on a
  watered tile.
- **Stored water** still comes in (well, reservoir, digging) and goes out (planting trees, Fast Track, drought,
  stagnation), but nothing a player needs depends on it any more. C may want to give it a job back, or retire it.
- **Trusting the pond fill:** a commit could claim a pond fill anywhere. Fine for now; `commit-turn` could check the
  player's reported spot if cheating matters.
- **Art:** no frames yet for `watered` (drawn as sown soil, darkened) or `withered` (rotten stalks, greyed), no can
  icon (the water drop stands in) and no watering sound (a splash stands in).
