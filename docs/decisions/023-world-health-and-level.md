# 023: World health and level, shown in the HUD

**Status:** decided 2026-10-24 by the user · **Section:** `13` · **Replaces:** "No score" in `00` › Resources & player

## Context

The user wanted orchards and flowers to grow from the general condition of the world, measured as a health score and a
level score.

## Options

Visibility: hidden and shown only through the world; **shown in the HUD** (chosen); replay only.
Form: **bar + level badge** (chosen); exact numbers; level only.
Level: **long-term growth that only rises** (chosen); a final rank; per-player progress.

## Decision

- **Health** 0–100, recomputed from: crops tended or withered, stored water and structures in repair, upkeep met or
  missed, wild stock level. Weights are `[PLACEHOLDER]` config values.
- **Level** starts at 0 and **only rises**, when health reaches a threshold `[PLACEHOLDER]`.
- The HUD shows a **health bar with no number** and **"Level N"**.
- Level thresholds unlock **orchard trees** (appear, then fruit) and **spreading flowers** ([024](024-emergent-orchards-and-flowers.md)).

## Consequences

- The locked "no score" rule and part of "the world never explains itself" no longer hold. `inheritance-core`,
  `inheritance-player-facing` and `CLAUDE.md` need updating (C).
- Every health change records causes, so the replay can show who built the world up.
- The gallery and replay can show a world's final level.
