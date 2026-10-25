import { generateEvents, type EventConfig, type SeededEvent } from './events';
import { generateMap } from './generate';
import type { WorldgenPreset } from './options';
import type { PresetName } from './presets';
import type { Biome, PlotId, PlotKind, TileMap } from './types';

/** Per-biome founder numbers from config.ts (`CONFIG.biomes`, `01` › Founder / Gen-1 starter conditions). */
export interface BiomeStart {
  food: number;
  water: number;
  wildStock: number;
  wildCap: number;
  /** Whether this biome can get a storm (decision 005). */
  storm: boolean;
}

export interface FounderConfig extends Omit<EventConfig, 'stormBiomes'> {
  baseStamina: number;
  hungerMax: number;
  biomes: Record<Biome, BiomeStart>;
}

/**
 * How each plot looks at gen 1, as an `ids.md` visual stage. The engine's PlotState is A's to
 * define; this is the starting condition it should encode. Lectern and graveyard have no stage.
 */
export const FOUNDER_STAGE: Partial<Record<PlotKind, string>> = {
  field: 'empty',
  orchard: 'empty',
  reservoir: 'cracked',
  well: 'none',
};

export interface FounderState {
  map: TileMap;
  biome: Biome;
  resources: { food: number; water: number; stamina: number; hunger: number; can: number };
  wildStock: number;
  wildCap: number;
  plots: Record<PlotId, { kind: PlotKind; stage?: string }>;
  events: SeededEvent[];
}

/**
 * Everything worldgen decides about a new world before gen 1: map, biome starter values,
 * plot conditions and the seeded event list. Pure; `createWorld` (02) builds WorldState from it.
 * Gen 1's `beginTurn` applies no decay, wear or income, so this is what the founder sees.
 */
export function founderState(
  seed: number,
  biome: Biome,
  cfg: FounderConfig,
  preset: WorldgenPreset | PresetName = 'default',
): FounderState {
  const map = generateMap(seed, biome, preset);
  const start = cfg.biomes[biome];
  const stormBiomes = { forest: cfg.biomes.forest.storm, island: cfg.biomes.island.storm };
  return {
    map,
    biome,
    resources: { food: start.food, water: start.water, stamina: cfg.baseStamina, hunger: cfg.hungerMax, can: 0 },
    wildStock: start.wildStock,
    wildCap: start.wildCap,
    plots: Object.fromEntries(
      map.plots.map((p) => {
        const stage = FOUNDER_STAGE[p.kind];
        return [p.id, stage ? { kind: p.kind, stage } : { kind: p.kind }];
      }),
    ),
    events: generateEvents(map.seed, biome, { ...cfg, stormBiomes }),
  };
}
