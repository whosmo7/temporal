# Backend integration fixes (2026-10-24)

What went wrong while A's backend (`07`) landed alongside the play, gallery and admin work, and how each problem was fixed.
For reference when something similar shows up again. PRs: #8, #9 and the PR that adds this file.

| # | Problem | Effect if left | Fix |
|---|---|---|---|
| 1 | `transitions.id` and `actions.id` were global primary keys, but engine ids (`begin-3#0`) repeat in every world | The second world's first commit fails on a duplicate key | Keys are `(world_id, id)`; `transitions.seq` keeps engine order (migration `20261024200000`) |
| 2 | VS Code checked the Deno Edge Function with the Node TypeScript setup | 5 red errors in `commit-turn/index.ts` (the code itself worked) | `supabase/functions/tsconfig.json` + a Deno shim; `npm run typecheck` now covers the folder |
| 3 | Git merged B's and A's `src/api` edits "cleanly" but wrongly: `backend` exported twice, a duplicate `players` field, calls to helpers that had become methods | Build broken; live gallery had no thumbnails | Kept the Supabase/offline selector; repaired the fields; migration `20261024210000` returns `preset` + `final_state` |
| 4 | The client logged actions under the **username**, the server under the **profile id** | Server's copy of the world differed from the player's | Play uses the profile id (the `ActionEntry.actorId` contract). Replay names people by generation, so nothing visible changed |
| 5 | B's engine change merged, but the deployed `commit-turn` still bundled the old engine | Server re-ran turns with old rules (caught by the live replay-order check) | Redeployed; `deploy.yml` now redeploys the function and pushes migrations on every merge to `main` |
| 6 | A and C built the same admin API in parallel under different names | PR #8 conflicted with `main` | Adopted C's names and rules (`listWorlds`, `configureWorld`, `markComplete`, `clearLock`…); migration `20261024220000` matches the SQL |
| 7 | C's admin test used the username `al` | The database refuses names under 3 characters, so the real site would too | Test uses `alba` |
| 8 | A test faked `Math.random`, but `LocalBackend` had already captured the real one | Test passed ~70% of the time | `LocalBackend` looks up `Math.random` / `Date.now` per call |
| 9 | The live test promoted `userIds[4]` to admin, but users are created in parallel, so the order is random | Admin checks failed at random | Promote by username |
| 10 | Two decision-number clashes (016 hunger vs claim rules, then 019 per-tile vs claim rules) | Broken or ambiguous links in the plan | Claim rules are now **020**; `npm run check:decisions` runs in CI; the task-workflow skill says to take the number from the latest `main` |
| 11 | The first Pages deploy ran before Pages was switched on | Deploy failed with "404, ensure Pages is enabled" | Pages set to GitHub Actions; the run re-ran green |
| 12 | `deploy.yml` waited for a `SUPABASE_DB_PASSWORD` secret nobody had | Migrations never deployed automatically | Dropped: the Supabase CLI logs in with the access token alone. `SUPABASE_ACCESS_TOKEN` (added by C) is the only secret |
| 13 | `build_page.py` read pandoc's UTF-8 output with Windows' default encoding | `plan.html` couldn't be rebuilt on Windows | The script reads and writes UTF-8 explicitly |
| 14 | A's Supabase account wasn't in the Temporal org | Couldn't push migrations or deploy | C sent the invite |

## Now automatic

A merge to `main` builds and publishes the site (https://whosmo7.github.io/temporal/), pushes new migrations and
redeploys `commit-turn` with the current engine. `scripts/test-backend.ts --cleanup` runs 27 live checks: claims,
voiding, commits, gallery, replay, RLS and admin calls.

## Still open

- **B:** call `backend.heartbeat(worldId)` about once a minute while the clock is stopped (journal, end-of-turn), or long reads void the turn ([020](../decisions/020-claim-and-lock-rules.md)).
- **C:** the demo seed, turn length, generations and founder pages in `src/api/demo-world.json`, plus judge and admin accounts. Then A runs `scripts/seed-demo.ts`.

## Lessons

- A "clean" git merge can still be wrong when two people edit the same file in parallel. Run the full checks after every merge from `main`.
- Shared contracts (`Backend`, engine types) need one owner per change. Say so in the team channel before renaming or adding to them.
- Any engine change needs the server redeployed. That's automatic now, but check the "Deploy to Pages" run if commits start getting rejected.
