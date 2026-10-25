// Every game number, from 01 › Config values. Change numbers here only (see inheritance-balance).

import type { FounderConfig } from '../worldgen/founder';

export const CONFIG = {
  // World defaults (decision 007)
  turnSeconds: 120, // a two-minute day (decision 028; was 600)
  generationCount: 6,

  // Stamina, upkeep, soft fail
  baseStamina: 100,
  upkeepFood: 12,
  upkeepWater: 0, // nights take food only (decision 027; was 10)
  weakenFactor: 0.6,
  minStaminaPct: 0.4,

  // Hunger (decision 016): carried across generations, drops at each new generation, eating refills it
  hungerMax: 100,
  hungerDropPerGen: 30,
  hungerPerFoodEaten: 10, // harvest and eat (decisions 003, 016)
  hungerSlowAt: 0, // at or below this the player walks slower
  hungrySpeedMult: 0.6,

  // Actions. Stamina costs are 0 for now: actions take time instead (decision 019). Fields and
  // orchards are worked per tile, so their numbers are per field tile and per tree.
  harvestCost: 0, // was 5
  harvestEatCost: 0, // harvest and eat costs no stamina (decision 016)
  cropYield: 1, // per field tile (was 5 per field)
  orchardYield: 4, // per tree, once per generation (was 15 per orchard)
  plantCropsCost: 0, // was 8
  plantCropsWater: 0, // sowing a tile is free (decision 019; was 1 per field)
  cropRipenSeconds: 60, // a watered tile ripens a minute later (decision 028; was 25% of the day)
  overnightGrowth: 0.5, // a crop still growing at day's end carries over with this much of its time left (decision 028)
  canCapacity: 4, // pours; the can starts each turn empty (decision 027)
  witherGens: 2, // a sown tile nobody waters withers this many generations after planting
  plantOrchardCost: 0, // was 25
  plantOrchardWater: 1, // per tree (was 5 per orchard)
  orchardMatureGens: 2,
  repairReservoirCost: 0, // was 60
  reservoirIncomeCracked: 4,
  reservoirIncomeRepaired: 12,
  digWellCost: 0, // was 20
  digWellWater: 8,
  wellIncome: 6,
  fishHuntCost: 0, // was 8
  fishHuntYield: 4,
  maintainCost: 0, // was 10
  fastTrackMultiplier: 2,

  // How long each action takes, in turn seconds. The player stands still while it happens and it
  // lands at the end (decision 019). The client waits; the engine applies it at the end time.
  actionSeconds: {
    harvest: 1,
    plantCrops: 1.5,
    plantOrchard: 3,
    repairReservoir: 8,
    digWell: 6,
    fishHunt: 3,
    maintain: 3,
    fastTrack: 2,
    water: 1,
    fillCan: 1.5,
  },

  // Decay and wear
  foodRotPct: 0, // decision 011: stored food (the house cabinet) doesn't rot for now; was 0.3
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
