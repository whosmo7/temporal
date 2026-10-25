# INHERITANCE

> *What would responsibility mean if the people affected by your choices could never reward you?*

A browser game about what you inherit and what you leave behind, built for OxHack.

Each player looks after a small farming world for **one day**, which is one **generation**. You inherit whatever the
players before you left: the fields, the stores, the half-finished work, and a journal. Before your day ends you write
a page for whoever comes next. Then you join the graveyard, and someone you'll never meet carries on from where you
stopped. When a world reaches its last generation, a public **replay** shows what each player actually caused.

**Play it:** <https://whosmo7.github.io/temporal/> (desktop browser, keyboard and mouse)

---

## How a day plays

1. **Inherit.** You're handed a world, at random, weighted towards the world furthest along. You're never handed a
   world whose latest generation you played yourself.
2. **Work the land.** A day lasts 2 minutes of real time. Walk with WASD or the arrow keys, and press **E** to act on
   what you face:
   - **Sow** a field tile, **fill the can** at a pond, the sea, a well or the reservoir, then **water** the seed.
   - **Harvest** what's ripe. A crop left ripe for a whole generation rots.
   - Go inside and use the **oven** to cook and eat, which refills your hunger.
   - Repair the reservoir, dig a well, fish or hunt, tend what's worn, or **hurry** someone else's work along.
3. **Write a page.** When the day ends, the clock stops and you write (and draw) a journal page for the next player.
4. **See what it cost.** A short summary shows only what you spent and gained today, never what it will become.
5. **Rest.** Your gravestone rises in the graveyard.

During play the world never explains itself. The only ways to learn what came before are the journal and how the
world looks. A "How to play" pop-up opens on your first day and from the button under the clock.

## After the last generation

- **Gallery** (`#/gallery`): every finished world as a small floating island, with its **world score**. Sort by most
  recent, highest or lowest score.
- **Replay** (`#/world/<id>/replay`): step through each generation. You see the world as it was, each player's "ghost"
  replaying their day, what changed and why, and their journal page.
- **Scores** (`#/scores`, signed in): each generation's own score, locked when it ends, and the ten highest.

Scores only appear once a world has finished, never during play.

---

## Running it locally

You need **Node 22** (the version CI uses).

```bash
npm ci
npm run dev
```

Then open <http://localhost:5173/temporal/>.

With no configuration, the game runs on **LocalBackend**, which keeps accounts, worlds and turns in your browser's
`localStorage`. You can play the whole game offline that way. Signing up with the username `admin` gives you an admin
account.
To start again from nothing, clear the site's storage, for example by running `localStorage.clear()` in the console.

### Using Supabase

To use the real backend, copy `.env.example` to `.env.local` and fill in the project's URL and anon key (Supabase →
Project Settings → API), then restart `npm run dev`. Local play then reads and writes the same database as the live
site.

| Variable | What it does |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Use Supabase instead of LocalBackend |
| `VITE_OFFLINE=1` | The offline demo build, with the demo world baked in |
| `GEMINI_API_KEY` | Only for the LLM simulator (`npm run simulate:llm`). **Never** prefix it with `VITE_`: anything with that prefix is published with the website |

### Handy pages in development

| URL | What it is |
|---|---|
| `#/play?seed=123` | An offline sandbox on a fixed world that saves nothing. Add `&turn=60` for a 60-second day, `&graves=AL,MO` to play idle generations first, `&fps=1` for a frame counter |
| `#/tutorial` | The "How to play" pop-up on its own |
| `#/admin` | Admin panel: force-assign a world to a player, world and default settings, end a world, simulated players |
| `#/presentation` | The story of the project, for the pitch |
| `#/dev/worldgen`, `#/dev/kit`, `#/dev/replay` | World generator preview, UI kit sheet, replay test bench (dev builds only) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build the site into `dist/` |
| `npm test` | Vitest, once (`npm run test:watch` to keep it running) |
| `npm run typecheck`, `npm run lint`, `npm run format` | TypeScript, ESLint, Prettier |
| `npm run check:decisions` | Checks that the decision records in `docs/decisions/` have no clashing numbers, and prints the next free one |
| `npm run simulate` | Balance run: scripted strategies (hoarder, planter, quick-fixer) over several generations, as a table |
| `npm run simulate:llm` | Gemini plays generation after generation in one world (see `docs/llm-simulator.md`) |
| `npm run worldgen` | Prints a generated map as text, e.g. `npm run worldgen -- --seed 123 --biome island` |
| `npm run atlas`, `npm run audio` | Rebuild the sprite atlas and audio sprites from the source packs |
| `npm run functions:deploy` | Bundle the engine and deploy the Supabase Edge Functions |

