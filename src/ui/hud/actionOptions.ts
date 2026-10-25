// What the player can do at the plot they're standing by (04 › Interaction model). Pure: it reads
// only `visibleView()` and asks the engine (through `check`) whether each action would work now.

import { CONFIG, type ActionType, type PlotId, type PlotKind, type VisibleWorld } from '../../engine';
import type { ActionRequest } from '../../store/game';
import { HOTBAR, promptLabel } from './copy';

export interface ActionOption {
  /** `E` for the default, `F` to hurry, else the hotbar number. */
  key: string;
  request: ActionRequest;
  label: string;
  cost: { stamina: number; water: number };
  /** The engine's reason it can't be done now, shown as is. */
  error: string | null;
}

/** Engine `check` for a request: the error it would give, or null. */
export type Check = (request: ActionRequest) => string | null;

/**
 * The prompt's rows for one plot, default first. Only actions that fit what the plot looks like
 * are listed (no "Sow crops" on a sown field); those that still can't be done right now, say for
 * want of stamina, stay in the list greyed out with the engine's reason.
 */
export function plotOptions(view: VisibleWorld, plot: { id: PlotId; kind: PlotKind }, check: Check): ActionOption[] {
  const stage = view.plots[plot.id]?.stage;
  const pending = view.fastTrackable.find((e) => e.plotId === plot.id);
  const rows: { type: ActionType }[] = [];
  // At a water source the can comes first while it has room (decision 027).
  const fill = view.resources.can < CONFIG.canCapacity ? [{ type: 'fillCan' as const }] : [];
  switch (plot.kind) {
    case 'field':
      // Sow, water, wait, harvest; a rotten or withered tile is tended (cleared and tilled) first.
      if (stage === 'ripe') rows.push({ type: 'harvest' });
      else if (stage === 'empty') rows.push({ type: 'plantCrops' });
      else if (stage === 'sown') rows.push({ type: 'water' });
      else if (stage === 'rotten' || stage === 'withered') rows.push({ type: 'maintain' });
      break;
    case 'orchard':
      if (stage === 'empty' || stage === 'dead') rows.push({ type: 'plantOrchard' });
      else {
        if (stage === 'fruiting' || stage === 'worn') rows.push({ type: 'harvest' });
        rows.push({ type: 'maintain' });
      }
      break;
    case 'reservoir':
      rows.push(...fill);
      if (stage === 'cracked') {
        if (!pending) rows.push({ type: 'repairReservoir' });
      } else rows.push({ type: 'maintain' });
      break;
    case 'well':
      if (stage === 'none') rows.push({ type: 'digWell' });
      else rows.push(...fill, { type: 'maintain' });
      break;
    case 'wild':
      rows.push({ type: 'fishHunt' });
      break;
    default:
      return [];
  }

  const options = rows.map(({ type }, i): ActionOption => {
    const request: ActionRequest = { type, plotId: plot.id };
    return {
      key: i === 0 ? 'E' : String(HOTBAR.indexOf(type) + 1),
      request,
      label: promptLabel(type, plot.kind, view.biome),
      cost: costOf(type),
      error: check(request),
    };
  });
  if (pending) {
    const request: ActionRequest = { type: 'fastTrack', targetEffectId: pending.effectId };
    options.push({
      key: 'F', // never the default: hurrying costs double
      request,
      label: promptLabel('fastTrack', plot.kind, view.biome),
      cost: pending.cost,
      error: check(request),
    });
  }
  return options;
}

/** Facing a pond or the sea: fill the can there, while it has room (decision 027). */
export function waterEdgeOptions(view: VisibleWorld, check: Check): ActionOption[] {
  if (view.resources.can >= CONFIG.canCapacity) return [];
  const request: ActionRequest = { type: 'fillCan' };
  return [{ key: 'E', request, label: promptLabel('fillCan', 'well', view.biome), cost: costOf('fillCan'), error: check(request) }];
}

/** At the oven in the house: a meal from the store (decision 029). Greyed out when the store is empty. */
export function ovenOptions(view: VisibleWorld, check: Check): ActionOption[] {
  const request: ActionRequest = { type: 'eat' };
  return [{ key: 'E', request, label: promptLabel('eat', 'field', view.biome), cost: costOf('eat'), error: check(request) }];
}

/** What an action costs up front (Fast Track's price comes from its effect). */
export function costOf(type: ActionType): { stamina: number; water: number } {
  switch (type) {
    case 'harvest':
      return { stamina: CONFIG.harvestCost, water: 0 };
    case 'plantCrops':
      return { stamina: CONFIG.plantCropsCost, water: CONFIG.plantCropsWater };
    case 'plantOrchard':
      return { stamina: CONFIG.plantOrchardCost, water: CONFIG.plantOrchardWater };
    case 'repairReservoir':
      return { stamina: CONFIG.repairReservoirCost, water: 0 };
    case 'digWell':
      return { stamina: CONFIG.digWellCost, water: 0 };
    case 'fishHunt':
      return { stamina: CONFIG.fishHuntCost, water: 0 };
    case 'maintain':
      return { stamina: CONFIG.maintainCost, water: 0 };
    case 'fastTrack':
    case 'water':
    case 'fillCan':
    case 'eat':
      return { stamina: 0, water: 0 };
  }
}
