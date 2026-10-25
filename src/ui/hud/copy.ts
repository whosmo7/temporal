// Player-facing words for actions, plots and stages, from docs/content/flavour-text.md (C).
// Change the wording there first, then here.

import type { ActionType, Biome, PlotKind } from '../../engine';

/** Hotbar labels, in slot order (keys 1–8). */
export const HOTBAR: readonly ActionType[] = [
  'harvest',
  'plantCrops',
  'water',
  'plantOrchard',
  'repairReservoir',
  'digWell',
  'fishHunt',
  'maintain',
  'fastTrack',
];

export function hotbarLabel(type: ActionType, biome: Biome): string {
  if (type === 'fishHunt') return biome === 'island' ? 'Fish' : 'Hunt';
  return HOTBAR_LABEL[type];
}

const HOTBAR_LABEL: Record<ActionType, string> = {
  harvest: 'Harvest',
  plantCrops: 'Sow',
  plantOrchard: 'Plant trees',
  repairReservoir: 'Repair',
  digWell: 'Dig',
  fishHunt: 'Hunt',
  maintain: 'Tend',
  fastTrack: 'Hurry',
  water: 'Water',
  fillCan: 'Fill',
  eat: 'Eat',
  take: 'Keep',
};

/** The interact prompt's words (without the cost, which the prompt adds). */
export function promptLabel(type: ActionType, kind: PlotKind, biome: Biome): string {
  switch (type) {
    case 'harvest':
      return 'Harvest';
    case 'plantCrops':
      return 'Sow crops';
    case 'plantOrchard':
      return 'Plant a tree';
    case 'repairReservoir':
      return 'Repair the reservoir wall';
    case 'digWell':
      return 'Dig a well';
    case 'fishHunt':
      return biome === 'island' ? 'Fish' : 'Hunt';
    case 'maintain':
      if (kind === 'field') return 'Clear and till'; // a rotten or withered tile (decision 027)
      return kind === 'well' ? 'Clear the well' : kind === 'reservoir' ? 'Shore up the wall' : 'Prune the tree';
    case 'fastTrack':
      return 'Hurry this along';
    case 'water':
      return 'Water';
    case 'fillCan':
      return 'Fill the can';
    case 'eat':
      return FARM_TEXT.cook; // at the oven (decision 029)
    case 'take':
      return FARM_TEXT.keep; // at the oven (decision 039)
  }
}

/**
 * One tile of a field or orchard in a list ("Field tile 4", "Tree 2"), numbered across its plot
 * from the top left (decision 019).
 */
export function tileName(kind: PlotKind, n: number): string {
  return kind === 'orchard' ? `Tree ${n}` : `${PLOT_NAME[kind]} tile ${n}`;
}

export function plotName(kind: PlotKind, biome: Biome): string {
  if (kind === 'wild') return biome === 'island' ? 'Rocks' : 'Tree line';
  return PLOT_NAME[kind];
}

const PLOT_NAME: Record<PlotKind, string> = {
  field: 'Field',
  orchard: 'Orchard',
  reservoir: 'Reservoir',
  well: 'Well',
  wild: 'Wild spot',
  lectern: 'Journal',
  graveyard: 'Graveyard',
};

/** Hover names of the visual stages, for the Fast Track menu. */
export function stageName(kind: PlotKind, stage: string | undefined, biome: Biome): string {
  if (!stage) return plotName(kind, biome);
  if (kind === 'wild') return (biome === 'island' ? WILD_ISLAND : WILD_FOREST)[stage] ?? stage;
  return STAGE_NAME[kind]?.[stage] ?? stage;
}

const STAGE_NAME: Partial<Record<PlotKind, Record<string, string>>> = {
  field: {
    empty: 'Tilled earth',
    sown: 'Sown, dry',
    watered: 'Watered',
    growing: 'Coming up',
    ripe: 'Ripe',
    rotten: 'Rotten',
    withered: 'Withered',
  },
  orchard: {
    empty: 'Bare ground',
    sapling: 'Sapling',
    young: 'Young tree',
    fruiting: 'Fruiting',
    worn: 'Untended tree',
    dead: 'Dead tree',
  },
  reservoir: { cracked: 'Cracked', low: 'Low', full: 'Full' },
  well: { none: 'Soft ground', clear: 'Clear water', stagnant: 'Green water' },
};
const WILD_FOREST: Record<string, string> = { many: 'Tracks everywhere', few: 'A few tracks', none: 'Quiet' };
const WILD_ISLAND: Record<string, string> = { many: 'Fish rising', few: 'The odd fish', none: 'Still water' };

/** The land's name for each level, 0–4 (13, decision 023). Shown alone, never as "Level N". */
export const LEVEL_NAMES = ['Bare', 'Taking root', 'Green', 'Blooming', 'Abundant'] as const;

/** Held tools on toolbar slots 1–3 (13). */
export type Tool = 'hands' | 'seeds' | 'can';
export const TOOLS: readonly Tool[] = ['hands', 'seeds', 'can'];

export function toolLabel(tool: Tool, seeds?: number): string {
  if (tool === 'seeds') return seeds === undefined ? 'Seeds' : `Seeds · ${seeds}`;
  return tool === 'hands' ? 'Hands' : 'Can';
}

export const TOOL_TIP: Record<Tool, string> = {
  hands: 'Pick, pull and carry.',
  seeds: 'Seed for the fields.',
  can: 'Fill it at the well, the reservoir, a pond or the sea.',
};

/**
 * Words for the parts of 13 that aren't built yet: seeds and the oven (docs/content/flavour-text.md).
 * Watering and the can's words come from the engine and `promptLabel` (decision 027).
 */
export const FARM_TEXT = {
  cook: 'Cook and eat',
  keep: 'Keep some for yourself',
  noSeeds: 'No seeds left',
  storeEmpty: 'The store is empty',
} as const;
