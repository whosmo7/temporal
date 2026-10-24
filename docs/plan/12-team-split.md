# 12 — Team Split (3 people)

Every task from `01`–`11`, split into three workloads of about the same size. Each person owns whole
areas of the code, so the three of you rarely edit the same files. Put your names next to A, B and C.

**Points are relative effort.** 1 point ≈ one focused hour for someone comfortable with the stack. They
are rough and meant only for balancing the split, not for scheduling.

## Summary

| Person | Focus | Owns | Points (core) | Points (incl. stretch) |
|---|---|---|---|---|
| **A: Engine & Backend** | Simulation engine, Supabase, repo/CI setup, demo seeding | 02, 07, 10, 11 | 69 | 69 |
| **B: World & Gameplay** | World generation, PixiJS world and HUD, in-game end-of-turn flow, replay viewer, play loop | 03, 04, 05, 06, 08 | 68.5 | 70 |
| **C: Design, Content & App Shell** | Game design and balance, art and audio, journal UI, app screens, gallery, demo prep | 01, 05, 06, 08, 09, 10 | 68.5 | 70.5 |
| **Total** | | | 206 | 209.5 |

> **Scope check:** about 206 core points between three people is more than
> 48 hours of realistic working time, even allowing for sleep. Agree a cut line before you start. The most
> self-contained candidates to drop or simplify are: the Edge Function (use the RPC fallback in `07`),
> FX particles, plot history popover, heartbeat RPC, tutorial (replace with one instruction card), and all
> `(Stretch)` items.

## Why it's split this way

- **A** owns everything that must be correct: the engine is the brief's technical core, and the backend
  re-runs it, so one person holds the data contracts (`types.ts`, `Backend` interface, DB schema).
- **B** owns everything that moves on screen in the world: worldgen feeds the renderer directly, and the
  replay viewer reuses the same Pixi layers.
- **C** covers two roles from the original four (design/art/audio and game design/pitch) plus the DOM-only
  React screens (journal, landing, auth, gallery, admin). None of those touch Pixi or the engine internals.

## Handoffs to agree in the first hours

| From → To | What | Needed for |
|---|---|---|
| A → B, C | `engine/types.ts`, `visibleView()` stage names, `Backend` interface + `LocalBackend` stub | Everyone can build against stubs straight away |
| B ↔ C | `TileMap` tile names ↔ atlas frame names; plot visual stages ↔ sprite frames | Art drops in without code changes |
| C → A | First `config.ts` numbers (action costs, yields, delays, decay) | Engine tests and balance runs |
| A → C | `scripts/simulate.ts` | Balance tuning and the 3 strategy fixtures |
| A → C | `explain()` output shape | Cause sentences in the replay |
| C → B | Journal modal + stroke renderer components | End-of-turn flow and replay journal panel |
| B → C | Read-only snapshot renderer | Gallery thumbnails, landing background |

Rehearsing the demo (`10`) is listed under C, but all three of you should be there.

## A: Engine & Backend (69 core / 69 total)

### `02` Simulation Engine: Turn Engine, Action Log, Causality (37 pts)

