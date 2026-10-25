// A world's score (decision 037): counted from what happened, so any finished world can be scored
// from its stored history, including worlds finished before scoring existed. The server counts the
// same five things in SQL (`list_completed_worlds`); the weights live only in config.

import { CONFIG } from './config';
import type { ActionEntry, Transition } from './types';

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
