// Every game number, from 01 › Config values. Change numbers here only (see inheritance-balance).

import type { FounderConfig } from '../worldgen/founder';

export const CONFIG = {
  // World defaults (decision 007)
  turnSeconds: 600,
  generationCount: 6,

  // Stamina, upkeep, soft fail
  baseStamina: 100,
  upkeepFood: 12,
  upkeepWater: 10,
  weakenFactor: 0.6,
  minStaminaPct: 0.4,
  staminaPerFoodEaten: 2, // harvest and eat (decision 003)

  // Actions
  harvestCost: 5,
  cropYield: 5,
  orchardYield: 15, // once per generation
  plantCropsCost: 8,
  plantCropsWater: 1,
  cropRipenPct: 0.25, // fraction of turnSeconds
  plantOrchardCost: 25,
  plantOrchardWater: 5,
  orchardMatureGens: 2,
  repairReservoirCost: 60,
  reservoirIncomeCracked: 4,
  reservoirIncomeRepaired: 12,
  digWellCost: 20,
  digWellWater: 8,
  wellIncome: 6,
  fishHuntCost: 8,
  fishHuntYield: 4,
  maintainCost: 10,
  fastTrackMultiplier: 2,

  // Decay and wear
  foodRotPct: 0.3,
  waterStagnatePct: 0.2,
  waterStagnateStagnantWellPct: 0.4,
  wearHalveAt: 2,
  wearBreakAt: 3,
  wildRegrow: 1,

  // Events (decision 005; drought timing decision 008)
  droughtLengthFraction: 0.1,
  droughtMaxLength: 5,
  droughtIncomeMult: 0.3,
  droughtEvaporatePct: 0.25,
  goodHarvestMult: 1.5,
  stormWear: 1,
  stormChance: 0.5,

  // Biomes: founder starter state
  biomes: {
    forest: { food: 12, water: 16, wildStock: 8, wildCap: 10, storm: false },
    island: { food: 12, water: 18, wildStock: 8, wildCap: 8, storm: true },
  },
} as const;

export type Config = typeof CONFIG;

/** CONFIG as worldgen's founderState input. Stops compiling if a founder number goes missing. */
export const FOUNDER_CONFIG: FounderConfig = CONFIG;
