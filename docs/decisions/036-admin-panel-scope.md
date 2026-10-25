# 036 — Admin panel: one shared admin account, worlds in progress, delete that keeps history, demo button, action log

**Status:** decided 2026-10-25 by the user (A) · **Changes:** `08` › Admin panel, `07` › Server operations, `10` › Seeding ·
**Builds on:** [020](020-claim-and-lock-rules.md), [034](034-weighted-claim-no-back-to-back.md), [035](035-home-releases-the-world.md)

## Context

C's admin panel (`/#/admin`) covers what `10` asked for: force-assign, configure a world, clear a lock, skip to replay, and
the new-world defaults. It left open who becomes an admin, how the demo world gets made at the venue, what to do with worlds
nobody wants, and whether admin changes leave a trace. Every admin call changes a world without a player's action behind it,
and a world can be ended early with no record of who did it.

## Options considered

| Question | Options | Chosen |
|---|---|---|
| Who is an admin | SQL per user · a "make admin" control · demote-only control · **one shared account** | **One shared `admin` account** |
| Demo world on the day | **Button in the panel** · script only · both | **Button** (the script stays as a backup) |
| Unwanted worlds | hide from gallery · nothing · hard delete · **remove, keep history** | **Remove, keep history** |
| A world someone is playing | **refuse while locked** · delete anyway | **Refuse while locked** |
| Admin changes | **append-only log + view** · log only · no log | **Log + view** |

## Decision

- **Admin access is one shared account, `admin`.** You are an admin by signing in to it. No promote or demote controls. On
  Supabase its `profiles.is_admin` is set once with SQL; on `LocalBackend` signing up as `admin` already does this.
- **The panel lists worlds in progress only** (`status = 'open'` and not removed). Finished worlds are in the gallery and
  their replays; "End here" moves a world out of the list.
- **Delete removes a world from the game, not from the database.** It sets `worlds.removed_at` (and `removed_by`). A removed
  world is never assigned by `claim_world` (every bucket in [034](034-weighted-claim-no-back-to-back.md), and force-assign),
  never listed in the panel or the gallery, and its replay isn't served. Its turns, actions, transitions, snapshots and
  journal pages stay exactly as they are, so rule 2 (append-only logs) holds. An undo is one SQL line
  (`update worlds set removed_at = null …`); the panel has no undo.
- **Delete is refused while the world is locked.** The button is disabled while someone holds the lock; the admin can
  "Clear lock" first (which voids that player's turn), then delete. The server checks this too.
- **"Create demo world" is a panel button.** It makes the world from `src/api/demo-world.json`, plays the founder
  generations through the same engine re-run as `commit-turn`, and force-assigns the judge. It runs **server-side** (an
  admin-only Edge Function), because the browser can't sign in as each founder without dropping the admin's own session.
  `scripts/seed-demo.ts` stays as the backup path.
- **Admin actions are logged, append-only.** Every admin call (force-assign, configure, clear lock, end here, delete, create
  demo world, settings) writes one row to `admin_actions`: who, what, which world, the before and after values, and when.
  Rows are never updated or deleted. The panel shows the latest 20.

## Consequences

- **Contract (A):** `Backend` gains `removeWorld(worldId)`, `createDemoWorld()` and `listAdminActions(limit)`;
  `AdminWorld` gains nothing (removed worlds aren't listed). New migration: `worlds.removed_at`, `worlds.removed_by`,
  table `admin_actions` (RLS: admins read, nobody writes directly), RPCs `admin_remove_world` and `admin_recent_actions`, a
  log row from each existing `admin_*` RPC, and the removed-world filter in `claim_world`, `admin_force_assign`,
  `admin_list_worlds`, `list_completed_worlds` and `get_replay`. `LocalBackend` matches.
- **Edge Function (A):** `seed-demo`, admin-only, shares `src/api/demo.ts` with the script.
- **Panel (C):** filter to worlds in progress; a Delete button with a confirm ("Remove this world from the game? Its pages
  are kept."), disabled while locked; a "Create demo world" button; a "Recent admin actions" list.
- **Account (C, `10`):** "Create judge accounts + admin account" becomes "create judge accounts and the one `admin`
  account". Share the admin password only with whoever runs the demo.
- With one shared account the log can't tell people apart, only that "admin" did it. That's accepted for a weekend
  project.
