# 020: Claim and lock rules: avoid-last-world hint, random only, seeded names, heartbeat

**Status:** accepted (A, 2026-10-24; numbered 016 in the comments of migration `20261024200000`; renumbered twice because `016-hunger` and `019-per-tile-actions-take-time` took those numbers) · **Settles:** `07` open questions 3, 4 and 6, and the `heartbeat` task · **Changes:** `07` › Server operations, `src/api/Backend.ts`

> **Repeat play replaced by [034](034-weighted-claim-no-back-to-back.md):** the server never draws you a world whose latest generation you played; the `avoid` hint is ignored.

## Context

`claim_world` couldn't be built without answers to three `07` open questions: can a player be handed the world they just
played, can they choose a new world, and where do world names come from. Decision 012 also made reading the journal stop
the clock, so a fixed lock TTL (`turn_seconds + journal_allowance + grace`, decision 007) can run out while a player is
still legitimately reading.

## Decision

- **Repeat play (Q3): a client-side hint, not a server rule.** The device remembers the world each player last committed
  (`localStorage`, `src/api/lastWorld.ts`) and passes it to `claim_world(avoid)`. The server skips that world when it picks
  one to inherit. It doesn't check turn history, so another device or cleared storage can hand the same world back, which
  is fine because repeat play is allowed. If the avoided world is the only open one, the player gets a new world.
- **Choosing a new world (Q4): no.** Assignment is always the weighted random draw. `claim_world` takes no preference.
- **World names (Q6): `worldName(seed, biome)`** in `src/worldgen/names.ts`, two seeded word lists (e.g. "Hollow Elm").
  The client computes it; `worlds.name` stays null. Both backends show the same name for the same seed.
- **Heartbeat: needed.** While the clock is stopped (journal open, end-of-turn flow) the client calls `heartbeat(world)`
  about once a minute. Each call extends the lock to `now + lock_grace_seconds`, never past
  `locked_at + full TTL + heartbeat_cap_seconds` (default 900 s). It returns null once the lock is gone (turn voided).
- **Admin can create a world from a seed** (`admin_create_world`, `createSeededWorld`), so the demo world is made through
  the same claim → commit path as real play.

## Consequences

- New columns: `worlds.locked_at`, `settings.heartbeat_cap_seconds`, `transitions.seq`. Transition and action keys are
  now `(world_id, id)`, because engine ids repeat across worlds.
- The end-of-turn flow (`05`) must call `backend.heartbeat` while the clock is stopped, or a long read can void the turn.
- `Backend` gained `heartbeat`, `listAllWorlds`, `setSettings`, `setWorld`, `completeWorld`, `createSeededWorld`;
  `ClaimedWorld`, `CompletedWorld` and `Replay` gained `name`; `Profile` gained `isAdmin`.
