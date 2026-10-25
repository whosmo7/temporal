# 028 — Two-minute days, one-minute crops, and crops that carry over until they've stood ripe a whole day

**Status:** decided 2026-10-25 by B, at the user's request · **Changes:** [007](007-turn-and-generation-defaults.md)
(turn length), [027](027-watering-can-tilling-food-only-nights.md) (what rots at the end of a day), `01` › Config
values, `13` › Tile lifecycle

## Context

Playtests ran long. The user asked for a two-minute day and for crops to take a minute from watering, and for rot to
hit only a crop that has stood ripe for a whole generation, not one that ripened late in the day.

## Decision

- **A day lasts 120 s** (`turnSeconds`, was 600). New worlds get it: the engine and LocalBackend defaults, and the live
  `settings` default (migration `20261025100000`). Worlds already made keep their own turn length.
- **A watered tile ripens 60 s later** (`cropRipenSeconds`, replacing `cropRipenPct`, which was 25% of the day).
- **End of the day, per field tile:**
  - **Ripe since today:** left ripe for the next player.
  - **Ripe since an earlier generation** (it was ripe when this one began and nobody picked it): **rots**. So a crop
    rots only after standing ripe from the start to the end of a generation. `PlotState.ripeSince` records the
    generation it ripened in.
  - **Still growing:** it grows on overnight, in **half its remaining time** (`overnightGrowth` 0.5). Its ripening
    effect is closed (cause `rule: 'overnight'`) and a new one, from the same watering, is due that much into the next
    day. 20 s short at dusk means ripe 10 s into the next day.
  - **Sown but dry:** waits, then withers, as in 027.

## Consequences

- **Contract (A):** config gains `cropRipenSeconds` and `overnightGrowth` (`cropRipenPct` is gone); `CauseRule` gains
  `overnight`; `PlotState` gains `ripeSince?`. The carried-over effect's id is the old one plus `:<next turn>`.
- Nothing rots on the day it's planted any more, so the cost summary's "patches rotted" line now comes from the
  generation before.
- The lock TTL shrinks with the day (120 s + the journal allowance + grace), so the heartbeat matters more for long
  reads.
- Balance (C): two-minute days fit about a dozen tile actions plus can trips. The simulate strategies use the new
  timings.
