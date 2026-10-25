---
name: inheritance-engine
description: Conventions for the INHERITANCE simulation engine and world generator (src/engine/, src/worldgen/, scripts/simulate.ts) in the temporal repo. Covers purity and determinism, the append-only action log, scheduled effects with committed and due times, recording causes on every transition, the fixed between-generation order, visibleView, replay/explain, and the Vitest cases each change needs. Use this whenever you touch engine or worldgen code or tests, add or change an action, effect, event or decay rule, work on replay or cause explanations, or debug a state that doesn't match between runs, even for a one-line change.
---

# Engine & worldgen

The engine is the brief's technical core: *an authoritative turn engine and an append-only action log,
where every action stores the turn it was committed and the turn its effects are due, and every state
transition records its contributing causes.* The same code runs in the browser, in Vitest and in the
Supabase `commit-turn` Edge Function, so it has to be pure TypeScript with no environment assumptions.

Full spec: `docs/plan/02-engine.md` and `docs/plan/03-world-generation.md`. IDs: `inheritance-core/references/ids.md`.

## Hard rules (and why)

| Rule | Why |
|---|---|
| No imports from React, Pixi, DOM, `supabase-js` or Node-only modules in `src/engine/` or `src/worldgen/` | It has to run unchanged in Deno (Edge Function) and Vitest |
| No `Math.random()`, `Date.now()`, `new Date()`, `crypto.randomUUID()` | Determinism. The server re-simulates and the replay rebuilds from the log |
| Randomness comes from the seeded PRNG, with a stream per turn derived from `hash(seed, turn)` | Adding an action in gen 2 mustn't shift gen 4's drought |
| In-turn time `t` is an argument, clamped to `[0, turnSeconds]` | The game loop owns the clock; tests pass fixed times |
| Reducers return new state: `(state, input) → { state, transitions }` | Easy to test, replay and diff. No hidden mutation |
| Never mutate or remove past `ActionEntry`, `Transition` or resolved `ScheduledEffect` records. Change `status` on effects only by appending a transition | Append-only history is a game rule and the replay's foundation |
| Every `Transition` has `causes.length >= 1` | The replay must be able to explain every change |
| All tunable numbers come from `config.ts`. No magic numbers in reducers | C tunes balance there without touching engine logic |

## Recording a change

Make every state change through one helper, so a cause can't be forgotten:

```ts
// src/engine/emit.ts
export function emit(
  acc: Transition[],
  at: TimePoint,
  target: Transition['target'],
  before: number | string,
  after: number | string,
  causes: Cause[],           // required; give `share` when several causes split a delta
): void
```

- When one value comes from several factors (reservoir income cut by wear *and* drought), emit **one**
  transition with several causes and a `share` on each, so the replay can say "−12 drought, −6 wear".
- An action's cause is `{ kind: 'action', actionId, actorId, committedTurn }`. The `committedTurn` is
  what lets the replay say "planted by AL in Gen 1".

## Adding or changing an action

1. Add the ID to `ActionType` (and `ids.md`) if it's new.
2. Put its costs, yields and delays in `config.ts`.
3. In `applyAction`, validate: enough stamina and resources, plot exists and is in a valid state, target
   effect exists (for `fastTrack`). Return `{ error }` with a short player-readable reason instead of
   throwing. The UI shows it as-is (e.g. "Not enough stamina").
4. Deduct costs with `emit`, then schedule any delayed effect as a `ScheduledEffect` with
   `committedAt` and `dueAt`.
5. Add it to `visibleView()` stage mapping if it changes how a plot looks.
6. Tests (below).

`fastTrack`: cost = 2× the original action's cost, paid by the current player. The target effect
resolves now and is marked `fastTracked`. It works on anyone's pending effect. Record the fast-track
as its own action, so the replay can say "MO fast-tracked AL's orchard".

## Between-generation order (`beginTurn`)

This order is part of the contract, because changing it changes outcomes. Keep it in one function
with these steps commented:

1. Resolve pending effects due at `{ turn: n }`
2. Apply seeded events for turn `n`
3. Structure wear +1 (unless maintained last turn)
4. Food rot, water stagnation, hunger drop (decision 016)
5. Resource income (reservoir, well), reduced by wear and events
6. Wild stock regrowth
7. Starting stamina, reduced by `weakened`

If a change needs a different order, raise it as an open question (`inheritance-task-workflow`).

## `endTurn` and the summary

`endTurn` rots unharvested crops, applies upkeep, computes `weakened` for the successor and returns a
**realised-only summary**: costs paid and immediate gains this turn. Leave pending benefits out of the
summary type altogether, so the UI can't show them by accident. See `inheritance-player-facing`.

## `visibleView()`

This is the only view the play UI gets. It returns plot stages (`ids.md` names), resources, stamina,
time of day and world flags (`weakened`, `drought`). It **does not** return pending effect numbers, due
turns or causes. The Fast Track menu gets a list of pending effects with the planter's name and
stage only.

## Worldgen

- Pure function of `(seed, biome, opts)` → `TileMap` (`03` shape). Uses the engine PRNG and its own seeded noise.
- Guarantee every plot is reachable from spawn. Re-roll placement with the next PRNG draw if not, and
  never loop forever (cap the attempts, then fail loudly in tests).
- At least one drought in the seeded event list, while `CONFIG.droughts` is on (it's off for now, decision 030).

## Required tests (Vitest)

Every engine PR keeps these green and adds to them where relevant:

- **Determinism:** same seed + log → deep-equal state (include a property-style test over random logs from a seeded generator).
- **Per action:** cost deducted, effect scheduled with the right `dueAt`, invalid cases return `error`.
- **Delayed effect + cause:** orchard planted in gen 1 fruits in gen 3, and `explain()` for gen 3 food names the gen 1 action and actor.
- **Fast Track** on another player's effect: double cost, resolves now, original marked `fastTracked`.
- **Decay/wear:** unmaintained well stagnates; `maintain` resets it.
- **Event:** drought with vs without reservoir repair.
- **Soft fail:** upkeep shortfall → successor stamina reduced, with cause `rule: 'weakened'`.
- **Invariants:** every transition has ≥1 cause; no API mutates past log entries.
- **Replay equivalence:** `replay(seed, opts, log)` equals the live run's per-generation snapshots.
- **Worldgen:** same seed → identical map; 1000 seeds → all plots reachable, no overlaps.

Put fixtures in `src/engine/__fixtures__/`. Name tests after the behaviour
(`orchard planted in gen 1 is explained in gen 3`), so a failure reads like a broken game rule.

## Balance script

`scripts/simulate.ts` runs N generations with scripted strategies and prints a per-generation table of
food, water, stamina, plot stages and upkeep met. C uses it for tuning (`inheritance-balance`), so keep
its output format stable and its strategies in `scripts/strategies/`.
