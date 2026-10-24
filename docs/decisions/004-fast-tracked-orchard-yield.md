# 004 — A fast-tracked orchard yields the same as a grown one

**Status:** decided 2026-10-24 by C (game design) · **Section:** `01` Q3

## Context
`01` asked whether a rushed (Fast Tracked) orchard should yield less long-term.

## Options
1. Reduced yield for the rest of its life.
2. No penalty. The 2× cost (50 stamina, 10 water) is the price.

## Decision
Option 2. Fast Track brings the orchard to `fruiting` now. Its yield and wear rules are unchanged.

## Consequences
- Simpler engine: no extra orchard state to track.
- Rushing costs half a turn's stamina, so it's only affordable with a good inheritance (the balance target in `inheritance-balance`).
- The replay still names who rushed it and who planted it.
