# 012: A turn is one day, 6 am to 6 am, and reading the journal stops the clock

**Status:** accepted (B, 2026-10-24) · **Settles:** `04` open question 1 · **Changes:** `04` › Day/night, art direction › Day → dusk → night

## Context

`04` mapped the turn to a day that ran from dawn at 0% to night at 95–100%, and asked whether the timer keeps running while the
journal is open. We wanted a full in-game day per generation, and reading the journal to cost no time. `00` already says
reading the journal "doesn't use game time".

## Decision

- **One generation = one in-game day, from 6 am to 6 am.** The clock runs at `24 h / turnSeconds`, so 25 s per in-game hour
  at the default 600 s. Noon is at 25%, 6 pm at 50%, midnight at 75%, and time is up at 6 am the next morning.
- **Light by hour** (`src/render/daylight.ts`): rose dawn (6–8 am), clear day (8 am–5 pm), peach dusk (5–7 pm), then plum night
  (from 9 pm until 4:30 am). At night a soft light circle around the player keeps the world playable, and the lamp-lit house
  is much less dark. Dawn returns before 6 am.
- **The HUD shows the in-game time** (`6:00 AM`, in 10-minute steps) with a sun or moon. It's a time of day, not a countdown
  and not a pending-effect number, so it's allowed during play (`inheritance-player-facing`).
- **Opening the journal stops the clock** and movement until it's closed.
- At time-up, input locks and the world dims. The end-of-turn flow (`05`) takes over from there once A's `endTurn` exists.

## Consequences

- Half of every turn is evening or night. The night light radius (3.5 tiles) is the lever if it feels too dark.
- C's copy says "Needed by **nightfall**" (upkeep reminder) and crops "rot at **nightfall**". The turn now ends at **dawn**, so
  C may want "by morning" / "by dawn".
- The art direction's "from 80% of the turn" dusk timing now follows clock hours instead.
- The house has a bed. That could answer `01` open question 1 ("end the day early?") as "sleep until morning", but that's C's call.
