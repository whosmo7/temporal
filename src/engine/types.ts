// Engine contract (02). Source of truth for the ids in inheritance-core ids.md: change both together.
// Biome, PlotKind, PlotId and SeededEvent come from worldgen (03) so there is one copy of each.

import type { SeededEvent } from '../worldgen/events';
import type { Biome, PlotId, PlotKind } from '../worldgen/types';

export type { Biome, PlotId, PlotKind, SeededEvent };

// ---- Time ----

/** `turn` is the generation index from 1. `t` is seconds into the turn; omitted = start of turn. */
export interface TimePoint {
  turn: number;
  t?: number;
}

// ---- Resources ----

export type ResourceKey = 'food' | 'water' | 'stamina';

// ---- Actions ----

export type ActionType =
  | 'harvest'
  | 'plantCrops'
  | 'plantOrchard'
  | 'repairReservoir'
  | 'digWell'
  | 'fishHunt'
  | 'maintain'
  | 'fastTrack';

/** One entry in the append-only action log. Never mutated once written. */
export interface ActionEntry {
  id: string;
  worldId: string;
  /** Player profile id. */
  actorId: string;
  type: ActionType;
  plotId?: PlotId;
  /** For `fastTrack`: the pending effect being pulled forward. */
  targetEffectId?: string;
  /** For `harvest`: eat now instead of storing (decision 003). */
  eat?: boolean;
  committedAt: TimePoint;
  /** When the main effect lands. Equals `committedAt` for immediate actions. */
  dueAt: TimePoint;
  /** Order within the turn. */
  seq: number;
}

/** What the game loop passes to `applyAction`. The engine fills in the times. */
export type ActionInput = Omit<ActionEntry, 'worldId' | 'committedAt' | 'dueAt'>;

// ---- Scheduled effects ----

export type EffectKind =
  'cropRipe' | 'orchardMature' | 'orchardYield' | 'reservoirRepaired' | 'wellIncome';

export type EffectStatus = 'pending' | 'resolved' | 'cancelled' | 'fastTracked';

export interface ScheduledEffect {
  id: string;
  /** Exactly one source: the action or event that scheduled it. */
  sourceActionId?: string;
  sourceActorId?: string;
  sourceEventId?: string;
  committedAt: TimePoint;
  dueAt: TimePoint;
  kind: EffectKind;
  plotId?: PlotId;
  payload: Record<string, number | string>;
  status: EffectStatus;
}

// ---- Causes and transitions ----

export type CauseRule =
  'foodRot' | 'waterStagnate' | 'wear' | 'upkeep' | 'regrow' | 'weakened' | 'income' | 'newTurn';

export interface ActionCause {
  kind: 'action';
  actionId: string;
  actorId: string;
  committedTurn: number;
}

/** `share` is this cause's part of the transition's delta, when it can be split. */
export type Cause = { share?: number } & (
  ActionCause | { kind: 'event'; eventId: string } | { kind: 'rule'; rule: CauseRule }
);

export type TransitionTarget =
  | { resource: ResourceKey }
  | { plot: PlotId; field: string }
  | { world: 'wildStock' | 'weakened' }
  | { effect: string; field: 'status' };

/** One recorded state change. Append-only; always has at least one cause. */
export interface Transition {
  id: string;
  at: TimePoint;
  target: TransitionTarget;
  before: number | string | null;
  after: number | string | null;
  delta?: number;
  causes: Cause[];
}

// ---- Plots ----

export type FieldStage = 'empty' | 'sown' | 'growing' | 'ripe' | 'rotten';
export type OrchardStage = 'empty' | 'sapling' | 'young' | 'fruiting' | 'worn' | 'dead';
export type ReservoirStage = 'cracked' | 'low' | 'full';
export type WellStage = 'none' | 'clear' | 'stagnant';
export type WildStage = 'many' | 'few' | 'none';
export type StoreStage = 'full' | 'half' | 'empty' | 'rotting';

export type PlotStage = FieldStage | OrchardStage | ReservoirStage | WellStage | WildStage;

export interface PlotState {
  id: PlotId;
  kind: PlotKind;
  /** Engine's current stage. Lectern and graveyard have none. */
  stage?: PlotStage;
  /** Structure wear in generations since last maintained. 0 = sound. */
  wear: number;
  /** Building, repairing or planting counts as maintenance for the next wear tick. */
  lastMaintainedTurn: number | null;
  /** The action that built, repaired or planted what's here now, for income and harvest causes. */
  builtBy: ActionCause | null;
  /** Orchards fruit once per generation. */
  harvestedTurn: number | null;
}

// ---- World ----

export interface WorldState {
  worldId: string;
  seed: number;
  biome: Biome;
  turn: number;
  generationCount: number;
  turnSeconds: number;
  resources: Record<ResourceKey, number>;
  plots: Record<PlotId, PlotState>;
  pending: ScheduledEffect[];
  wildStock: number;
  wildCap: number;
  /** 0..1 shortfall carried from the previous generation. */
  weakened: number;
  /** Every event for the world's life, from the seed. */
  events: SeededEvent[];
  /** Realised totals for the current turn, for the cost summary. Reset by beginTurn. */
  tally: TurnTally;
}

export interface TurnTally {
  staminaSpent: number;
  waterSpent: number;
  foodGained: number;
  waterGained: number;
  /** Food eaten straight from a harvest (decision 003). */
  foodEaten: number;
}

/** Output of every reducer. */
export interface StepResult {
  state: WorldState;
  transitions: Transition[];
}

export interface ActionResult extends StepResult {
  /** The log entry to append. Absent when the action was rejected. */
  entry?: ActionEntry;
  /** Short player-readable reason the action was rejected. State is unchanged. */
  error?: string;
}

/** The cost summary. Realised outcomes only; pending benefits have no field here on purpose. */
export interface TurnSummary {
  turn: number;
  spent: { stamina: number; water: number };
  gained: { food: number; water: number };
  foodEaten: number;
  upkeep: {
    food: { required: number; paid: number };
    water: { required: number; paid: number };
    met: boolean;
  };
  /** Shortfall the next player inherits, 0..1. */
  weakenedNext: number;
  cropsRotted: number;
}

export interface EndTurnResult extends StepResult {
  summary: TurnSummary;
}

/** One committed generation, as stored in `snapshots` and rebuilt by `replay`. */
export interface Snapshot {
  turn: number;
  /** State after that generation's endTurn. */
  state: WorldState;
  /** Everything from that generation's beginTurn, actions, ticks and endTurn, in order. */
  transitions: Transition[];
  actions: ActionEntry[];
}

// ---- What the UI may see during play (no numbers or due dates on pending effects) ----

export interface VisiblePlot {
  id: PlotId;
  kind: PlotKind;
  stage?: PlotStage;
}

export interface VisibleWorld {
  turn: number;
  biome: Biome;
  /** Current stores. Realised values only, never pending ones. */
  resources: Record<ResourceKey, number>;
  plots: Record<PlotId, VisiblePlot>;
  store: StoreStage;
  weakened: boolean;
  drought: boolean;
  /** 0..1 through the turn. */
  timeOfDay: number;
  /** What the Fast Track menu may list: who started it and when, plus the price. No due dates. */
  fastTrackable: FastTrackOption[];
}

export interface FastTrackOption {
  effectId: string;
  kind: EffectKind;
  plotId?: PlotId;
  actorId?: string;
  committedTurn: number;
  cost: { stamina: number; water: number };
}
