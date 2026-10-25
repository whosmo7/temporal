// Scores, shown only once a world has finished.
// - A world's score (decision 037): counted from what happened, so any finished world can be scored
//   from its stored history, including worlds finished before scoring existed. The server counts the
//   same five things in SQL (`list_completed_worlds`); the weights live only in config.
// - Each player's score (decision 039): worked out once per generation, from the world that player
//   hands over after their own night's upkeep, and locked into `state.scores`. Later generations
//   append their own entry and never touch an earlier one.

import { CONFIG } from './config';
import type { ActionEntry, GenerationScore, PlotState, Transition, WorldState } from './types';

/** The things a score counts, over a whole world. */
export interface ScoreTally {
  cropsHarvested: number;
  treesHarvested: number;
  catches: number;
  cropsRotted: number;
  seedsWithered: number;
}

export const NO_TALLY: ScoreTally = { cropsHarvested: 0, treesHarvested: 0, catches: 0, cropsRotted: 0, seedsWithered: 0 };

/** `field-1:2,0` and `field-1` are both a field. */
const kindOf = (plotId: string | undefined) => plotId?.split(':')[0]?.replace(/-\d+$/, '');

/** Counts a world's harvests, catches, rotted crops and withered seeds from its action and change logs. */
export function tallyHistory(
  actions: readonly Pick<ActionEntry, 'type' | 'plotId'>[],
  transitions: readonly Pick<Transition, 'target' | 'after'>[],
): ScoreTally {
  const tally = { ...NO_TALLY };
  for (const a of actions) {
    if (a.type === 'fishHunt') tally.catches++;
    else if (a.type === 'harvest' && kindOf(a.plotId) === 'field') tally.cropsHarvested++;
    else if (a.type === 'harvest' && kindOf(a.plotId) === 'orchard') tally.treesHarvested++;
  }
  for (const t of transitions) {
    if (!('plot' in t.target) || t.target.field !== 'stage' || kindOf(t.target.plot) !== 'field') continue;
    if (t.after === 'rotten') tally.cropsRotted++;
    else if (t.after === 'withered') tally.seedsWithered++;
  }
  return tally;
}

/** The score for a tally, with config's weights. */
export function worldScore(t: ScoreTally): number {
  const w = CONFIG.score;
  return (
    t.cropsHarvested * w.cropHarvested +
    t.treesHarvested * w.treeHarvested +
    t.catches * w.catch +
    t.cropsRotted * w.cropRotted +
    t.seedsWithered * w.seedWithered
  );
}

// ---- Each player's score (decision 039) ----

/**
 * The world's condition, 0..100, as the next player inherits it: useful reserves (capped, so a
 * hoard counts no more than a couple of nights' food), working infrastructure, and what keeps
 * producing (trees, fields fit to sow, the wild spot). A shortfall at night scales it down.
 */
export function worldCondition(state: WorldState): number {
  const s = CONFIG.playerScore;
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
      return plot.stage === 'sapling' || plot.stage === 'young' ? CONFIG.playerScore.growingTree * worn : 0;
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
  const s = CONFIG.playerScore;
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
