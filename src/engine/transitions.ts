// Records every state change with its causes (02 › Transition + cause recording).
// Every engine step makes one Recorder and emits through it, so no change goes unrecorded.

import type { Cause, TimePoint, Transition, TransitionTarget } from './types';

export interface Recorder {
  readonly transitions: Transition[];
  /** Records one change. Throws if it has no cause. Does nothing if the value didn't change. */
  emit(
    target: TransitionTarget,
    before: number | string | null,
    after: number | string | null,
    causes: Cause[],
  ): void;
}

/**
 * `scope` must be unique per engine step, e.g. the action id, `begin-3` or `end-3`.
 * Transition ids are `<scope>#<n>`, so they are the same on every replay.
 */
export function createRecorder(scope: string, at: TimePoint): Recorder {
  const transitions: Transition[] = [];
  return {
    transitions,
    emit(target, before, after, causes) {
      if (causes.length === 0) {
        throw new Error(`Transition on ${JSON.stringify(target)} has no cause`);
      }
      if (before === after) return;
      const transition: Transition = {
        id: `${scope}#${transitions.length}`,
        at,
        target,
        before,
        after,
        causes,
      };
      if (typeof before === 'number' && typeof after === 'number') {
        transition.delta = after - before;
      }
      transitions.push(transition);
    },
  };
}
