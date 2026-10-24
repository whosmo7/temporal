// Builds a new world's gen-1 state from the seed (02 › Engine API). Pure: same seed + options = same world.

import { biomeFromSeed, founderState } from '../worldgen';
import type { WorldgenPreset } from '../worldgen/options';
import type { PresetName } from '../worldgen/presets';
import { CONFIG } from './config';
import { emptyTally } from './state';
import { TILED_KINDS, tileId } from './tiles';
import type { Biome, PlotStage, PlotState, StepResult, WorldState } from './types';

export interface CreateWorldOptions {
  worldId: string;
  /** Defaults to the biome the seed picks. */
  biome?: Biome;
  preset?: WorldgenPreset | PresetName;
  generationCount?: number;
  turnSeconds?: number;
}

export function createWorld(seed: number, opts: CreateWorldOptions): StepResult {
  const biome = opts.biome ?? biomeFromSeed(seed);
  const generationCount = opts.generationCount ?? CONFIG.generationCount;

  // Events depend on the world's length, so pass the real generation count to worldgen.
  const founder = founderState(seed, biome, { ...CONFIG, generationCount }, opts.preset);

  const plots: Record<string, PlotState> = {};
  const blank = (id: string, kind: PlotState['kind'], stage: string | undefined): PlotState => ({
    id,
    kind,
    // Worldgen's FOUNDER_STAGE uses the ids.md stage names, which PlotStage lists.
    stage: stage as PlotStage | undefined,
    wear: 0,
    lastMaintainedTurn: null,
    builtBy: null,
    harvestedTurn: null,
  });
  for (const [id, plot] of Object.entries(founder.plots)) {
    const rect = founder.map.plots.find((p) => p.id === id);
    if (!rect || !TILED_KINDS.has(plot.kind)) {
      plots[id] = blank(id, plot.kind, plot.stage);
      continue;
    }
    // Fields and orchards: one plot per tile, each starting at the plot's founder stage (decision 019).
    for (let y = 0; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        const tile = tileId(id, x, y);
        plots[tile] = { ...blank(tile, plot.kind, plot.stage), tile: { plot: id, x, y } };
      }
    }
  }

  const state: WorldState = {
    worldId: opts.worldId,
    seed: founder.map.seed,
    biome,
    turn: 1,
    generationCount,
    turnSeconds: opts.turnSeconds ?? CONFIG.turnSeconds,
    resources: { ...founder.resources },
    plots,
    pending: [],
    wildStock: founder.wildStock,
    wildCap: founder.wildCap,
    weakened: 0,
    events: founder.events,
    tally: emptyTally(),
  };

  // The founder state is where the replay starts, so nothing has changed yet.
  return { state, transitions: [] };
}
