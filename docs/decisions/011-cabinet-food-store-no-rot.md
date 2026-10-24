# 011: The cabinet is the food store, and stored food doesn't rot (for now)

**Status:** accepted (B, 2026-10-24) · **Changes:** `01` › Decay (`foodRotPct` 0.3 → 0) · **Needs:** C to re-check balance

## Context

The player's house (decision [010](010-player-house.md)) has a cabinet. The plan already had a "food store" sprite
(`store/full|half|empty|rotting`, `ids.md`) with no in-world home. We wanted the cabinet to be that store, and stored food
not to rot for now.

## Decision

- **The cabinet is the food store.** It shows the world's stored food with the existing `store/<stage>` frames. It isn't
  a ninth action or a new plot: it's furniture whose look comes from `visibleView()`.
- **Stored food doesn't rot:** `foodRotPct: 0`. It stays a config value (C's numbers) and isn't removed from the engine,
  so rot can come back by changing one number.
- Unharvested crops still rot in the field at the end of the turn. That's a separate rule (`01` › Plant Crops).

## Consequences

- Decay is now water stagnation and structure wear only. Food carries over in full, which makes hoarding stronger. C should
  re-run the balance check (`scripts/simulate.ts`, the hoarder fixture) once it exists, and may want to pull another lever
  (starter food, upkeep) to keep the reservoir dilemma.
- The `rotting` store stage won't show while `foodRotPct` is 0. Keep the frame for when rot returns.
- A's engine reads `foodRotPct` as before. No code change needed beyond the number.
