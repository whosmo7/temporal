# 005 — Hackathon event set: drought, good harvest, Island storm

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q4

## Context
`01` suggested an event list but left it and its timing open. `03` requires at least one drought per world.

## Options
1. Drought + good harvest + storm (Island only).
2. Drought + good harvest.
3. Drought only.

## Decision
Option 1:
- **Drought:** exactly one per world. *Timing and length superseded by [008](008-drought-length-and-timing.md): it can start any time from gen 2, and its length scales with the world.* Unless the reservoir is repaired with wear < 2: reservoir income ×0.3 and stored water −25%.
- **Good harvest:** one, outside the drought's generations. Crop yield ×1.5.
- **Storm:** Island only, 50% chance of one per world, outside the drought's generations. +1 wear on every built structure.

## Consequences
- B's seeded event list (`03`) generates these from the seed. A applies them in `beginTurn` step 2.
- Storm is the first thing to cut if time runs short. Island keeps its +2 starting water either way.
- None of them is announced. They show only through visuals (`04`/`09`) and in the replay.
