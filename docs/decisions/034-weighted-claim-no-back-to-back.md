# 034 — The inheritance draw favours the world furthest along; never your own latest generation

**Status:** decided 2026-10-25 by the user, built by B · **Changes:** [020](020-claim-and-lock-rules.md) (repeat play:
the device's avoid hint is replaced by a server rule), `07` › `claim_world` step 4, `settings.inherit_ratio` default

## Decision

When `claim_world` has no held world to resume and no admin force-assign, it rolls once:

| Roll | Gets | Share |
|---|---|---|
| below `highest_chance` (0.5) | the open world **furthest along** (highest `current_turn`; ties at random) | 0.5 |
| below `inherit_ratio` (0.9) | **any other** open world, at random | 0.4 |
| otherwise | a **new world** | 0.1 |

- **Empty buckets fall through:** to the other inheriting bucket, then to a new world. A player always inherits when any
  world they may inherit is open, unless the roll says new.
- **No back-to-back generations:** a player is never drawn a world whose latest generation they played (`turns` row at
  `current_turn − 1` by them). They can return to it once someone else has played it. This is checked on the server, so
  it holds across devices. Resuming a held world and admin force-assign (including "Next generation here (test)") are
  exempt.
- **Both numbers are live settings:** `inherit_ratio` (now 0.9, still in the admin panel as the chance to inherit at all)
  and a new `highest_chance` column (0.5), which the admin panel doesn't show yet.

## Consequences

- Migration `20261025120000` adds `settings.highest_chance`, sets `inherit_ratio` to 0.9 and replaces `claim_world`.
  LocalBackend matches (`HIGHEST_CHANCE`, `DEFAULT_SETTINGS.inheritRatio` 0.9).
- **A:** `claim_world(avoid)` ignores `avoid` now; the signature stays for older clients, and `src/api/lastWorld.ts` can go
  once nothing sends it. The `Backend` and `Settings` types are unchanged.
- **C:** the admin panel could show `highest_chance` next to the inherit ratio.
- Players pile into the world furthest along, so worlds finish (and reach the gallery) sooner.
