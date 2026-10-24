# 017 — Gallery and replays are public

**Status:** decided 2026-10-24 by C · **Section:** `08` Q4

## Context

`08` asked whether visitors who aren't logged in can view the gallery and replays. `06` already says the
replay's audience is "anyone, through a public gallery", but the screens and routes had not settled it.

## Options

1. **Public.** Anyone can open `/#/gallery` and `/#/world/:id/replay`. Only Play needs an account.
2. **Login required.** Both routes send a logged-out visitor to `/#/auth` first.

## Decision

Option 1, the plan's recommendation. Judges and people following a shared link can watch a world without
signing up.

## Consequences

- `RequireUser` guards `/play` only. The gallery and replay screens read through the `Backend` without a session.
- `SupabaseBackend`'s gallery and replay queries (`07`) must work for the anon role, with RLS allowing reads of
  completed worlds and their turns, snapshots and journal pages.
- A logged-out visitor sees **Log in** in the header; the gallery's empty state offers Play.
