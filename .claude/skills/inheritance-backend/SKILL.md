---
name: inheritance-backend
description: Conventions for the INHERITANCE Supabase backend and client API layer (supabase/migrations, supabase/functions/commit-turn, src/api/) in the temporal repo. Covers the schema, append-only tables and RLS, username auth via synthetic emails, the claim_world lock and weighted assignment, voided turns, the authoritative commit-turn function that re-runs the engine, admin operations, and keeping LocalBackend in step with SupabaseBackend. Use this whenever you write SQL, RLS policies, RPCs or Edge Functions, change the Backend interface, handle login, world assignment, locking, turn commit, gallery or replay queries, or debug two players getting the same world.
---

# Backend & API

The backend's job is narrow: hand each world to one player at a time, accept a finished turn only if
the engine agrees it's valid, and keep history append-only. Spec: `docs/plan/07-backend-and-multiplayer.md`.

## The `Backend` interface is the boundary

`src/api/Backend.ts` defines what the app can do: `signUp`, `signIn`, `signOut`, `claimWorld`,
`commitTurn`, `listCompletedWorlds`, `getReplay`, plus admin calls. Two implementations:

- `SupabaseBackend`: the real one.
- `LocalBackend`: localStorage, for hot-seat development and the offline demo fallback.

Change both in the same PR, and keep their behaviour the same (including lock and void rules), so the
frontend can't tell them apart. UI code imports the interface, never `supabase-js` directly.

## Schema rules

- Write each change as a new numbered migration in `supabase/migrations/`. Never edit a migration that
  has already been applied to the shared project.
- **Append-only tables:** `actions`, `transitions`, `turns`, `snapshots`, `journal_pages`. They get no
  `UPDATE` or `DELETE` policy. Mutable tables: `worlds` (lock, current_turn, status), `settings`, `profiles`.
- **RLS on for every table.** Everyone (including anonymous visitors) can read completed worlds and their history;
  writes only go through `security definer` functions. The client never inserts directly. That's how
  "earlier pages can't be edited" and "only the lock holder can commit" stay true.
- Column names are `snake_case`; map them to the engine's `camelCase` types in `src/api/mappers.ts` only.

## Auth

Supabase Auth needs an email, so `signUp(username, password)` uses `username.toLowerCase() +
'@players.temporal.local'`, with email confirmation off in the project. Store the display name in
`profiles.username` (unique, lower-cased). Show players only the username, never the synthetic email.

## Claiming a world (`claim_world` RPC)

Order matters, and it must all run in one function:
1. The caller already holds an unexpired lock → return that world (resume after refresh).
2. A world is `forced_for` the caller and unlocked → lock it and return it (admin force-assign).
3. Expire stale locks (`lock_expires_at < now()`). Those turns are voided; nothing to clean up, because nothing was written.
4. Roll once (decision 034) over the open, unlocked worlds whose latest generation the caller didn't play:
   below `settings.highest_chance` (0.5) take the one furthest along, below `settings.inherit_ratio` (0.9) any other,
   else create a world with a random seed and the default settings. An empty choice falls through to the other one,
   then to a new world. One row, `FOR UPDATE SKIP LOCKED`.
5. Set `locked_by` and `lock_expires_at = now() + turn_seconds + journal allowance + grace`.

Backing out to Home calls `release_world`, which clears the caller's own lock (decision 035).

`SKIP LOCKED` plus a single-row update is what guarantees one player per world. Don't replace it with
a read-then-write from the client.

## Committing a turn (`commit-turn` Edge Function)

1. Check that the caller holds the lock and it hasn't expired, or reject.
2. Load the latest snapshot (or `createWorld(seed)` for gen 1) and **re-run the engine** from
   `src/engine` on the submitted actions. Reject if any action is invalid or the result differs from the
   submitted summary.
3. In **one transaction**: insert actions, transitions, the snapshot, the journal page and the `turns`
   row, then advance `current_turn`, clear the lock, and mark the world `complete` once
   `current_turn > generation_count`.

The engine is imported, not copied. If Deno can't import it directly, bundle `src/engine` for the
function in a build step. Never maintain a second copy of the rules. If the Edge Function runs over
time, the plan's fallback (an RPC that trusts the client result but still only appends) is acceptable.
Record that decision (`inheritance-task-workflow`).

## Secrets and env

- Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only. The anon key is safe in the bundle because
  RLS is on.
- The service role key goes only in Supabase function secrets. Never commit it to the repo, `.env.example` or a
  `VITE_` variable.
- `.env.example` lists every variable with a placeholder value.

## Tests to run before merging

- Two clients call `claim_world` at once → different worlds (or one gets a new world).
- Claim, never commit, wait past the TTL → the same world is claimable at the same turn, with no gravestone.
- Commit → the successor sees the page, stone and state. A second commit for the same turn is rejected.
- Try `update journal_pages …` as a normal user → refused by RLS.
- `LocalBackend` passes the same scenario tests as `SupabaseBackend` (share one test suite between them where possible).

If the `security-review` skill is available, run it on PRs that change RLS, auth or Edge Functions.
