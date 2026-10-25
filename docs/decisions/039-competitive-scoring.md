# 039: Competitive scoring, locked as each generation ends

**Status:** decided 2026-10-25 by the user, experimental (branch `experiment/sandbox`) · **Section:** `01`, `02`, `06` ·
**Changes:** "No score language" in `inheritance-player-facing` (the replay's ending card and the Scores page) ·
**Sits beside:** [037](037-world-score-and-leaderboard.md), the world score

## Context

The user wanted the game to work like a society: players compete for the highest personal score, but they share one
world. Taking too much from it leaves later players worse off. Productive, sustainable play has to be able to win,
and selfish extraction has to be a real choice with real costs, neither always best nor always punished beyond its
benefit.

**Not the world score.** [037](037-world-score-and-leaderboard.md) scores a whole finished world from its history, for
the gallery. This decision scores each *player's* generation, so they can compete. The two use separate config
(`CONFIG.score` for 037, `CONFIG.playerScore` here) and both live in `src/engine/score.ts`. First numbered 033 on the
experiment branch; renumbered to 039 when `main` took 033–038.

## Options

Selfish lever: **a new `take` action at the oven** (chosen); existing actions only (overhunting, hurrying others'
work).
Visibility: **replay and its ending card only** (chosen; rule 4 and the realised-only cost summary still hold); also
on the cost summary.

## Decision

`generationScore = productive + extraction − corruption + exitBonus`, with every weight in `CONFIG.playerScore`.

- **Productive:** food harvested from fields and trees, and food caught while the wild spot stays at or above
  `wildFloor`.
- **Extraction:** food kept with `take` (`takePerFood` each), and food caught that takes the wild spot below
  `wildFloor`. Food harvested and then kept is moved from productive to extraction, so no unit is counted twice.
- **Corruption:** `corruptionLinear × u + corruptionQuadratic × u²`, where `u` is the units taken plus the units
  overhunted. A little extraction can pay; a lot doesn't.
- **Exit bonus:** `exitBonusPerCondition × condition`. The condition is worked out by `worldCondition`, 0–100, from the
  state that generation hands over, **after its own night's upkeep**:
  - stored food, counted up to `foodReserveNights` nights of upkeep;
  - stored water, counted up to `waterReserveCap`;
  - reservoir and well (broken counts 0, worn counts half);
  - orchard trees (growing trees count `growingTree`);
  - field tiles that aren't rotten or withered;
  - wild stock against its cap.

  The weighted mean is then scaled by `1 − weakenedPenalty × shortfall`.
- **Locking:** `endTurn` appends the generation's score to `state.scores` and records a transition with cause
  `assessed`. Later generations append their own; nothing changes an earlier entry. Generation 6 is assessed the same
  way, so emptying the store at the end costs its own exit bonus.
- **Visibility:** scores appear only on the replay's ending card ("What each one left with"), the admin panel's
  **Player scores** and the **Scores page**
  (`/scores`). The home screen shows a Scores button once someone signs in. The page lists that player's own
  generations, then the ten highest, and draws only on finished worlds, so it never reveals a world still being played.
  During play, and on the cost summary, nothing shows a score; the cost summary lists "Kept for yourself" only as a
  realised row.

## Balance check (`npx tsx scripts/score-sim.ts`, seed 1)

- A world of planters scores the most overall. Planters in generations 3–6 post the highest single scores (≈115).
- A hoarder or repair-first founder outscores a planter founder (≈ +20 to +30): investing still costs the person who
  makes the investment.
- A looter in a planter world never comes out ahead of the planter it replaced, except roughly breaking even in
  generation 2. It costs later players 60–195 in total, so harming a rival can still improve the looter's relative
  standing.
- Skimming only the surplus beyond the reserve pays a little (+3 to +9) in later generations.

## Consequences

- **Contract (A):** `ActionType` gains `take`; `CauseRule` gains `assessed`; `TransitionTarget.world` gains `score`.
  `TurnTally` gains `productiveFood`, `overhuntFood` and `foodTaken`. `WorldState` gains an optional `scores`, which is
  absent in states saved earlier. Migration `20261025150000_action_type_take.sql` allows `take` in the action log.
- **Copy (C):** the oven offers "Keep some for yourself" on T. The replay's standings use plain labels (Grown and
  gathered, Kept, Cost of keeping, The world they left, In all), and nothing names an action good or bad.
- All the numbers are first-pass and need C's tuning with `scripts/score-sim.ts`.
