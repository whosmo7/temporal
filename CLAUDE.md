# INHERITANCE (temporal)

A browser-based, async-multiplayer farming game for OxHack. Each player governs a small seeded world for
one timed turn (one generation). They inherit what earlier players left and leave a journal page
for whoever comes next. When a world reaches its final generation, a replay shows what each player caused.

- **Plan:** `docs/plan/` (start at `docs/plan/README.md`). The plan is the source of truth for decisions.
- **Team split:** `docs/plan/12-team-split.md`. Every task is tagged **[A]** Engine & Backend,
  **[B]** World & Gameplay, or **[C]** Design, Content & App Shell.
- **Stack:** React + TypeScript + Vite, PixiJS for the world, Zustand store, Supabase backend, Vitest,
  GitHub Pages (hash routing).

## Project skills

Load the skill that matches the work. They live in `.claude/skills/`:

| Skill | Use for |
|---|---|
| `inheritance-core` | Any work in this repo: locked decisions, invariants, canonical IDs |
| `inheritance-task-workflow` | Picking up a plan task, branching, ticking it off, opening the PR, open questions |
| `inheritance-engine` | `src/engine/`, `src/worldgen/`, `scripts/simulate.ts`, engine tests |
| `inheritance-world-ui` | `src/render/`, `src/ui/`, `src/store/`: Pixi layers, HUD, journal, replay, screens |
| `inheritance-player-facing` | Anything a player sees or reads: what may be shown, and in what voice |
| `inheritance-backend` | `supabase/`, `src/api/`: schema, RLS, claim/commit, `LocalBackend` |
| `inheritance-assets` | Sprites, atlases, audio, fonts, `ASSETS.md` licences |
| `inheritance-balance` | `config.ts` numbers, balance runs, strategy fixtures |

## Five rules that hold everywhere

1. The engine is pure and deterministic: no `Math.random`, `Date.now`, DOM, React or Pixi in `src/engine/` or `src/worldgen/`.
2. Logs are append-only: actions, transitions, turns, snapshots and journal pages are never updated or deleted.
3. Every state transition records at least one cause.
4. During play nothing shows a pending effect's numbers or due date, or a cause. The only readouts of the world's condition are the health bar (no number) and the land's level name (decisions 023, 026). Only the replay explains.
5. Don't decide an open question silently. Raise it and record the decision (see `inheritance-task-workflow`).
