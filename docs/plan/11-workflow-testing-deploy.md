# 11 — Repo Setup, Workflow, Testing, Deploy

**Owner:** Everyone (do this first, ideally one person in the first hour)  

## Decisions (locked)

- Repo: `whosmo7/temporal`. **React + TypeScript + Vite.**
- **GitHub Issues + PRs.** The team creates issues from the task lists in `01`–`10`.
- **Vitest** unit tests on the engine.
- Deploy to **GitHub Pages**.
- Team plans its own timeline.

## Proposed structure

```
temporal/
├─ docs/plan/                # these docs
├─ public/assets/            # atlases, audio, fonts
├─ src/
│  ├─ engine/                # pure TS: types, config, prng, actions, scheduler, replay, explain (02)
│  ├─ worldgen/              # seeded map gen (03); pure TS
│  ├─ render/                # Pixi layers, camera, lighting (04)
│  ├─ ui/                    # React: HUD, journal, summary, gallery, replay, admin, shell (04–08)
│  ├─ store/                 # Zustand game/session store
│  ├─ api/                   # Backend interface + SupabaseBackend + LocalBackend (07)
│  ├─ audio/                 # Howler wrapper (09)
│  └─ main.tsx
├─ supabase/
│  ├─ migrations/            # SQL (07)
│  └─ functions/commit-turn/ # Edge Function importing src/engine (07)
├─ scripts/                  # simulate.ts (02), seed-demo.ts (10)
├─ tests/ or src/**/*.test.ts
├─ ASSETS.md                 # licences (09)
└─ .github/workflows/        # ci.yml, deploy.yml
```

## Setup tasks

- [ ] **[A]** `npm create vite@latest` → React + TS. Add ESLint + Prettier.
- [ ] **[A]** Add deps: `pixi.js`, `zustand`, `@supabase/supabase-js`, `howler`; dev: `vitest`, `@vitest/coverage-v8`
- [ ] **[A]** `vite.config.ts`: `base: '/temporal/'` (or `/` if using a custom domain)
- [ ] **[A]** Hash router (`react-router` `createHashRouter`)
- [ ] **[A]** `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Real values go in GitHub Actions secrets.
- [ ] **[A]** `Backend` interface + `LocalBackend` stub, so the frontend and engine can start before Supabase exists
- [ ] **[A]** Path alias `@engine/*` so the Edge Function and the client import the same code
- [ ] **[A]** Turn on Pages in repo settings (source: GitHub Actions)

## CI / deploy

- `ci.yml` (on PR): install → typecheck (`tsc --noEmit`) → lint → `vitest run` → `vite build`
- `deploy.yml` (on push to `main`): build with secrets → `actions/upload-pages-artifact` → `actions/deploy-pages`
- (Optional) deploy the Edge Function with the `supabase` CLI from CI, or by hand.

## Workflow

- One issue per task checkbox (or a small group of them). **Labels per section:** `design`, `engine`, `worldgen`, `render`, `journal`, `replay`, `backend`, `shell`, `art`, `audio`, `demo`, `infra`.
- Short-lived branches `feat/<area>-<thing>`, PR into `main`, one quick review, squash merge.
- Keep `main` deployable. The live Pages build is your demo.
- **Contracts first.** Agree on these early, because they connect the sections:
  1. `engine/types.ts` (WorldState, ActionEntry, Transition, Cause)
  2. `worldgen` `TileMap` shape
  3. `visibleView()` stage names ↔ sprite frame names
  4. `Backend` interface
- Add a feature freeze point before judging (the team picks when).

## Testing

- **Engine (Vitest, required):** see the `02` list: determinism, each action, fast track, decay, drought, upkeep, replay equivalence, every-transition-has-a-cause invariant.
- **Worldgen (Vitest):** reachability over many seeds, determinism.
- **Backend:** a manual two-browser test script (claim exclusivity, abandon → void, commit → successor sees it). SQL can be checked with the Supabase local stack if time allows.
- **UI:** manual playtest checklist per PR (walk, act, freeze, journal, summary, stone).
- **Balance:** `scripts/simulate.ts` runs before tuning changes.

## Acceptance

- A fresh clone → `npm i && npm run dev` works. `npm test` is green. A push to `main` deploys to Pages.

## Open questions

1. Pages URL: `whosmo7.github.io/temporal` or a custom domain?
2. Is Supabase local dev (Docker) worth the setup, or should everyone use one shared cloud project?
3. Monorepo/workspace for engine sharing, or just relative imports + Deno import map?