**Before you push,** run what CI runs:

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run check:decisions
```

---

## How it's built

**React 19 + TypeScript + Vite**, with **PixiJS 8** for the world, **Zustand** for game state, **Supabase** (Postgres,
row-level security, Edge Functions) for the backend, **Vitest** for tests, and **GitHub Pages** for hosting, with hash
routes.

The core is a **pure, deterministic turn engine** in `src/engine/`. It has no randomness of its own, no clock and no
DOM. The same code runs in the browser, in the tests and on the server:

- Every player action goes into an **append-only action log**, with the time it was taken and the time its effect is
  due.
- Every change to the world records **why it happened**, as a list of causes. The replay reads those causes back to
  tell each player's story.
- When a turn is saved, the `commit-turn` Edge Function **re-runs the whole turn through the engine** before writing
  it, so the server never trusts the browser's version of events.
- One player holds a world at a time. Leaving to Home gives it back; abandoning it lets the hold run out, and that day
  is simply void.

```
src/
  engine/      the turn engine: actions, effects, turns, causes, replay, scores   (pure)
  worldgen/    seeded maps: biomes, plots, the house, ponds, paths                (pure)
  render/      the Pixi world: tiles, plots, the player, camera, light, FX
  store/       the Zustand game store: the clock, the action buffer
  api/         the Backend interface, LocalBackend and SupabaseBackend
  ui/          React screens: play, HUD, journal, summary, replay, gallery, tutorial, admin
supabase/
  migrations/  schema, RLS, claim_world, commit and gallery RPCs
  functions/   commit-turn, seed-demo, llm-simulate
scripts/       balance runs, simulators, asset builds, demo seeding
docs/          the plan, decisions, content, art direction
```

Pushing to `main` deploys the site to GitHub Pages. It also applies new database migrations and redeploys the Edge
Functions, so the server's copy of the engine stays in step with the browser's.

## Documentation

- **`docs/plan/`**: the project plan and the source of truth for game rules. Start at
  [`docs/plan/README.md`](docs/plan/README.md); game numbers are in
  [`01-game-design.md`](docs/plan/01-game-design.md).
- **`docs/decisions/`**: one short record per design decision (context, options, decision, consequences).
- **`docs/content/`**: every player-facing line, in the game's voice.
- **`PRODUCT.md`**: who it's for and the principles behind it.
- **`CLAUDE.md`** and **`.claude/skills/`**: the rules and conventions the team's coding assistants follow.
- **`ASSETS.md`**: art and audio sources and their licences.

## The team

Built in 48 hours by a team of three, split by area:

- **A: Engine & Backend.** The turn engine, Supabase, commit and replay.
- **B: World & Gameplay.** World generation, rendering, the play loop.
- **C: Design, Content & App Shell.** Game design and balance, art and audio, the journal, screens, gallery.

Who does what: [`docs/plan/12-team-split.md`](docs/plan/12-team-split.md).

## Credits

All art and audio are free and licence-checked. The art, music and sound come from **Ninja Adventure** by Pixel-Boy &
AAA (CC0), and the HUD icons are by **Kyrise** (CC BY 4.0). The full list, with links and licences, is in [`ASSETS.md`](ASSETS.md).
