---
name: inheritance-core
description: Shared ground rules for the INHERITANCE game (temporal repo). Covers locked design decisions, cross-cutting invariants, and the canonical identifiers (action types, plot kinds, visual stages, cause kinds, file layout) that every part of the codebase must use. Use this whenever you write, review or plan anything in this repo (engine, UI, backend, assets, copy, tests), even if the request is small, because a renamed ID or a broken invariant in one area silently breaks another teammate's work.
---

# INHERITANCE: core rules

Three people (A, B, C) are building this in 48 hours, each with their own Claude. This skill keeps the
pieces fitting together. The full plan is in `docs/plan/`. This file is the short version you need on
every task.

## What the game is (one paragraph)

Each player governs a small seeded farming world (Forest or Island boundary, ~32×32 tiles, Stardew-style
¾ view) for one timed turn, called a **generation**. They inherit food, water, structures and pending
effects from earlier players, act with eight actions while day turns to night, then time freezes and
they write and draw a journal page. Their cost summary shows only what they paid and gained *now*, and
a gravestone with their name joins the graveyard. Effects planted earlier mature for later players.
Once the configured number of generations is played, a public replay shows each generation's world
beside that player's page, with explanations of what caused every shortage or surplus.

## Locked decisions

Treat these as fixed. If a task seems to need one changed, stop and raise it (see
`inheritance-task-workflow`) rather than working around it. The full list is in
`docs/plan/00-decisions-and-glossary.md`.

- Resources: **food, water, stamina** (stamina is the player's energy, called "Labour" in the brief).
- **Eight actions** (canonical IDs below). Unlimited actions per turn within the time limit.
- Upkeep at end of turn. A shortfall gives the successor a **weakened start** (soft fail, never game over).
- Decay (food rots, water stagnates) plus structure wear. Seeded events only. **No borrowing. No score.**
- Pending effects are **partly hidden**: visible as growth or decay stages, never as numbers or due dates.
- No NPCs. The graveyard is the population.
- End flow: **freeze → journal → cost summary (realised only) → gravestone**.
- Async online through Supabase, one player per world (lock), abandoned turn = voided. Username + password. Repeat play allowed.
- Turn length, generation count and inherit ratio are **configurable**.
- Desktop only. React + TS + Vite + PixiJS + Zustand + Supabase + Vitest. GitHub Pages with hash routing.

## Invariants

These are the properties the demo and the brief depend on. Each one comes with the reason, so you can
apply it to cases this list doesn't cover.

1. **Determinism.** Same seed + same action log = same world, everywhere (browser, Vitest, Edge Function). The replay, the server's re-check and the demo seed script all depend on it. Randomness comes only from the seeded PRNG; time is passed in.
2. **Append-only history.** Never update or delete actions, transitions, turns, snapshots or journal pages. The replay is built from history, and "earlier pages can't be edited" is a game rule.
3. **Every transition has a cause.** A state change with no cause is a bug, because the replay could never explain it.
4. **The world doesn't explain itself during play.** Players learn about the past only from the journal and from how the world looks. See `inheritance-player-facing` for exactly what may be shown.
5. **The cost summary shows only realised outcomes.** The demo moment depends on the orchard planter's final screen showing only its cost.
6. **No moralising.** No action is labelled good or bad, and no text praises sacrifice or scolds selfishness. The brief's hardest requirement is to avoid a simplistic morality game.

## Canonical identifiers

Use these exact strings in code, data, sprite frame names and docs. Read
`references/ids.md` for the full table (plot kinds, visual stages, cause rules, event kinds, file
layout). The most-used ones:

```ts
type ResourceKey = 'food' | 'water' | 'stamina';
type ActionType =
  | 'harvest' | 'plantCrops' | 'plantOrchard' | 'repairReservoir'
  | 'digWell' | 'fishHunt' | 'maintain' | 'fastTrack';
type Biome = 'forest' | 'island';
type PlotKind = 'field' | 'orchard' | 'reservoir' | 'well' | 'wild' | 'lectern' | 'graveyard';
```

Once `src/engine/types.ts` exists, **it is the source of truth** and `references/ids.md` should be
updated to match it, not the other way round. If you need a new ID, add it to `types.ts` and
`references/ids.md` in the same PR and mention it in the PR description, because other people's
code and art are keyed on these names.

## Who owns what

`docs/plan/12-team-split.md` assigns every task. Roughly:
- **A, Engine & Backend:** `src/engine/`, `supabase/`, `src/api/`, `scripts/`, CI/deploy.
- **B, World & Gameplay:** `src/worldgen/`, `src/render/`, in-game end flow, replay viewer, play loop.
- **C, Design, Content & App Shell:** `config.ts` numbers, art/audio, journal UI, landing/auth/tutorial/gallery/admin screens, copy, demo prep.

If a change reaches into another owner's area, keep it minimal and say so in the PR, so the owner can
review it.

## Where to go next

- Starting or finishing a task: `inheritance-task-workflow`
- Engine or worldgen code: `inheritance-engine`
- Pixi/React code: `inheritance-world-ui`
- Anything players see or read: `inheritance-player-facing`
- Supabase/API: `inheritance-backend`
- Sprites/audio: `inheritance-assets`
- Numbers and tuning: `inheritance-balance`
