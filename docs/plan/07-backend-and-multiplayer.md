# 07 — Backend & Async Multiplayer (Supabase)

**Owner:** Engine/backend dev  
**Depends on:** `02` (engine runs server-side), `11` (Supabase project).
**Consumed by:** `05` (commit), `06` (gallery/replay), `08` (auth, admin).

## Decisions (locked)

- **Supabase** (Postgres + Auth + Edge Functions), with the frontend static on **GitHub Pages**.
- **Async online**: each generation can be played by anyone, on their own device.
- **Random assignment, weighted** between inheriting an existing world and creating a new one. The **ratio is configurable**.
- **One player per world at a time** (exclusive lock).
- **Abandon mid-turn = turn voided**: the lock expires, nothing is committed, no gravestone.
- **Username + password** auth. Security isn't the focus.
- **Repeat play allowed.**
- **Append-only** action log.

## Project

- Supabase org **Temporal**, project ref `nswzjqylyuwhydyyqsmq`, region `eu-west-1`. API URL `https://nswzjqylyuwhydyyqsmq.supabase.co`.
- The repo is linked: `supabase/config.toml` holds the auth settings (email confirmation **off**, site URL = the GitHub Pages URL). Change them there and run `npx supabase config diff` then `npx supabase config push`.
- The CLI is a dev dependency (`npx supabase …`). Run `npx supabase login` once per machine. Ask C for an invite to the Supabase org.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are in the GitHub Actions secrets. For local dev, copy `.env.example` to `.env.local`.

## Auth: username + password on Supabase

**Built** (`supabase/migrations/20261024170000_schema_rls_auth.sql`): the client calls
`supabase.auth.signUp({ email: \`${username}@players.temporal.local\`, password, options: { data: { username } } })`.
A trigger creates the `profiles` row. Usernames must match `^[a-z0-9_]{3,20}$`. To make someone an admin, run
`npx supabase db query --linked "update profiles set is_admin = true where username = '<name>'"`.

Supabase Auth is email-based. Use **synthetic emails**: `username@players.temporal.local`, with
**email confirmation turned off** in the project settings. Store the display username in `profiles`.
Usernames must be unique (lower-cased).

## Schema (sketch)

```sql
profiles (
  id uuid pk references auth.users,
  username text unique not null,
  is_admin boolean default false,
  created_at timestamptz default now()
)

settings (                          -- single row, admin-editable
  id int pk default 1,
  inherit_ratio numeric default 0.7,  -- [PLACEHOLDER] P(inherit) when an unlocked world exists
  default_turn_seconds int,           -- game designer decides
  default_generation_count int
)

worlds (
  id uuid pk,
  name text,                         -- generated from seed, e.g. "Hollow Elm"
  seed bigint not null,
  biome text check (biome in ('forest','island')),
  turn_seconds int not null,
  generation_count int not null,
  current_turn int not null default 1, -- next generation to be played
  status text check (status in ('open','complete')) default 'open',
  locked_by uuid null references profiles,
  lock_expires_at timestamptz null,
  forced_for uuid null references profiles,   -- admin force-assign
  created_at timestamptz default now(),
  completed_at timestamptz null
)

turns (                            -- one row per COMMITTED generation (append-only)
  id uuid pk,
  world_id uuid references worlds,
  turn int not null,
  player_id uuid references profiles,
  committed_at timestamptz default now(),
  unique (world_id, turn)
)

actions (                          -- append-only action log
  id text pk,                      -- engine id / ulid
  world_id uuid, turn int,
  actor_id uuid,
  type text, plot_id text null, target_effect_id text null,
  committed_turn int, committed_t real,
  due_turn int, due_t real null,
  seq int                          -- order within turn
)

transitions (                      -- causal records (append-only)
  id text pk, world_id uuid, turn int, t real null,
  target jsonb, before jsonb, after jsonb, delta real null,
  causes jsonb not null
)

snapshots (                        -- state at end of each gen (fast replay/gallery)
  world_id uuid, turn int, state jsonb, primary key (world_id, turn)
)

journal_pages (                    -- one per committed turn, never updated
  world_id uuid, turn int, author_id uuid,
  text text, drawing jsonb,        -- strokes JSON (see 05)
  created_at timestamptz default now(),
  primary key (world_id, turn)
)
```

Gravestones are derived from `turns` + `profiles.username` (no separate table needed).

### Row-level security

- `SELECT` for everyone (including anon) on worlds, turns, journal_pages, snapshots, actions and transitions **of completed worlds**. For open worlds, only the lock holder can read the full state (open question: is that worth enforcing?).
- **No `UPDATE`/`DELETE`** policies on `actions`, `transitions`, `turns`, `journal_pages`, `snapshots` (append-only, read-only pages).
- All writes go through **RPC / Edge Function** with `security definer`. Clients never insert directly.

## Server operations

### `claim_world()` (Postgres RPC, `security definer`)

```
1. If the caller holds an unexpired lock → return that world (resume after refresh).
2. If any world has forced_for = caller and is unlocked → lock and return it (admin force-assign).
3. Expire stale locks: lock_expires_at < now() → clear (turn voided).
4. With probability settings.inherit_ratio, pick a random OPEN, UNLOCKED world
   (SELECT … FOR UPDATE SKIP LOCKED ORDER BY random() LIMIT 1).
   If none / coin says "new" → create a world with a random seed + biome + defaults.
5. Set locked_by = caller, lock_expires_at = now() + turn_seconds + journal_allowance + grace.
6. Return world + latest snapshot (or null for gen 1) + journal pages + gravestones.
```

`SKIP LOCKED` + the single-row update guarantees **only one player per world**.

### `heartbeat(world_id)`

