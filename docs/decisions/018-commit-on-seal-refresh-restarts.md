# 018 — The turn is saved on "Seal page"; a refresh mid-turn starts the turn over

**Status:** decided 2026-10-24 by B, at the user's request · **Settles:** `05` Q2, `08` Q3 · **Changes:** `05` ›
End-of-turn flow, `08` › Play flow

## Context

Wiring the play flow to the `Backend` (`05` hand-off, `08` play flow) needed two answers the plan left open:

- `05` Q2: which step commits the turn, "Seal page" or the end of the gravestone animation?
- `08` Q3: if the player refreshes while holding a world, do they resume with the time they had left, or is the turn
  voided?

## Options

**When to commit**

1. **On "Seal page".** The cost summary and the stone are for show, so closing the tab after sealing keeps the turn.
2. **After the stone rises.** Closing the tab during the summary or the stone loses the turn.

**Refresh mid-turn**

1. **Resume:** keep this turn's actions and clock locally and replay them on reload.
2. **Restart the same turn:** the same world, back at 6 am with the full day and nothing done.
3. **Void:** release the lock and claim again, maybe getting a different world. The `Backend` has no release call.

## Decision

- **Commit on "Seal page"** (option 1). The engine ends the turn, the commit starts, and the cost summary and stone run
  while it saves. "Generation N is over." waits for the save. If the save fails, the card says so and offers
  **Try again**.
- **A sealed turn is kept in localStorage** (`inheritance.unsaved`) until the backend has it. On the next Play it's
  sent first. If that fails too, the player can try again or let it go.
- **A refresh restarts the same turn** (option 2). `claimWorld` already hands a player back the world they hold, so
  the client starts it again from the last snapshot at 6 am. Nothing from the lost attempt is kept.

## Consequences

- A refresh buys a fresh day, but only within the lock: the lock still runs from the first claim, so a late restart
  can run out of lock before the seal ("Your turn has expired"). **For A:** `claim_world` could extend the lock when
  it hands back a held world, with a cap so nobody holds a world forever.
- Commits aren't idempotent. If a commit lands but the reply is lost, resending the local copy fails ("Your turn has
  expired"), and the player is offered to let it go. Harmless now; worth a check in `commit-turn` (`07`).
- The dev sandbox (`#/play?seed=…`) saves nothing and keeps its own Continue to the next generation.
