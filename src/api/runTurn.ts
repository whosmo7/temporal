import { applyAction, beginTurn, createWorld, endTurn } from '../engine';
import type { Biome } from '../worldgen/types';
import type { PresetName } from '../worldgen/presets';
import type { ActionEntry, Transition, TurnSummary, WorldState } from '../engine/types';

// Re-runs one generation through the engine. The commit-turn Edge Function and LocalBackend both
// call this (the function gets it bundled into supabase/functions/_shared/engine.js), so a turn is
// accepted by the same rules everywhere. Pure: no clock, no storage.

export interface WorldMeta {
  worldId: string;
  seed: number;
  biome: Biome;
  preset: PresetName;
  generationCount: number;
  turnSeconds: number;
}

export interface TurnResult {
  state: WorldState;
  actions: ActionEntry[];
  transitions: Transition[];
  summary: TurnSummary;
}

export class InvalidTurnError extends Error {}

/**
 * `previous` is the last committed snapshot, or null for generation 1. Each action's `actorId` is
 * replaced with `actorId`, so a client can't log actions under someone else's name.
 */
export function runTurn(
  world: WorldMeta,
  previous: WorldState | null,
  submitted: ActionEntry[],
  actorId: string,
): TurnResult {
  let state =
    previous ??
    createWorld(world.seed, {
      worldId: world.worldId,
      biome: world.biome,
      preset: world.preset,
      generationCount: world.generationCount,
      turnSeconds: world.turnSeconds,
    }).state;

  const begun = beginTurn(state);
  state = begun.state;
  const transitions: Transition[] = [...begun.transitions];
  const actions: ActionEntry[] = [];
  for (const action of [...submitted].sort((a, b) => a.seq - b.seq)) {
    const result = applyAction(state, { ...action, actorId }, action.committedAt?.t ?? 0);
    if (result.error || !result.entry) {
      throw new InvalidTurnError(`Invalid action ${action.id}: ${result.error ?? 'rejected'}`);
    }
    state = result.state;
    transitions.push(...result.transitions);
    actions.push(result.entry);
  }
  const ended = endTurn(state);
  transitions.push(...ended.transitions);
  return { state: ended.state, actions, transitions, summary: ended.summary };
}