| Task | Pts |
|---|---|
| `src/engine/` package with no DOM dependencies; set up the path alias | 0.5 |
| Seeded PRNG + hash utilities | 1 |
| Types above (`types.ts`), `config.ts` loaded from `01` | 2 |
| `createWorld` (calls the worldgen from `03` for the plot layout + starter state) | 1.5 |
| `applyAction` for each of the 8 actions, with validation (stamina, resources, plot state, target exists) | 5 |
| Scheduler: insert, resolve, cancel and fast-track `ScheduledEffect`s | 3 |
| `tick` for intra-turn effects (quick crops ripen at `t`) | 1 |
| `endTurn`: unharvested crops rot, upkeep, weakened calculation, **realised-only summary** | 2 |
| `beginTurn`: the between-generation pipeline in the fixed order above | 3 |
| Transition + cause recording in every state change (helper: `emit(target, before, after, causes)`) | 2 |
| `visibleView`: turns pending effects into visual stages only (e.g. orchard `sapling` / `young`), no numbers or due turns | 2 |
| `replay(seed, opts, log)` → per-generation `Snapshot { state, transitions, actions }` | 2 |
| `explain()` aggregates causes per resource per turn for the replay | 2 |
| Determinism: same seed + log → deep-equal state (property test over random logs) | 1.5 |
| Each action: cost deducted, effect scheduled with the correct `dueAt` | 2 |
| Orchard planted at gen 1 fruits at gen 3; replay explains gen 3 food with a cause pointing to the gen 1 action and actor | 1 |
| Fast Track on another player's orchard: double cost, effect resolves now, original pending effect marked `fastTracked` | 1 |
| Unmaintained well stagnates after N gens; Maintain resets it | 0.5 |
| Drought with vs without reservoir repair | 0.5 |
| Upkeep shortfall → successor's stamina reduced, with transition cause `rule: weakened` | 0.5 |
| Every transition has ≥1 cause (invariant test) | 0.5 |
| Append-only: no API mutates past log entries | 0.5 |
| `scripts/simulate.ts`: plays N generations with scripted strategies and prints a resource table (used by game design for balancing) | 2 |

### `07` Backend & Async Multiplayer (Supabase) (22 pts)

| Task | Pts |
|---|---|
| Create the Supabase project. Turn email confirmation off. Add the env vars to the repo secrets + `.env.example`. | 0.5 |
| SQL migrations for the schema above (`supabase/migrations/`) | 2 |
| RLS policies (read-public for completed worlds, no update/delete) | 1.5 |
| Username signup/login with synthetic emails + `profiles` insert trigger | 2 |
| `claim_world` RPC with weighted assignment, `SKIP LOCKED`, stale-lock expiry, force-assign | 3 |
| `commit-turn` Edge Function importing the engine (check that Deno can import the TS engine package; bundle if needed) | 4 |
| `heartbeat` RPC (if needed) | 1 |
| Admin RPCs: set `settings`, set a world's `turn_seconds`/`generation_count`, force-assign, mark complete (skip to replay) | 1.5 |
| Gallery + replay read queries | 1 |
| `LocalBackend` implementation of the same interface (hot-seat) | 2 |
| Concurrency test: 2 clients call `claim_world` at once → different worlds | 1 |
| Abandon test: claim, never commit, wait past the TTL → world is claimable again at the same turn, no gravestone | 1 |
| Seed script for the demo world (`10`) | 1.5 |

### `10` Demo World & Demo Moment (4 pts)

| Task | Pts |
|---|---|
| Write `scripts/seed-demo.ts` (+ a spare world) | 2 |
| Offline fallback: the `LocalBackend` hot-seat build with the same seed + log baked in, in case the venue Wi-Fi fails | 2 |

### `11` Repo Setup, Workflow, Testing, Deploy (6 pts)

