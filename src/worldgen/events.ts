import { WorldgenError } from './options';
import { deriveRng } from './rng';
import type { Biome } from './types';

// `SeededEventKind` matches inheritance-core ids.md. Move to src/engine/types.ts once it exists.
export type SeededEventKind = 'drought' | 'goodHarvest' | 'storm';

/**
 * One event in one generation. A drought that spans several generations is one entry per
 * generation, so `beginTurn` step 2 only ever looks at `turn === n`. Entries of the same
 * drought share `spellId`.
 */
export interface SeededEvent {
  id: string; // `${kind}-${turn}`, e.g. 'drought-4'
  kind: SeededEventKind;
  turn: number;
  spellId?: string;
}

/** Numbers from config.ts (decisions 005 and 008); the caller passes them in. */
export interface EventConfig {
  generationCount: number;
  /** Drought length = ceil(generationCount × this), capped at droughtMaxLength. */
  droughtLengthFraction: number;
  droughtMaxLength: number;
  /** Chance of one storm per world, on biomes where `storm` is true. */
  stormChance: number;
  stormBiomes: Record<Biome, boolean>;
}

/**
 * The world's full event list, fixed at creation from the seed (decisions 005, 008):
 * - **Drought:** exactly one, `min(droughtMaxLength, ceil(gens × fraction))` consecutive
 *   generations, starting at a random gen ≥ 2 and ending by the last (gen 1 only in a 1-gen world).
 * - **Good harvest:** one, in a random generation outside the drought (none if there isn't one).
 * - **Storm:** biome-gated, `stormChance` of one, in a random generation outside the drought.
 *
 * Draws happen in that order from one stream, so Forest and Island with the same seed share
 * their drought and good harvest.
 */
export function generateEvents(seed: number, biome: Biome, cfg: EventConfig): SeededEvent[] {
  const gens = cfg.generationCount;
  if (!Number.isInteger(gens) || gens < 1) throw new WorldgenError(`generationCount must be an integer >= 1, got ${gens}`);
  if (!Number.isInteger(cfg.droughtMaxLength) || cfg.droughtMaxLength < 1) {
    throw new WorldgenError(`droughtMaxLength must be an integer >= 1, got ${cfg.droughtMaxLength}`);
  }
  const rng = deriveRng(seed >>> 0, 'events');

  const length = Math.min(cfg.droughtMaxLength, gens, Math.max(1, Math.ceil(gens * cfg.droughtLengthFraction)));
  const firstStart = Math.min(2, gens - length + 1);
  const start = rng.int(firstStart, gens - length + 2);
  const droughtTurns = Array.from({ length }, (_, i) => start + i);
  const spellId = `drought-${start}`;
  const events: SeededEvent[] = droughtTurns.map((turn) => ({ id: `drought-${turn}`, kind: 'drought', turn, spellId }));

  const clear = Array.from({ length: gens }, (_, i) => i + 1).filter((t) => !droughtTurns.includes(t));
  if (clear.length > 0) {
    const turn = rng.pick(clear);
    events.push({ id: `goodHarvest-${turn}`, kind: 'goodHarvest', turn });
  }
  // Always draw, so turning storms off for a biome doesn't shift anything drawn after.
  const stormRoll = rng.next();
  const stormTurn = clear.length > 0 ? rng.pick(clear) : 0;
  if (cfg.stormBiomes[biome] && stormRoll < cfg.stormChance && stormTurn > 0) {
    events.push({ id: `storm-${stormTurn}`, kind: 'storm', turn: stormTurn });
  }

  return events.sort((a, b) => a.turn - b.turn || (a.kind < b.kind ? -1 : 1));
}
