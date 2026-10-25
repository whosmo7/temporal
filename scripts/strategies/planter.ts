// Invests for later players: orchard and reservoir first, keeps them maintained, eats the orchard.

import { CONFIG } from '../../src/engine';
import { growTiles, tilesOf, type PlannedAction, type Strategy } from './run';

export const planter: Strategy = {
  name: 'planter',
  plan(state) {
    const plan: PlannedAction[] = [];
    const reservoir = state.plots['reservoir'];

    // Every tree in the orchard, one at a time (decision 019).
    for (const tree of tilesOf(state, 'orchard-1')) {
      if (tree.stage === 'empty' || tree.stage === 'dead') {
        plan.push({ type: 'plantOrchard', plotId: tree.id, t: 0 });
      } else if (tree.stage === 'fruiting') {
        plan.push({ type: 'harvest', plotId: tree.id, t: 0, eat: true });
      }
      if (tree.wear >= 1) plan.push({ type: 'maintain', plotId: tree.id, t: 1 });
    }

    if (reservoir?.stage !== 'full') {
      plan.push({ type: 'repairReservoir', plotId: 'reservoir', t: 2 });
    } else if (reservoir.wear >= 1) {
      plan.push({ type: 'maintain', plotId: 'reservoir', t: 2 });
    }

    plan.push(...growTiles(tilesOf(state, 'field-1'), 3, CONFIG.cropRipenSeconds));
    return plan;
  },
};
