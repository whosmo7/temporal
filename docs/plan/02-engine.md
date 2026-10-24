# 02 — Simulation Engine: Turn Engine, Action Log, Causality

**Owner:** Engine/simulation dev  
**Depends on:** `11` (repo scaffold). Consumes `01` config. Consumed by `04`, `05`, `06`, `07`.

This is the brief's technical core: **an authoritative turn engine and an append-only action log.
Every action stores the turn it was committed and the turn it is due. Every state transition
records its contributing causes.**

## Decisions (locked)

- TypeScript, **pure and deterministic**: same seed + same action log = same state, every time.
- Unit-tested with **Vitest**.
- Delayed effects are **partly hidden** from the UI. The engine knows everything. The UI asks for a *visual* view.
- Causes are **not shown to players during play**. They are only used by the replay (`06`).

## Design principles

1. **No React or Pixi imports in `src/engine/`.** It must run in the browser, in Vitest, and in a Supabase Edge Function (Deno).
2. **Pure reducers**: `(state, input) → { state, transitions }`. No `Math.random()` or `Date.now()` inside. Use a seeded PRNG and pass time in explicitly.
3. **Append-only log.** Never mutate or delete log entries. State can always be rebuilt by replaying the log.
4. **Two time scales**: `turn` (generation index) and `t` (seconds into the turn, for quick crops and day/night).

## Core types (sketch)

```ts
type ResourceKey = 'food' | 'water' | 'stamina';
type PlotId = string; // e.g. 'field-1', 'orchard-1', 'reservoir', 'well', 'wild'

interface TimePoint { turn: number; t?: number }        // t = seconds into turn (omit = start of turn)

interface ActionEntry {
  id: string;                 // ulid
  worldId: string;
  actorId: string;            // player profile id
  type: ActionType;           // 'harvest' | 'plantCrops' | ... | 'fastTrack'
  plotId?: PlotId;
  targetEffectId?: string;    // for fastTrack
  eat?: boolean;              // harvest only: eat the fresh yield for stamina (decision 003)
  committedAt: TimePoint;     // when it was taken
  dueAt: TimePoint;           // when its main effect lands (== committedAt for immediate)
}

interface ScheduledEffect {
  id: string;
  sourceActionId?: string;    // or sourceEventId / rule
  sourceEventId?: string;
  dueAt: TimePoint;
  kind: EffectKind;           // 'orchardMature' | 'reservoirRepaired' | 'cropRipe' | ...
  payload: Record<string, number | string>;
  status: 'pending' | 'resolved' | 'cancelled' | 'fastTracked';
}

type Cause =
  | { kind: 'action'; actionId: string; actorId: string; committedTurn: number }
  | { kind: 'event'; eventId: string }
  | { kind: 'rule'; rule: 'foodRot' | 'waterStagnate' | 'wear' | 'upkeep' | 'regrow' | 'weakened' };

interface Transition {
  id: string;
  at: TimePoint;
  target: { resource: ResourceKey } | { plot: PlotId; field: string };
  before: number | string;
  after: number | string;
  delta?: number;
  causes: Cause[];            // >= 1, always
}

interface WorldState {
  worldId: string; seed: number; biome: 'forest' | 'island';
  turn: number; generationCount: number; turnSeconds: number;
  resources: Record<ResourceKey, number>;
  plots: Record<PlotId, PlotState>;
  pending: ScheduledEffect[];
  wildStock: number;
  weakened: number;           // 0..1 shortfall carried from previous gen
  events: SeededEvent[];      // all events for the world's life, from seed
}
```

## Engine API

```ts
createWorld(seed, opts): { state, transitions }                 // Gen 0 starter state (uses 03)
beginTurn(state, actorId): { state, transitions }               // applies between-gen rules for this turn
applyAction(state, action, t): { state, transitions, error? }   // validates cost/target and schedules effects
tick(state, t): { state, transitions }                          // resolves intra-turn due effects (crops)
endTurn(state): { state, transitions, summary }                 // freeze, rot crops, upkeep, realised summary
replay(seed, opts, log): Snapshot[]                             // rebuilds every gen from the log (06)
explain(transitions, filter): CauseSummary                      // aggregates causes for a resource/turn (06)
visibleView(state): VisibleWorld                                // partly hidden, for the UI (no numbers on pending)
```

### Between-generation order (inside `beginTurn`) — must be fixed and documented

1. Resolve pending effects due at `{turn: n}`
2. Apply seeded events for turn `n`
3. Structure wear +1 (unless maintained last turn)
4. Food rot, water stagnation
5. Resource income (reservoir, well), reduced by wear and events
6. Wild stock regrowth
7. Set starting stamina, applying `weakened`

