// Competitive scoring (decision 033). Each generation's score is worked out once, from the world
// that player hands over after their own night's upkeep, and locked into `state.scores`. Later
// generations append their own entry and never touch an earlier one.

import { CONFIG } from './config';
import type { GenerationScore, PlotState, WorldState } from './types';

/**
 * The world's condition, 0..100, as the next player inherits it: useful reserves (capped, so a
 * hoard counts no more than a couple of nights' food), working infrastructure, and what keeps
 * producing (trees, fields fit to sow, the wild spot). A shortfall at night scales it down.
 */
export function worldCondition(state: WorldState): number {
  const s = CONFIG.score;
  const plots = Object.values(state.plots);
  const parts: [number, number][] = [
    [s.weights.food, capped(state.resources.food, CONFIG.upkeepFood * s.foodReserveNights)],
    [s.weights.water, capped(state.resources.water, s.waterReserveCap)],
    [s.weights.infrastructure, mean([state.plots['reservoir'], state.plots['well']].filter(isPlot).map(working))],
    [s.weights.orchards, mean(plots.filter((p) => p.kind === 'orchard').map(working))],
    [s.weights.fields, mean(plots.filter((p) => p.kind === 'field').map(working))],
    [s.weights.wild, state.wildCap > 0 ? capped(state.wildStock, state.wildCap) : 0],
  ];
  const total = parts.reduce((sum, [w]) => sum + w, 0);
  const condition = parts.reduce((sum, [w, v]) => sum + w * v, 0) / total;
  return round(100 * condition * (1 - s.weakenedPenalty * state.weakened));
}

/**
 * How much of its full output a plot gives, 0..1. Broken or empty things count nothing; worn ones
 * count half, as their output is halved.
 */
function working(plot: PlotState): number {
  const worn = plot.wear >= CONFIG.wearHalveAt ? 0.5 : 1;
  switch (plot.kind) {
    case 'reservoir':
      return plot.stage === 'full' ? 1 : plot.stage === 'low' ? 0.5 : 0;
    case 'well':
      return plot.stage === 'clear' ? worn : 0;
    case 'orchard':
      if (plot.stage === 'fruiting') return worn;
      return plot.stage === 'sapling' || plot.stage === 'young' ? CONFIG.score.growingTree * worn : 0;
    case 'field':
      return plot.stage === 'rotten' || plot.stage === 'withered' ? 0 : 1;
    default:
      return 0;
  }
}

/**
 * Generation `turn`'s score from its tally and the world it handed over. Food kept for yourself
 * is taken out of the productive count first, so no unit is counted twice.
 */
export function scoreGeneration(state: WorldState, turn: number): GenerationScore {
  const s = CONFIG.score;
  const { productiveFood, overhuntFood, foodTaken } = state.tally;
  const productive = Math.max(0, productiveFood - foodTaken) * s.productivePerFood;
  const extraction = foodTaken * s.takePerFood + overhuntFood * s.overhuntPerFood;
  const units = foodTaken + overhuntFood;
  const corruption = s.corruptionLinear * units + s.corruptionQuadratic * units * units;
  const condition = worldCondition(state);
  const exitBonus = condition * s.exitBonusPerCondition;
  return {
    turn,
    productive: round(productive),
    extraction: round(extraction),
    corruption: round(corruption),
    condition,
    exitBonus: round(exitBonus),
    total: round(productive + extraction - corruption + exitBonus),
  };
}

const isPlot = (p: PlotState | undefined): p is PlotState => !!p;
const capped = (value: number, cap: number) => Math.max(0, Math.min(value, cap)) / cap;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x: number) => Math.round(x * 10) / 10;
