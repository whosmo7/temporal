// Plays a world with a scripted strategy, one plan per generation. Used by simulate.ts and as
// balance fixtures (inheritance-balance). Rejected planned actions are skipped, like a player
// who runs out of stamina.

import {
  applyAction,
  CONFIG,
  beginTurn,
  createWorld,
  endTurn,
  type ActionInput,
  type Biome,
  type TurnSummary,
  type WorldState,
} from '../../src/engine';

export type PlannedAction = Pick<ActionInput, 'type' | 'plotId' | 'targetEffectId' | 'eat'> & {
  t: number;
};

export interface Strategy {
  name: string;
  /** What to try this generation, given the state the player inherits. */
  plan(state: WorldState): PlannedAction[];
}

export interface GenRow {
  gen: number;
  /** Stores and stamina at the start of the generation, after decay and income. */
  start: WorldState['resources'];
  summary: TurnSummary;
  end: WorldState;
}

export interface RunOptions {
  seed: number;
  biome: Biome;
  gens: number;
  /** Start from this state instead of a fresh world (e.g. the medium-world scenario). */
  from?: WorldState;
}

export function runStrategy(strategy: Strategy, opts: RunOptions): GenRow[] {
  let state =
    opts.from ??
    createWorld(opts.seed, { worldId: 'sim', biome: opts.biome, generationCount: opts.gens }).state;
  const rows: GenRow[] = [];
  const last = state.turn + opts.gens - 1;

  while (state.turn <= last) {
    const gen = state.turn;
    state = beginTurn(state).state;
    const start = { ...state.resources };
    strategy
      .plan(state)
      .sort((a, b) => a.t - b.t)
      .forEach((action, seq) => {
        const result = applyAction(
          state,
          { ...action, id: `${gen}-${seq}`, actorId: `${strategy.name}-${gen}`, seq },
          action.t,
        );
        if (!result.error) state = result.state;
      });
    const ended = endTurn(state);
    state = ended.state;
    rows.push({ gen, start, summary: ended.summary, end: state });
  }
  return rows;
}

/** Two back-to-back crop cycles per field: plant, harvest once ripe, replant. */
export function cropCycles(state: WorldState, cycles: number, eat = false): PlannedAction[] {
  const ripen = Math.ceil(state.turnSeconds * CONFIG.cropRipenPct);
  const out: PlannedAction[] = [];
  for (const plotId of ['field-1', 'field-2']) {
    for (let c = 0; c < cycles; c++) {
      const t = c * (ripen + 1);
      out.push({ type: 'plantCrops', plotId, t });
      out.push({ type: 'harvest', plotId, t: t + ripen, eat });
    }
  }
  return out;
}