Each step emits `Transition`s with the right `causes`. A shortage must always trace back to its causes,
e.g. *"Water −18: drought (event) + reservoir cracked (wear; last maintained by AL in Gen 1)"*.

### Multi-cause transitions

When a value comes from several factors (e.g. reservoir income lowered by both wear and drought),
emit **one transition with multiple causes**, and give each cause its share where possible
(`causes[i].share?: number`) so the replay can say "−12 from drought, −6 from wear".

## Authority (async online)

The engine must be authoritative, so the client can't be trusted to write the final world state.

**Recommended:** the client runs the engine locally for instant feedback and buffers the turn's
`ActionEntry[]`. At end of turn it sends the log to a **Supabase Edge Function `commit-turn`**. That
function imports the same `src/engine` package, re-simulates from the stored state, validates the
log, appends the action log + transitions + a snapshot, and releases the lock, all in one
transaction (see `07`).

**Fallback if the Edge Function eats too much time:** a Postgres RPC that accepts the client-computed
result but still only appends. Record this choice as an open question for the engine + backend devs.

## Determinism

- Seeded PRNG (e.g. `mulberry32` or `sfc32`). Each turn's random stream is derived from `hash(seed, turn)`, so the order of actions within a turn doesn't shift later generations' events.
- IDs: either generated by the engine from `(worldId, turn, sequence)` or a ULID supplied by the caller. Never random inside the reducer.
- In-turn time `t` is passed in by the game loop and clamped to `[0, turnSeconds]`.

## Tasks

**Core**
- [x] **[A]**** `src/engine/` package with no DOM dependencies; set up the path alias
- [x] **[A]**** Seeded PRNG + hash utilities
- [x] **[A]**** Types above (`types.ts`), `config.ts` loaded from `01`
- [x] **[A]**** `createWorld` (calls the worldgen from `03` for the plot layout + starter state)
- [x] **[A]**** `applyAction` for each of the 8 actions, with validation (stamina, resources, plot state, target exists)
- [x] **[A]**** Scheduler: insert, resolve, cancel and fast-track `ScheduledEffect`s
- [x] **[A]**** `tick` for intra-turn effects (quick crops ripen at `t`)
- [x] **[A]**** `endTurn`: unharvested crops rot, upkeep, weakened calculation, **realised-only summary**
- [x] **[A]**** `beginTurn`: the between-generation pipeline in the fixed order above
- [x] **[A]**** Transition + cause recording in every state change (helper: `emit(target, before, after, causes)`)
- [x] **[A]**** `visibleView`: turns pending effects into visual stages only (e.g. orchard `sapling` / `young`), no numbers or due turns
- [x] **[A]**** `replay(seed, opts, log)` → per-generation `Snapshot { state, transitions, actions }`
- [x] **[A]**** `explain()` aggregates causes per resource per turn for the replay

**Tests (Vitest)**
- [x] **[A]**** Determinism: same seed + log → deep-equal state (property test over random logs)
- [x] **[A]**** Each action: cost deducted, effect scheduled with the correct `dueAt`
- [x] **[A]**** Orchard planted at gen 1 fruits at gen 3; replay explains gen 3 food with a cause pointing to the gen 1 action and actor
- [x] **[A]**** Fast Track on another player's orchard: double cost, effect resolves now, original pending effect marked `fastTracked`
- [x] **[A]**** Unmaintained well stagnates after N gens; Maintain resets it
- [x] **[A]**** Drought with vs without reservoir repair
- [x] **[A]**** Upkeep shortfall → successor's stamina reduced, with transition cause `rule: weakened`
- [x] **[A]**** Every transition has ≥1 cause (invariant test)
- [x] **[A]**** Append-only: no API mutates past log entries

**Tooling**
- [x] **[A]** `scripts/simulate.ts`: plays N generations with scripted strategies and prints a resource table (used by game design for balancing)

## Acceptance

- The full 8-action loop runs headless in Vitest for a configurable number of generations.
- `replay()` rebuilds identical states to the live run.
- For any resource change in any generation, `explain()` names the actions (with actor + generation), events or rules behind it.

## Open questions

1. Edge Function re-simulation vs RPC trusting the client (see Authority).
2. Store full state snapshots per gen (fast replay) or re-simulate on demand? Recommendation: store a snapshot per gen, which is small at 32×32 with only a few plots.
3. Effect IDs: engine-derived or ULID?