Needed, because reading the journal stops the clock (012). The client calls it about once a minute
while the clock is stopped. Each call extends the lock to `now + lock_grace_seconds`, never past
`locked_at + TTL + heartbeat_cap_seconds`. Returns null once the turn is voided ([016](../decisions/016-claim-and-lock-rules.md)).

### `commit-turn` (Edge Function, recommended; see `02` Authority)

```
input: world_id, actions[], journal { text, drawing }
1. Verify caller holds the lock and it hasn't expired.
2. Load latest snapshot (or createWorld(seed) for gen 1).
3. engine.beginTurn → apply each action in seq order (validate) → endTurn.
   Reject if any action is invalid.
4. In one transaction:
   insert actions, transitions, snapshot(turn), journal_page, turns row;
   worlds.current_turn += 1; clear lock;
   if current_turn > generation_count → status = 'complete', completed_at = now().
5. Return ok + summary.
```

**Turn voided** happens naturally: if the client never calls `commit-turn` before the lock expires,
nothing was ever written.

> Fallback if the Edge Function is too slow to build: a `commit_turn` RPC that accepts client-computed
> transitions + snapshot and does steps 1 and 4 only.

## Client data layer

- `src/api/` wraps `supabase-js`: `signUp`, `signIn`, `claimWorld`, `commitTurn`, `listCompletedWorlds`, `getReplay(worldId)`, admin calls.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the anon key is safe in a static bundle when RLS is on).
- **Offline/hot-seat mode** (build first, and keep as a demo fallback): the same interface, backed by `localStorage`, so the game can be developed before the backend exists.

## Tasks

- [x] **[A]** Create the Supabase project. Turn email confirmation off. Add the env vars to the repo secrets + `.env.example`. *(Done by C, see **Project** above.)*
- [x] **[A]** SQL migrations for the schema above (`supabase/migrations/`) *(C. Additions to the sketch: `worlds.preset`, `actions.eat`, and `settings.journal_allowance_seconds` + `lock_grace_seconds` for the lock TTL.)*
- [x] **[A]** RLS policies (read-public for completed worlds, no update/delete) *(C. History is readable when the world is complete, by the current lock holder, or by an admin. There are no write policies at all.)*
- [x] **[A]** Username signup/login with synthetic emails + `profiles` insert trigger *(C. Tested live: `.local` emails are accepted. Also adds the `username_available(name)` RPC. The `supabase-js` wrapper goes in `SupabaseBackend` once A's `Backend` interface exists.)*
- [x] **[A]** `claim_world` RPC with weighted assignment, `SKIP LOCKED`, stale-lock expiry, force-assign *(`supabase/migrations/20261024200000_claim_commit_admin.sql`. Takes an `avoid` hint ([016](../decisions/016-claim-and-lock-rules.md)).)*
- [x] **[A]** `commit-turn` Edge Function importing the engine (check that Deno can import the TS engine package; bundle if needed) *(Deno can't resolve the engine's extensionless imports, so `npm run functions:bundle` bundles `src/api/runTurn.ts` with esbuild into `supabase/functions/_shared/engine.js` (gitignored). `npm run functions:deploy` bundles and deploys. The write is `commit_turn_write`, callable by the service role only.)*
- [x] **[A]** `heartbeat` RPC (if needed) *(Needed: the journal stops the clock (012). Capped by `settings.heartbeat_cap_seconds`, [016](../decisions/016-claim-and-lock-rules.md).)*
- [x] **[A]** Admin RPCs: set `settings`, set a world's `turn_seconds`/`generation_count`, force-assign, mark complete (skip to replay) *(Also `admin_list_worlds` and `admin_create_world` (a world from a chosen seed, for the demo).)*
- [x] **[A]** Gallery + replay read queries *(`list_completed_worlds()` and `get_replay(world)`, security invoker so RLS decides.)*
- [x] **[A]** `LocalBackend` implementation of the same interface (hot-seat) *(Same claim order, TTL, heartbeat cap and void rules; scenario tests in `src/api/__tests__/LocalBackend.test.ts`.)*
- [x] **[A]** Concurrency test: 2 clients call `claim_world` at once → different worlds *(`scripts/test-backend.ts`, passed live 2026-10-24 along with commit → successor, gallery/replay and RLS checks.)*
- [x] **[A]** Abandon test: claim, never commit, wait past the TTL → world is claimable again at the same turn, no gravestone *(`scripts/test-backend.ts` shortens the TTL for the run; also covered on LocalBackend.)*
- [x] **[A]** Seed script for the demo world (`10`) *(`scripts/seed-demo.ts`, see `10`.)*

## Acceptance

- Two browsers on two machines: A finishes Gen 1, B is assigned the same world (with inheritance forced) and sees A's page, stone and world state.
- A closed tab mid-turn never corrupts a world.
- Past pages can't be changed through any API.

## Open questions

1. ~~Edge Function (authoritative) vs RPC (trust client) for commit?~~ **Decided: Edge Function** re-runs the turn through the engine ([013](../decisions/013-engine-rule-details.md) item 10). The RPC is the fallback only if Deno can't import the engine.
2. Journal writing time allowance → lock TTL.
3. ~~Can a player be assigned the world they just played?~~ **Decided:** the device passes its last world as a hint to avoid; no server check ([016](../decisions/016-claim-and-lock-rules.md)).
4. ~~Should players be able to *choose* to start a new world?~~ **Decided:** no, always random ([016](../decisions/016-claim-and-lock-rules.md)).
5. Hide open-world state from non-holders, or don't bother?
6. ~~How are world names generated?~~ **Decided:** `worldName(seed, biome)` from seeded word lists, computed on the client ([016](../decisions/016-claim-and-lock-rules.md)).
