# 022: Seeds are a shared stock carried between generations

**Status:** decided 2026-10-24 by the user · **Section:** `13`

## Context

With per-tile planting ([021](021-per-tile-farming-and-watering.md)), the user wanted seeds to matter.

## Options

1. Unlimited seeds.
2. Seeds from harvest only, reset each turn.
3. A shared seed stock, inherited like food (chosen).

## Decision

- `seeds` is a carried resource. The founder starts with `[PLACEHOLDER 6]`.
- Planting a tile costs 1 seed. Harvesting a tile gives some back `[PLACEHOLDER 1–2]`. The user noted these may change.
- With no seeds you can't plant.

## Consequences

- A player who plants everything and doesn't harvest leaves the next player short: another thing to inherit.
- **Contract change (A):** `ResourceKey` gains `seeds`. The HUD toolbar (C) shows the count.
