// Shared helpers for the reducers. Every recorded change to state goes through one of the set*
// functions here, so it is emitted with its causes.

import { CONFIG } from './config';
import type { Recorder } from './transitions';
import type {
  ActionCause,
  Cause,
  CauseRule,
  EffectStatus,
  PlotStage,
  PlotState,
  ResourceKey,
  ScheduledEffect,
  SeededEvent,
  TurnTally,
  WorldState,
} from './types';

export function emptyTally(): TurnTally {
  return { staminaSpent: 0, waterSpent: 0, foodGained: 0, waterGained: 0, foodEaten: 0 };
}

/** Reducers work on a copy, so the state they were given is never touched. */
export function cloneState(state: WorldState): WorldState {
  return structuredClone(state);
}

export function clampT(state: WorldState, t: number): number {
  return Math.min(Math.max(t, 0), state.turnSeconds);
}

export const rule = (r: CauseRule, share?: number): Cause =>
  share === undefined ? { kind: 'rule', rule: r } : { kind: 'rule', rule: r, share };

export const event = (e: SeededEvent, share?: number): Cause =>
  share === undefined ? { kind: 'event', eventId: e.id } : { kind: 'event', eventId: e.id, share };

export function eventAt(
  state: WorldState,
  kind: SeededEvent['kind'],
  turn = state.turn,
): SeededEvent | undefined {
  if (kind === 'drought' && !CONFIG.droughts) return undefined; // off (decision 030), even in older worlds
  return state.events.find((e) => e.kind === kind && e.turn === turn);
}

export function setResource(
  state: WorldState,
  rec: Recorder,
  key: ResourceKey,
  after: number,
  causes: Cause[],
): void {
  rec.emit({ resource: key }, state.resources[key], after, causes);
  state.resources[key] = after;
}

export function setWorld(
  state: WorldState,
  rec: Recorder,
  key: 'wildStock' | 'weakened',
  after: number,
  causes: Cause[],
): void {
  rec.emit({ world: key }, state[key], after, causes);
  state[key] = after;
}

export function setStage(rec: Recorder, plot: PlotState, after: PlotStage, causes: Cause[]): void {
  rec.emit({ plot: plot.id, field: 'stage' }, plot.stage ?? null, after, causes);
  plot.stage = after;
}

export function setWear(rec: Recorder, plot: PlotState, after: number, causes: Cause[]): void {
  rec.emit({ plot: plot.id, field: 'wear' }, plot.wear, after, causes);
  plot.wear = after;
}

export function setEffectStatus(
  rec: Recorder,
  effect: ScheduledEffect,
  after: EffectStatus,
  causes: Cause[],
): void {
  rec.emit({ effect: effect.id, field: 'status' }, effect.status, after, causes);
  effect.status = after;
}

/** The action that scheduled an effect, as a cause. */
export function sourceCause(effect: ScheduledEffect): Cause[] {
  if (effect.sourceActionId && effect.sourceActorId) {
    return [
      {
        kind: 'action',
        actionId: effect.sourceActionId,
        actorId: effect.sourceActorId,
        committedTurn: effect.committedAt.turn,
      },
    ];
  }
  if (effect.sourceEventId) return [{ kind: 'event', eventId: effect.sourceEventId }];
  return [];
}

export function builtCause(plot: PlotState): ActionCause[] {
  return plot.builtBy ? [plot.builtBy] : [];
}

/** A structure that wears: a repaired reservoir, a dug well or a living orchard. */
export function isBuilt(plot: PlotState): boolean {
  switch (plot.kind) {
    case 'reservoir':
      return plot.stage === 'low' || plot.stage === 'full';
    case 'well':
      return plot.stage === 'clear' || plot.stage === 'stagnant';
    case 'orchard':
      return plot.stage === 'sapling' || plot.stage === 'young' || plot.stage === 'fruiting';
    default:
      return false;
  }
}

/** Reservoir protects against drought only while repaired and below half-output wear. */
export function reservoirProtects(state: WorldState): boolean {
  const reservoir = state.plots['reservoir'];
  return !!reservoir && isBuilt(reservoir) && reservoir.wear < CONFIG.wearHalveAt;
}

export function wellStagnant(state: WorldState): boolean {
  return state.plots['well']?.stage === 'stagnant';
}

/**
 * Brings a built structure's stage in line with its wear: half output at `wearHalveAt`, broken at
 * `wearBreakAt` (reservoir cracks, well stagnates, orchard dies). `causes` are why the wear changed.
 */
export function settleStage(
  state: WorldState,
  rec: Recorder,
  plot: PlotState,
  causes: Cause[],
): void {
  const broken = plot.wear >= CONFIG.wearBreakAt;
  if (plot.kind === 'reservoir') {
    const stage = broken ? 'cracked' : plot.wear >= CONFIG.wearHalveAt ? 'low' : 'full';
    setStage(rec, plot, stage, causes);
    if (broken) plot.builtBy = null;
  } else if (plot.kind === 'well') {
    setStage(rec, plot, broken ? 'stagnant' : 'clear', causes);
  } else if (plot.kind === 'orchard' && broken) {
    setStage(rec, plot, 'dead', causes);
    plot.builtBy = null;
    for (const effect of state.pending) {
      if (effect.plotId === plot.id && effect.status === 'pending') {
        setEffectStatus(rec, effect, 'cancelled', causes);
      }
    }
  }
}
