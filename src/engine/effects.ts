// Scheduler for delayed effects (02 › Scheduler). Effects stay in `state.pending` for good; only
// their status changes, and every status change is a transition.

import {
  builtCause,
  clampT,
  cloneState,
  setEffectStatus,
  setStage,
  setWear,
  sourceCause,
} from './state';
import { createRecorder, type Recorder } from './transitions';
import type { Cause, ScheduledEffect, StepResult, TimePoint, WorldState } from './types';

export function schedule(state: WorldState, effect: ScheduledEffect): void {
  state.pending.push(effect);
}

function isDue(effect: ScheduledEffect, at: TimePoint): boolean {
  if (effect.dueAt.turn !== at.turn) return effect.dueAt.turn < at.turn;
  return (effect.dueAt.t ?? 0) <= (at.t ?? 0);
}

function byDue(a: ScheduledEffect, b: ScheduledEffect): number {
  return (
    a.dueAt.turn - b.dueAt.turn ||
    (a.dueAt.t ?? 0) - (b.dueAt.t ?? 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Applies an effect. `extra` holds the fast-track action when one pulled it forward; the effect is
 * then marked `fastTracked` instead of `resolved`, and both actions are causes.
 */
export function resolveEffect(
  state: WorldState,
  rec: Recorder,
  effect: ScheduledEffect,
  extra: Cause[] = [],
): void {
  const causes = [...extra, ...sourceCause(effect)];
  const plot = effect.plotId ? state.plots[effect.plotId] : undefined;

  if (plot) {
    switch (effect.kind) {
      case 'cropRipe':
        if (plot.stage === 'watered') {
          setStage(rec, plot, 'ripe', causes);
          plot.ripeSince = state.turn;
        }
        break;
      case 'orchardMature':
        if (plot.stage === 'sapling' || plot.stage === 'young') {
          setStage(rec, plot, 'fruiting', [...causes, ...builtCause(plot)].filter(unique));
        }
        break;
      case 'reservoirRepaired': {
        setWear(rec, plot, 0, causes);
        setStage(rec, plot, 'full', causes);
        // The repair counts as maintenance in the turn it was made.
        plot.lastMaintainedTurn = effect.committedAt.turn;
        const source = causes.find(
          (c) => c.kind === 'action' && c.actionId === effect.sourceActionId,
        );
        plot.builtBy = source && source.kind === 'action' ? stripShare(source) : null;
        break;
      }
      default:
        break;
    }
  }

  setEffectStatus(rec, effect, extra.length > 0 ? 'fastTracked' : 'resolved', causes);
}

/** Resolves every pending effect due at or before `at`, earliest first. */
export function resolveDue(state: WorldState, rec: Recorder, at: TimePoint): void {
  const due = state.pending.filter((e) => e.status === 'pending' && isDue(e, at)).sort(byDue);
  for (const effect of due) resolveEffect(state, rec, effect);
}

/** Resolves intra-turn effects (quick crops) due by in-turn time `t`. */
export function tick(state: WorldState, t: number): StepResult {
  const time = clampT(state, t);
  const at = { turn: state.turn, t: time };
  const next = cloneState(state);
  const rec = createRecorder(`tick-${state.turn}-${time}`, at);
  resolveDue(next, rec, at);
  if (rec.transitions.length === 0) return { state, transitions: [] };
  return { state: next, transitions: rec.transitions };
}

function unique(cause: Cause, i: number, all: Cause[]): boolean {
  return (
    cause.kind !== 'action' ||
    all.findIndex((c) => c.kind === 'action' && c.actionId === cause.actionId) === i
  );
}

function stripShare(cause: Cause & { kind: 'action' }) {
  return {
    kind: 'action' as const,
    actionId: cause.actionId,
    actorId: cause.actorId,
    committedTurn: cause.committedTurn,
  };
}
