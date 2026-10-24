import type { FounderConfig } from '../founder';

/**
 * C's numbers from `01` › Config values (PR #2) and decision 008. Stands in for
 * `src/engine/config.ts` until A adds it; then import CONFIG from there instead.
 */
export const FOUNDER_CONFIG: FounderConfig = {
  generationCount: 6,
  baseStamina: 100,
  droughtLengthFraction: 0.1,
  droughtMaxLength: 5,
  stormChance: 0.5,
  biomes: {
    forest: { food: 12, water: 16, wildStock: 8, wildCap: 10, storm: false },
    island: { food: 12, water: 18, wildStock: 8, wildCap: 8, storm: true },
  },
};
