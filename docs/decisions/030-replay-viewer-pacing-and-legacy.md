# 030: Replay viewer: auto-play, timeline names and the legacy view

**Status:** decided 2026-10-25 by the user · **Settles:** `06` open question 3

## Context

C's half of the replay viewer (`06`) needed three choices the plan left open: how auto-play starts and how fast it goes,
how the timeline shows who played each generation, and whether the stretch "legacy view" is in scope.

## Options

- Auto-play: on after Begin at one pace; off until Play at one pace; **off until Play with three paces**.
- Timeline names: **under every dot**; only on hover.
- Legacy view: **in, on the ending card**; leave it out.

## Decision

- **Auto-play is off until the viewer presses Play.** Three paces: Slow 12 s, Steady 8 s, Quick 4 s per generation
  (Steady is the default). It stops at the ending card, and waits while a plot's history is open.
- **Every timeline dot has its player's name under it**, cut to 8 characters with the full name on hover.
- **The legacy view is in scope**, on the ending card under "After they left": one line per player and piece of work,
  e.g. "AL planted an orchard in Generation 1. It fed Generations 3, 4 and 5." Built from food and water gains that credit
  an earlier generation's action; gains only.
- The plot history popover lists generations **up to the one on screen**, so stepping through doesn't show what comes next.

## Consequences

- The numbers are `PACE_MS` in `src/ui/screens/replay/words.ts`; the wording is in `docs/content/replay-causes.md`.
- When orchards become emergent ([024](024-emergent-orchards-and-flowers.md)), an orchard has no planter to credit and drops
  out of the legacy view unless the engine credits the work that raised the level.
