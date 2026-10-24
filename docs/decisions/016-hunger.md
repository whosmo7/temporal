# 016: Hunger, carried between generations; eating is free and refills it

**Status:** accepted (B, 2026-10-24, at the user's request) · **Changes:** [003](003-eating-via-harvest.md) (what eating restores
and costs), `01` › Resources, `02` › Between-generation order, `04` › HUD

## Context

Wiring the hotbar raised how "Harvest and eat" should work. Under 003 it cost the usual 5 stamina and turned the fresh yield
into stamina. The team wanted eating to be its own need instead: a hunger meter the family inherits, which slows you down if
nobody has eaten.

## Decision

- **New resource `hunger`**, 0 to `hungerMax` (100). The founder starts full. It **carries between generations**.
- **At the start of each generation** (from gen 2, like the other decay) hunger drops by `hungerDropPerGen` (30). It's part of
  step 4 of `beginTurn` ("food rot, water stagnation, hunger"), with the cause `rule: 'hunger'`.
- **At or below `hungerSlowAt` (0) the player walks slower** (`hungrySpeedMult`, 0.6×). `visibleView` gives a `hungry` flag.
- **Harvest and eat is free** (`harvestEatCost: 0`) and the eaten food refills **hunger**, not stamina: `hungerPerFoodEaten` (10)
  per food, up to full. What can't be eaten goes to the store, as in 003. It's refused when hunger is full ("You're not
  hungry"), so it can't be used as a free harvest.
- Key: **Q** next to E, at anything ripe. The prompt reads "Q · Harvest and eat" with no cost.
- All five numbers are in `config.ts`.

## Consequences

- **Contract changes (A):** `ResourceKey` gains `hunger`, `CauseRule` gains `hunger`, `VisibleWorld` gains `hungry`,
  `FounderConfig` gains `hungerMax`. `staminaPerFoodEaten` is gone: stamina no longer rises mid-turn.
- With the defaults nobody needs to eat until gen 5 (100 → 70 → 40 → 10 → 0). Eating an orchard harvest while hungry stores
  only the leftover, for free, once per generation. C may want to tune both (`inheritance-balance`); the simulate strategies
  don't track hunger yet.
- The HUD shows a hunger bar next to stamina. Hunger is a current, realised value, so showing it is allowed.
- The replay can explain hunger: the drop is a rule, eating is the player's action.
