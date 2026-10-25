# 037 — Finished worlds have a score, and the gallery sorts by it

**Status:** decided 2026-10-25 by the user, built by B · **Changes:** `inheritance-player-facing` › "No score language"
(lifted for the gallery and the replay only), `06` › Gallery (sort)

## Decision

- **A world's score** counts what happened in it, over every generation:

  | Counted | Points |
  |---|---|
  | a field tile harvested | +1 |
  | an orchard tree harvested | +3 |
  | a fish or a hunt | +2 |
  | a field tile gone rotten | −2 |
  | a sown seed that withered unwatered | −1 |

  The weights are `CONFIG.score` (C's numbers to tune).
- **It's counted from the world's history**, not kept as it goes: harvest and fishHunt actions in the action log, and
  field tiles turning `rotten` or `withered` in the change log. So worlds that finished before scoring existed get a
  score the same way. `tallyHistory()` (`src/engine/score.ts`) counts; `worldScore()` applies the weights. For the
  gallery, the server counts the same five things in `list_completed_worlds` (migration `20261025140000`) and the client
  applies the weights, so the numbers live only in config.
- **Shown only once a world has finished:** on its gallery card ("Score 12") and the replay's ending card. **Never
  during play**: not in the HUD, the cost summary, the journal or on a gravestone, so nobody plays a day to the score.
- **The gallery sorts** by Most recent (the default), Highest score or Lowest score. By score, ties go newest first.

## Consequences

- **Contract (A):** `CompletedWorld` gains `score: number | null` (null only from a backend that didn't count it); the
  engine exports `tallyHistory`, `worldScore` and `ScoreTally`; config gains `score`. No engine state, save or
  commit change.
- **C:** the gallery cards and the replay's ending card show the score; the sort is three buttons by the gallery title.
  The words ("Score", "Most recent", "Highest score", "Lowest score") are B's draft for C to review.
- The voice rule's "no points" still holds everywhere before a world ends.
