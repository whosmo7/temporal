// Player-facing words for actions, plots and stages, from docs/content/flavour-text.md (C).
// Change the wording there first, then here.

import type { ActionType, Biome, PlotKind } from '../../engine';

/** Hotbar labels, in slot order (keys 1–8). */
export const HOTBAR: readonly ActionType[] = [
  'harvest',
  'plantCrops',
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
};

/** The interact prompt's words (without the cost, which the prompt adds). */
export function promptLabel(type: ActionType, kind: PlotKind, biome: Biome, eat = false): string {
  switch (type) {
    case 'harvest':
      return eat ? 'Harvest and eat' : 'Harvest';
    case 'plantCrops':
      return 'Sow crops';
    case 'plantOrchard':
      return 'Plant an orchard';
    case 'repairReservoir':
      return 'Repair the reservoir wall';
    case 'digWell':
      return 'Dig a well';
    case 'fishHunt':
      return biome === 'island' ? 'Fish' : 'Hunt';
    case 'maintain':
      return kind === 'well' ? 'Clear the well' : kind === 'reservoir' ? 'Shore up the wall' : 'Prune the trees';
    case 'fastTrack':
      return 'Hurry this along';
  }
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
  field: { empty: 'Bare earth', sown: 'Sown', growing: 'Coming up', ripe: 'Ripe', rotten: 'Rotten' },
  orchard: {
    empty: 'Orchard plot',
    sapling: 'Saplings',
    young: 'Young trees',
    fruiting: 'Fruiting',
    worn: 'Untended trees',
    dead: 'Dead trees',
  },
  reservoir: { cracked: 'Cracked', low: 'Low', full: 'Full' },
  well: { none: 'Soft ground', clear: 'Clear water', stagnant: 'Green water' },
};
const WILD_FOREST: Record<string, string> = { many: 'Tracks everywhere', few: 'A few tracks', none: 'Quiet' };
const WILD_ISLAND: Record<string, string> = { many: 'Fish rising', few: 'The odd fish', none: 'Still water' };