| Task | Pts |
|---|---|
| `npm create vite@latest` → React + TS. Add ESLint + Prettier. | 0.5 |
| Add deps: `pixi.js`, `zustand`, `@supabase/supabase-js`, `howler`; dev: `vitest`, `@vitest/coverage-v8` | 0.5 |
| `vite.config.ts`: `base: '/temporal/'` (or `/` if using a custom domain) | 0.25 |
| Hash router (`react-router` `createHashRouter`) | 0.5 |
| `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Real values go in GitHub Actions secrets. | 0.25 |
| `Backend` interface + `LocalBackend` stub, so the frontend and engine can start before Supabase exists | 1.5 |
| Path alias `@engine/*` so the Edge Function and the client import the same code | 0.5 |
| Turn on Pages in repo settings (source: GitHub Actions) | 0.5 |
| `ci.yml` + `deploy.yml` GitHub Actions workflows (listed under CI / deploy) | 1.5 |

## B: World & Gameplay (68.5 core / 70 total)

### `03` World Generation: Seeds, Biomes, Plots (15.5 pts)

| Task | Pts |
|---|---|
| Seeded noise util (value noise is enough) | 1 |
| Boundary mask for Forest and Island | 2 |
| Plot placement with spacing + reachability guarantee (re-roll if unreachable) | 3 |
| Path carving (BFS/A*) | 1.5 |
| Decoration scatter | 1 |
| Collision grid export | 1 |
| Output a `TileMap` data structure: `{ width, height, layers: { terrain, boundary, deco }, plots: {id, x, y, w, h, kind}[], spawn }` with no Pixi dependency | 1 |
| Biome starter state + modifiers wired into `createWorld` | 1 |
| Seeded event list (≥1 drought) | 1 |
| Vitest: same seed → identical map; 1000 random seeds → all plots reachable, no overlaps | 1.5 |
| Debug page `/dev/worldgen?seed=123` that renders the map as coloured squares (needs `04` basic renderer). Useful for picking demo seeds. | 1.5 |

### `04` World Rendering & In-Game UI (PixiJS + React) (32.5 pts)

| Task | Pts |
|---|---|
| Pixi app mount/unmount inside React. Handle resize and devicePixelRatio. Use nearest-neighbour scaling for pixel art. | 2 |
| Tilemap renderer from `03` `TileMap`, cached to a RenderTexture | 2.5 |
| Camera follow + clamp to map bounds | 1 |
| Player avatar: 4-direction walk animation, collision against the grid | 3 |
| Y-sorting for trees/structures vs the player | 1.5 |
| Plot sprites driven by `visibleView()` stages | 2 |
| Interact prompt + key handling + hotbar | 2.5 |
| Wire actions → engine `applyAction` → store → re-render. Show an invalid-action reason. | 2 |
| Fast Track menu (lists pending effects, with the originating player's name, no due dates) | 2 |
| Day/night lighting + timer | 2 |
| Freeze at time-up (lock input, dim world) → hand off to the `05` flow | 1 |
| Visual-state variants for all rows in the table above | 3 |
| FX: harvest pop, splash, rot flies, blight motes | 2 |
| HUD components (React) styled to match the pixel art | 3 |
| Graveyard rendering: one stone per gravestone record, hover shows the name, click opens the journal page (`05`) | 1.5 |
| Lectern: interact opens the journal | 0.5 |
| Perf check: 60 fps on a mid laptop at 32×32 | 1 |

### `05` Journal, End-of-Turn Flow, Graveyard (5 pts)

| Task | Pts |
|---|---|
| Gravestone placement animation + camera pan | 2 |
| Graveyard rendering and interaction (with `04`) | 1 |
| Lectern interaction → read-only journal during play | 0.5 |
| Hand off to `07` commit; handle a commit failure (retry, keep the local copy) | 1.5 |

### `06` Replay & Gallery (10.5 pts)

| Task | Pts |
|---|---|
| Replay screen layout: snapshot panel + journal panel + causes panel + timeline | 3 |
| Read-only Pixi render of a snapshot (reuse `04` layers, no avatar, no input) | 2 |
| Highlight changed plots per generation (diff vs the previous snapshot) | 1.5 |
| Plot history popover | 1.5 |
| Generation stepping (buttons + arrow keys) + optional auto-play | 1 |
| (Stretch) Animate drawing strokes in the journal panel | 1.5 |

### `08` App Shell: Screens, Auth, Onboarding, Admin (6.5 pts)

| Task | Pts |
|---|---|
| Play flow: claim → interstitial → game → end flow → back to landing / "Play another" | 3 |
| Resume: if the user refreshes while holding a lock, put them back in (or void; open question) | 1.5 |
| Error states: no network, claim failed, commit failed (retry + local backup) | 2 |

## C: Design, Content & App Shell (68.5 core / 70.5 total)

### `01` Game Design: Resources, Actions, Rules (11.5 pts)

| Task | Pts |
|---|---|
| Confirm the action table (costs, yields, delays) and record it as `config.ts` values with the engine dev | 2 |
| Decide defaults for `turnSeconds` and `generationCount` | 0.5 |
| Decide the open questions above (eating, rushed-orchard yield, event set, fishing vs hunting per biome) | 1 |
| Write the **"medium world" tuning scenario** and check the dilemma holds (use the engine's simulated playthrough script from `02`) | 2 |
| Write 3 balance test scenarios as Vitest fixtures: *hoarder*, *planter*, *quick-fixer*. Check no single strategy dominates over N gens. | 3 |
| Write the in-world flavour text: action names, plot names, short tooltips (no numbers on delayed effects) | 1.5 |
| Write the founder/Gen-0 starter conditions per biome (see `03`) | 1 |
| Hand `05` the cost-summary wording ("You spent… You gathered…") with no mention of future yields | 0.5 |

### `05` Journal, End-of-Turn Flow, Graveyard (11 pts)

| Task | Pts |
|---|---|
| Journal modal (book layout, page flip, prev/next) | 3 |
| Text input with limit + counter | 0.5 |
| Drawing canvas: pen, colours, eraser, clear; serialise strokes | 3 |
| Stroke renderer (reused by the replay `06` and gallery thumbnails) | 1 |
| "Seal page" confirmation; locks the page client-side | 1 |
| Cost summary screen from `endTurn().summary` (**realised only**) | 1.5 |
| Copywriting pass with Game design (tone: quiet, reflective, no moralising) | 1 |

### `06` Replay & Gallery (8.5 pts)

| Task | Pts |
|---|---|
| `explain()` output → human sentences (templating with actor names + generations) | 2 |
| Title card + ending card | 1 |
| Gallery grid + thumbnails (render the snapshot to a small texture or a stored image) | 2.5 |
| Route `/#/world/:id/replay` and `/#/gallery` | 0.5 |
| Admin "skip to replay" hook (`08`) | 0.5 |
| (Stretch) Legacy view per player | 2 |

### `08` App Shell: Screens, Auth, Onboarding, Admin (13.5 pts)

| Task | Pts |
|---|---|
| Router (hash) + layout shell + pixel UI theme (shared components: Button, Panel, Modal in the `09` style) | 2.5 |
| Landing page with a background world | 2 |
| Auth screen + session persistence + logout + username display | 2 |
| Tutorial scene | 3 |
| Gallery + replay routes (screens from `06`) | 0.5 |
| Admin panel + guard | 3 |
| Audio toggle (mute) in the shell (`09`) | 0.5 |

### `09` Art & Audio (20.5 pts)

| Task | Pts |
|---|---|
| Evaluate 2–3 packs and pick one family. Write `ASSETS.md` with licences. | 2 |
| Build the Pixi spritesheet/atlas (TexturePacker free / `free-tex-packer`) + JSON | 2 |
| Map `03` tile types → atlas frames (agree the names with the engine dev) | 1.5 |
| Map `04` visual states → frames | 2 |
| Gravestone variants + graveyard layout | 1 |
| Journal book art + fonts | 1.5 |
| UI kit: panel, button, icons (food/water/stamina + 8 actions) | 3 |
| Blight/drought filters (with frontend) | 1.5 |
| Pick music tracks (day, night, reflective) + licences | 1.5 |
| SFX set + audio sprite | 2.5 |
| Title/logo | 1.5 |
| Favicon | 0.5 |

### `10` Demo World & Demo Moment (5.5 pts)

| Task | Pts |
|---|---|
| Pick the demo seed (orchard visible, nice-looking biome) | 1 |
| Decide the demo world's generation count + turn length | 0.5 |
| Write the founder journal pages (natural, not preachy) | 1 |
| Create judge accounts (or a shared "judge" account) + admin account | 0.5 |
| Rehearse force-assign → play → replay flow 3+ times on the demo laptop | 2 |
| Decide on the "what this player saw" replay panel (open question) | 0.5 |
