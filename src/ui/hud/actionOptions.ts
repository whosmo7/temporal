// What the player can do at the plot they're standing by (04 › Interaction model). Pure: it reads
// only `visibleView()` and asks the engine (through `check`) whether each action would work now.

import { CONFIG, type ActionType, type PlotId, type PlotKind, type VisibleWorld } from '../../engine';
import type { ActionRequest } from '../../store/game';
import { HOTBAR, promptLabel } from './copy';

export interface ActionOption {
  /** `E` for the default, `Q` to eat, `F` to hurry, else the hotbar number. */
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
  const rows: { type: ActionType; eat?: boolean }[] = [];
  switch (plot.kind) {
    case 'field':
      if (stage === 'ripe') rows.push({ type: 'harvest' }, { type: 'harvest', eat: true });
      else if (stage === 'empty' || stage === 'rotten') rows.push({ type: 'plantCrops' });
      break;
    case 'orchard':
      if (stage === 'empty' || stage === 'dead') rows.push({ type: 'plantOrchard' });
      else {
        if (stage === 'fruiting' || stage === 'worn') rows.push({ type: 'harvest' }, { type: 'harvest', eat: true });
        rows.push({ type: 'maintain' });
      }
      break;
    case 'reservoir':
      if (stage === 'cracked') {
        if (!pending) rows.push({ type: 'repairReservoir' });
      } else rows.push({ type: 'maintain' });
      break;
    case 'well':
      rows.push({ type: stage === 'none' ? 'digWell' : 'maintain' });
      break;
    case 'wild':
      rows.push({ type: 'fishHunt' });
      break;
    default:
      return [];
  }

  const options = rows.map(({ type, eat }, i): ActionOption => {
    const request: ActionRequest = eat ? { type, plotId: plot.id, eat } : { type, plotId: plot.id };
    return {
      key: eat ? 'Q' : i === 0 ? 'E' : String(HOTBAR.indexOf(type) + 1),
      request,
      label: promptLabel(type, plot.kind, view.biome, eat),
      cost: costOf(type, eat),
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

/** What an action costs up front (Fast Track's price comes from its effect). */
export function costOf(type: ActionType, eat = false): { stamina: number; water: number } {
  switch (type) {
    case 'harvest':
      return { stamina: eat ? CONFIG.harvestEatCost : CONFIG.harvestCost, water: 0 };
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
      return { stamina: 0, water: 0 };
  }
}
