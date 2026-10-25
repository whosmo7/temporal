# 026: Lift the "no due dates, yields or causes during play" rule

**Status:** decided 2026-10-24 by the user · **Replaces:** `CLAUDE.md` rule 4, `00` › "What successors learn", `inheritance-player-facing`

## Context

The plan said that during play the world never explains itself: no numbers or due dates for pending effects, and no causes.
Only the replay explained. While reworking the mechanics, the user chose to drop this rule.

## Decision

The rule is lifted. The game may show due dates, future yields or causes during play.

## Consequences

- **What** to show is still open (`13` open question 2). Until it's answered, build nothing new that reveals pending
  effects or causes, beyond the health bar and level from [023](023-world-health-and-level.md).
- `CLAUDE.md` rule 4, `inheritance-core` and `inheritance-player-facing` must be updated (C, `13`).
- The demo moment's "cost-only summary" reveal relies on the old rule. Settle it with `13` open question 1.
