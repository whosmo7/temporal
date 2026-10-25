# 029 — You eat at the oven, one food a meal; Harvest and eat is gone

**Status:** decided 2026-10-25 by the user, built by B · **Changes:** [003](003-eating-via-harvest.md) and
[016](016-hunger.md) (where eating happens), [025](025-oven-cooks-stored-food.md) (how the oven works) ·
**Settles:** `13` › Open question 5 (oven: interaction or ninth action)

## Context

Eating was a free variant of Harvest ("Harvest and eat", Q), and 025 added "Cook and eat" at the oven without
saying how it's recorded. The user wanted one way to eat: go into the house and use the kitchen.

## Options for recording a meal

- **One logged `eat` action per meal (chosen).** The server re-runs the turn from the action log, so a meal it
  can't see would leave its food and hunger out of step with the player's. A logged action keeps the save format,
  the server re-run and `replay()` unchanged, and the replay can say who ate.
- **A meal count sent with the save**, worked out from the food at the start and end of the day. It carries the same
  information, but needs a new field in the save, the turns table, the commit-turn function and `replay()`.

## Decision

- **Only the oven feeds you.** Facing the oven inside the house, the prompt is "E · Cook and eat". The cabinet stays
  the food store you can see.
- **A meal is a logged action, `eat`**, with no plot. It takes `mealFood` (1) from the store and adds
  `hungerPerFoodEaten` (10) to hunger, up to `hungerMax`. It's free and takes `actionSeconds.eat` (0.5 s).
- **Allowed when full:** the food is eaten and hunger stays at full. With an empty store it's refused: "The store is
  empty".
- **Harvest and eat is gone:** Q does nothing, and every harvest goes to the store. The engine still accepts
  `harvest` with `eat: true`, so logs saved before this re-run the same, but nothing offers it.

## Consequences

- **Contract (A):** `ActionType` gains `eat`; config gains `mealFood` and `actionSeconds.eat`. `harvestEatCost` and the
  `eat` flag stay, for old logs only. The summary's `foodEaten` now counts meals.
- **Database:** migration `20261025110000` widens the `actions.type` check to allow `water`, `fillCan` and `eat`. The
  first two were missing since 027, so a live turn that watered or filled the can was refused on commit.
- **Store (B):** `facingWater` became `facing: 'water' | 'oven' | null`, from `facedSpot()` in `src/render/interact.ts`.
- **HUD (C):** `ovenOptions()` in `actionOptions.ts`; the Q rows and `promptLabel`'s `eat` argument are gone. Eating uses
  the food icon and, for now, the harvest sound.
- **Balance (C):** every meal is now a trip home. The planter strategy eats at the oven when hungry.
