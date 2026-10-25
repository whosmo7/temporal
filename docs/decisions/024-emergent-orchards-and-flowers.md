# 024: Orchards and flowers grow from the world's level; no Plant Orchard

**Status:** decided 2026-10-24 by the user · **Section:** `13` · **Changes:** `01` › Actions, `10` › demo moment

## Context

With world health and level ([023](023-world-health-and-level.md)), the user wanted orchards and flowers to develop from
the world's condition.

## Options

1. Plant, then health grows them.
2. **Fully emergent** (chosen): no planting; they appear with level.
3. Keep the 2-generation timer; health scales yield only.

## Decision

- **Plant Orchard is removed.** The four 1-tile trees from [019](019-per-tile-actions-take-time.md) appear as the level rises: sapling, young, fruiting at levels 1–3 (Taking root, Green, Blooming; first pass).
- **Flowers spread** with level.
- Trees are still harvested (+4 food per tree once per generation, scaled by health `[PLACEHOLDER]`).

## Consequences

- **The demo moment in `10` no longer works** as written (nobody plants the orchard). The user deferred the new one (`13` open question 1).
- Fast Track can no longer target an orchard planting.
- Decision 004 (fast-tracked orchard yield) no longer applies.
