import { worldName } from '../worldgen/names';
import type { Biome } from '../worldgen/types';
import type { PresetName } from '../worldgen/presets';
import type {
  ActionEntry,
  AdminWorld,
  ClaimedWorld,
  CompletedWorld,
  JournalPage,
  Replay,
  Transition,
  WorldState,
} from './Backend';

// snake_case rows and RPC payloads → the engine's camelCase types. The only place that knows column names.

export interface JournalRow {
  turn: number;
  author_username: string;
  text: string;
  drawing: unknown;
}

export interface ClaimRow {
  world_id: string;
  seed: number;
  biome: Biome;
  preset: PresetName;
  turn: number;
  generation_count: number;
  turn_seconds: number;
  lock_expires_at: string;
  snapshot: WorldState | null;
  journal: JournalRow[];
  gravestones: { turn: number; username: string }[];
}

export interface CompletedRow {
  world_id: string;
  seed: number;
  biome: Biome;
  generation_count: number;
  completed_at: string;
  players: string[];
  preset: PresetName;
  final_state: WorldState | null;
}

export interface ActionRow {
  id: string;
  world_id: string;
  actor_id: string;
  type: ActionEntry['type'];
  plot_id: string | null;
  target_effect_id: string | null;
  eat: boolean;
  committed_turn: number;
  committed_t: number | null;
  due_turn: number;
  due_t: number | null;
  seq: number;
}

export interface TransitionRow {
  id: string;
  turn: number;
  t: number | null;
  target: Transition['target'];
  before: Transition['before'];
  after: Transition['after'];
  delta: number | null;
  causes: Transition['causes'];
}

export interface ReplayRow {
  world_id: string;
  seed: number;
  biome: Biome;
  snapshots: WorldState[];
  actions: ActionRow[];
  transitions: TransitionRow[];
  journal: JournalRow[];
}

export interface WorldRow {
  id: string;
  seed: number;
  biome: Biome;
  status: 'open' | 'complete';
  current_turn: number;
  generation_count: number;
  turn_seconds: number;
  locked_by: string | null;
  lock_expires_at: string | null;
  forced_for: string | null;
}

const at = (turn: number, t: number | null) => (t === null ? { turn } : { turn, t });

export function toJournalPage(row: JournalRow): JournalPage {
  return { turn: row.turn, authorUsername: row.author_username, text: row.text, drawing: row.drawing };
}

export function toClaimedWorld(row: ClaimRow): ClaimedWorld {
  return {
    worldId: row.world_id,
    name: worldName(row.seed, row.biome),
    seed: row.seed,
    biome: row.biome,
    preset: row.preset,
    turn: row.turn,
    generationCount: row.generation_count,
    turnSeconds: row.turn_seconds,
    lockExpiresAt: row.lock_expires_at,
    snapshot: row.snapshot,
    journal: row.journal.map(toJournalPage),
    gravestones: row.gravestones,
  };
}

export function toCompletedWorld(row: CompletedRow): CompletedWorld {
  return {
    worldId: row.world_id,
    name: worldName(row.seed, row.biome),
    seed: row.seed,
    biome: row.biome,
    generationCount: row.generation_count,
    completedAt: row.completed_at,
    players: row.players,
    preset: row.preset,
    finalState: row.final_state,
  };
}

export function toActionEntry(row: ActionRow): ActionEntry {
  const entry: ActionEntry = {
    id: row.id,
    worldId: row.world_id,
    actorId: row.actor_id,
    type: row.type,
    committedAt: at(row.committed_turn, row.committed_t),
    dueAt: at(row.due_turn, row.due_t),
    seq: row.seq,
  };
  if (row.plot_id !== null) entry.plotId = row.plot_id as ActionEntry['plotId'];
  if (row.target_effect_id !== null) entry.targetEffectId = row.target_effect_id;
  if (row.eat) entry.eat = true;
  return entry;
}

export function toTransition(row: TransitionRow): Transition {
  const transition: Transition = {
    id: row.id,
    at: at(row.turn, row.t),
    target: row.target,
    before: row.before,
    after: row.after,
    causes: row.causes,
  };
  if (row.delta !== null) transition.delta = row.delta;
  return transition;
}

export function toReplay(row: ReplayRow): Replay {
  return {
    worldId: row.world_id,
    name: worldName(row.seed, row.biome),
    seed: row.seed,
    biome: row.biome,
    snapshots: row.snapshots,
    actions: row.actions.map(toActionEntry),
    transitions: row.transitions.map(toTransition),
    journal: row.journal.map(toJournalPage),
  };
}

export function toAdminWorld(row: WorldRow): AdminWorld {
  return {
    worldId: row.id,
    name: worldName(row.seed, row.biome),
    seed: row.seed,
    biome: row.biome,
    status: row.status,
    turn: row.current_turn,
    generationCount: row.generation_count,
    turnSeconds: row.turn_seconds,
    lockedBy: row.locked_by,
    lockExpiresAt: row.lock_expires_at,
    forcedFor: row.forced_for,
  };
}
