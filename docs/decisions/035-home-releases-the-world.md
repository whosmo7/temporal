# 035 — Backing out to Home gives the world back; the next Play is a fresh draw

**Status:** decided 2026-10-25 by the user, built by B · **Changes:** [018](018-commit-on-seal-refresh-restarts.md)
(refresh resumes the held world: still true, but Home no longer does), `07` › Server operations

## Context

Pressing Play locks a world for the player. Home (on the "You are inheriting…" card, or mid-day after "Leave this day?")
left the lock in place, so the next Play resumed the same world, and nobody else could have it for about 9 minutes.

## Decision

- **Home releases the world.** `backend.releaseWorld(worldId)` (RPC `release_world`) clears the caller's lock. The day
  is voided as an abandoned one is: nothing was written, no stone.
- **The next Play is a plain fresh draw** ([034](034-weighted-claim-no-back-to-back.md)). It may land on the same world
  again by chance; the world left isn't skipped.
- Home waits for the release before leaving, so a quick Play can't resume the world and then lose it. If the release
  fails, the lock runs out on its own, as before.
- **Unchanged:** a refresh, a closed tab or the browser's back button still keep the lock ([018](018-commit-on-seal-refresh-restarts.md)),
  so a refresh restarts the same day.

## Consequences

- **Contract (A):** `Backend` gains `releaseWorld`; migration `20261025130000` adds `release_world(world)` (a no-op for a
  world the caller doesn't hold). LocalBackend matches.
- Players can now re-roll by backing out, which `07`'s "no choosing a world" rule didn't allow before.
