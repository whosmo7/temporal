# 008: Drought length and timing

**Status:** accepted (B, 2026-10-24) · **Supersedes:** the drought timing in [005](005-seeded-events.md)

## Context

[005](005-seeded-events.md) puts exactly one single-generation drought in the second half of the world (`gen > generationCount / 2`),
never in gen 1. That rule can't produce a drought in a 1-generation world, while `03` requires one in every world.
It also doesn't scale: a 30-generation world still gets only one dry generation.

## Options

1. Keep 005 and throw an error for worlds with fewer than 2 generations.
2. Allow worlds with no drought.
3. Make the drought length scale with the world and start at a random generation (chosen).

## Decision

- **Exactly one drought per world**, lasting `min(droughtMaxLength, ceil(generationCount × droughtLengthFraction))` consecutive generations.
  Proposed config values: `droughtLengthFraction: 0.1`, `droughtMaxLength: 5`. That gives 1 generation for worlds up to 10 generations,
  2 for 11–20, and so on up to 5.
- The **start is random** (seeded), anywhere from gen 2 to the last start where the whole drought still fits. The founder always gets
  one turn to prepare. A 1-generation world has its drought in gen 1.
- Good harvest and storm are unchanged from 005, except that "not the drought's generation" now means none of the drought's generations.

## Consequences

- With the default 6 generations, the drought can now land in gens 2–6 instead of 4–6. An early drought can hit before a gen-1 reservoir
  repair has paid off, and that's intended: no strategy is always right.
- `SeededEvent` has one entry per affected generation, sharing a `spellId`. `beginTurn` step 2 (A) applies `turn === n` as before.
  The replay (B, `06`) can group a spell as "drought in gens 4–5".
- `config.ts` (A, numbers by C) needs `droughtLengthFraction` and `droughtMaxLength`.
- This replaces 005's "second half, never gen 1" timing. `01` › Seeded events points here. When PR #2 (design-balance) merges,
  keep this rule in `01` and in 005 rather than the old one.
