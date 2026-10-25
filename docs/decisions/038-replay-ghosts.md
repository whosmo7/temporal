# 038 — Ghosts in the replay: each generation's player replays their day

**Status:** decided 2026-10-25 by the user (A), built by A · **Changes:** `06` › Replay viewer ·
**Builds on:** [019](019-per-tile-actions-take-time.md) (actions take time), [031](031-replay-viewer-pacing-and-legacy.md) (auto-play pace)

## Context

The game is about time: what a generation does lands on the ones after it. The replay shows each generation as a still map
with the changed tiles glowing, the journal page and the cause sentences. It doesn't show the day being lived. The user
picked "time-lapse with ghosts" from a list of time-themed ideas.

## Decision

- **In the replay only**, a faint blue figure of that generation's player goes about their day on the map: it walks to each
  place they worked, works there for as long as the action took, and moves on. The day plays on a loop, fading out before it
  starts again. During play there are no ghosts, because they would show a successor what earlier players did, which the
  rules keep for the replay.
- **Built from the action log, with no new data.** Nothing records where people walked, only where and when they acted, so a
  ghost walks in a straight line at the player's walking pace and arrives in time for each action to finish when the log
  says it did. Ghosts glide through walls and water. Eating happens at the oven; an action with no place (filling the can at
  a pond, Fast Track on an effect with no plot) is worked where the ghost stands. Actions are taken in time order, so a log
  whose `seq` order and clock disagree (B's scripted bench world) still plays correctly.
- **Pace:** a day takes 12 s when the viewer steps by hand. While the replay auto-plays, the day fits the time each
  generation is on screen (Steady: 8 s per generation, so the day takes 6.5 s plus the fade).
- **A "Ghosts" button** beside the pace buttons turns them on and off (on by default). Viewers who prefer reduced motion get no
  ghost.
- The map behind the ghost is the end of that generation, as before, so a ghost may sow a tile that already shows ripe.
  Accepted: showing the world change through the day would need a snapshot per action.

## Consequences

- `src/ui/replay/ghosts.ts` (pure `ghostDay`, tested), `WorldView.setGhost(track, realSeconds)` in `src/render/world-view.ts`,
  `ReplayWorld` props `ghosts` and `ghostSeconds`, and the toggle in C's `Timeline`. Constants `GHOST_*` in
  `src/render/constants.ts`.
- No contract, schema or engine changes.
- **B / C:** `ReplayWorld` and the `Timeline` changed. Keep the `ghosts` and `ghostSeconds` props when editing them.
