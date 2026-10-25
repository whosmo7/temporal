# 030 — Droughts are off, behind one config switch

**Status:** decided 2026-10-25 by the user, built by B · **Pauses:** [005](005-seeded-events.md) (drought in the event
set), [008](008-drought-length-and-timing.md) (one drought per world), `03` › "at least one drought"

## Decision

- **`droughts: false`** in `config.ts`. With it off:
  - **New worlds seed no drought.** The generator makes the same draws as before and leaves out only the drought
    entries, so each seed's good harvest and storm stay in the same generations.
  - **The engine ignores a drought already in an older world's list** (`eventAt` never finds one), so there's no water
    loss, no cut to reservoir income, and no drought look in `visibleView`.
- The drought rules, numbers and tests stay. Setting `droughts: true` brings them back unchanged for new worlds, and
  for older worlds that were seeded with one.

## Consequences

- **The reservoir dilemma loses its payoff:** repairing the reservoir still raises its income, but no longer protects
  against anything (`01` › Pillar 5, "Invisible protection"). C may want to look at the demo moment and the balance
  with this in mind.
- **Contract (A):** config gains `droughts`; worldgen's `EventConfig` gains an optional `droughts` (absent means on).
- The replay's drought sentence stays, for when droughts come back.
