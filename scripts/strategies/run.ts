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
  type PlotState,
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

/** A field's or orchard's tiles, which are planted and picked one at a time (decision 019). */
export function tilesOf(state: WorldState, plot: string): PlotState[] {
  return Object.values(state.plots).filter((p) => p.tile?.plot === plot);
}

/**
 * Sows, waters and harvests `tiles` once: each tile is sown, then watered from the can (filled at
 * a pond whenever it runs dry), then harvested once ripe (decision 027). Starts at `start`.
 */
export function growTiles(tiles: PlotState[], start: number, ripen: number, eat = false): PlannedAction[] {
  const { plantCrops: sow, water: pour, fillCan: fill } = CONFIG.actionSeconds;
  const out: PlannedAction[] = [];
  let t = start;
  tiles.forEach((tile, i) => {
    if (i % CONFIG.canCapacity === 0) {
      out.push({ type: 'fillCan', t });
      t += fill;
    }
    out.push({ type: 'plantCrops', plotId: tile.id, t });
    out.push({ type: 'water', plotId: tile.id, t: t + sow });
    out.push({ type: 'harvest', plotId: tile.id, t: t + sow + ripen, eat });
    t += sow + pour;
  });
  return out;
}

/** Back-to-back crop cycles on every tile of both fields. */
export function cropCycles(state: WorldState, cycles: number, eat = false): PlannedAction[] {
  const ripen = Math.ceil(state.turnSeconds * CONFIG.cropRipenPct);
  const tiles = [...tilesOf(state, 'field-1'), ...tilesOf(state, 'field-2')];
  const { plantCrops: sow, water: pour, fillCan: fill } = CONFIG.actionSeconds;
  const cycle = ripen + tiles.length * (sow + pour + fill) + 1;
  return Array.from({ length: cycles }, (_, c) => growTiles(tiles, c * cycle, ripen, eat)).flat();
}
