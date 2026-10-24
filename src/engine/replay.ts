// replay and explain (02 › Engine API, used by 06). Replay rebuilds every generation from the seed
// and the action log; explain adds up the causes behind a resource or plot's changes.

import { applyAction } from './actions';
import { createWorld, type CreateWorldOptions } from './createWorld';
import { beginTurn, endTurn } from './turn';
import type {
  ActionEntry,
  Cause,
  PlotId,
  ResourceKey,
  Snapshot,
  Transition,
  TurnSummary,
} from './types';

export interface ReplayOptions extends CreateWorldOptions {
  /** How many generations were committed. Defaults to the last turn in the log. */
  turns?: number;
}

export interface ReplayResult {
  snapshots: Snapshot[];
  summaries: TurnSummary[];
}

/** Rebuilds every committed generation. Throws if the log holds an action the engine rejects. */
export function replay(seed: number, opts: ReplayOptions, log: ActionEntry[]): ReplayResult {
  const turns = opts.turns ?? log.reduce((max, a) => Math.max(max, a.committedAt.turn), 0);
  let state = createWorld(seed, opts).state;
  const snapshots: Snapshot[] = [];
  const summaries: TurnSummary[] = [];

  for (let n = 1; n <= turns; n++) {
    const begun = beginTurn(state);
    state = begun.state;
    const transitions: Transition[] = [...begun.transitions];
    const actions: ActionEntry[] = [];

    const turnLog = log.filter((a) => a.committedAt.turn === n).sort((a, b) => a.seq - b.seq);
    for (const logged of turnLog) {
      const result = applyAction(state, logged, logged.committedAt.t ?? 0);
      if (result.error || !result.entry) {
        throw new Error(`Action ${logged.id} was rejected on replay: ${result.error}`);
      }
      state = result.state;
      transitions.push(...result.transitions);
      actions.push(result.entry);
    }

    const ended = endTurn(state);
    state = ended.state;
    transitions.push(...ended.transitions);
    snapshots.push({ turn: n, state, transitions, actions });
    summaries.push(ended.summary);
  }

  return { snapshots, summaries };
}

export interface ExplainFilter {
  turn?: number;
  resource?: ResourceKey;
  plot?: PlotId;
}

export interface CauseLine {
  cause: Cause;
  /** This cause's part of the net change, when it is known. */
  amount?: number;
  transitionIds: string[];
}

export interface CauseSummary {
  net: number;
  lines: CauseLine[];
}

/**
 * Groups the matching transitions by cause. A cause's amount comes from its `share`, or from the
 * whole delta when it is the only cause. Lines keep first-seen order.
 */
export function explain(transitions: Transition[], filter: ExplainFilter): CauseSummary {
  const lines = new Map<string, CauseLine>();
  let net = 0;

  for (const tr of transitions) {
    if (filter.turn !== undefined && tr.at.turn !== filter.turn) continue;
    if (filter.resource && !('resource' in tr.target && tr.target.resource === filter.resource)) {
      continue;
    }
    if (filter.plot && !('plot' in tr.target && tr.target.plot === filter.plot)) continue;

    net += tr.delta ?? 0;
    for (const cause of tr.causes) {
      const { share, ...bare } = cause;
      const key = JSON.stringify(bare);
      const line = lines.get(key) ?? { cause: bare as Cause, transitionIds: [] };
      const amount = share ?? (tr.causes.length === 1 ? tr.delta : undefined);
      if (amount !== undefined) line.amount = (line.amount ?? 0) + amount;
      line.transitionIds.push(tr.id);
      lines.set(key, line);
    }
  }

  return { net, lines: [...lines.values()] };
}
