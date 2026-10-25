# 003 — Eating mid-turn, as an option on Harvest

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q2 · **Partly replaced by [016](016-hunger.md):** eating is now free and refills hunger instead of stamina

> **Eating replaced by [029](029-eat-at-the-oven.md):** you eat only at the oven, one food a meal, and Harvest and eat is gone.

## Context
`01` asked whether a player can eat mid-turn to restore stamina. The game is locked at eight actions.

## Options
1. No eating.
2. A separate Eat action (a ninth action, which breaks the locked decision).
3. Eating as a variant of Harvest.

## Decision
Option 3. Harvest gets a **Harvest and eat** variant:
- The fresh yield converts to stamina at 2 per food (`staminaPerFoodEaten`), up to full stamina (`baseStamina`). The rest goes to the store.
- Only the food just harvested can be eaten. Stored food and Fish/Hunt catches can't.

## Consequences
- Still eight action types. `ActionEntry` gains an optional `eat?: boolean` (harvest only). **Contract change** for `02` `types.ts` (A).
- Crops never make stamina (13 stamina per cycle, 10 back when eaten). An inherited fruiting orchard can give up to +25 net stamina once per generation, at the cost of 15 food for the next player. That's a new "eat now vs leave food" tension.
- A weakened player can recover by eating, which costs food.
- The HUD stamina bar can go up mid-turn (`04`). The hotbar shows both Harvest variants. The cost summary lists "You ate N🍎" (`05`).
- The replay explains eaten food with an `action` cause.
