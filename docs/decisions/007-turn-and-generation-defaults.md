# 007 — Defaults: 10-minute turns, 6 generations

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q6

> **Turn length replaced by [028](028-two-minute-days-crops-carry-over.md):** a day is now 2 minutes (120 s). The 6 generations stand.

## Context
`turnSeconds` and `generationCount` are configurable per world. The game designer sets the defaults.

## Options considered
120 s / 6 gens (recommended in discussion), 90 s / 5 gens, 180 s / 8 gens, and 10 minutes.

## Decision
- `turnSeconds` = **600** (10 minutes).
- `generationCount` = **6**. This one is an assumption: no count was given with the 10-minute choice, so it uses the recommended value. Revisit if needed.

## Consequences
- Crop ripening is a fraction of the turn (25%, so 150 s), which keeps about 3 crop cycles per field.
- With 100 stamina, most players will run out well before nightfall. This is raised as a new open question in `01` (end the day early?).
- `07`'s lock TTL is `turn_seconds + journal_allowance + grace`, so an abandoned world stays locked for 10+ minutes.
- 6 gens lets an orchard planted in gen 1 fruit for gens 3–6, and gives a 1-generation drought somewhere in gens 2–6 (decision 008).
- The demo world sets its own shorter values (`10`).
