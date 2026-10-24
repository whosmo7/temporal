// Invests for later players: orchard and reservoir first, keeps them maintained, eats the orchard.

import { CONFIG } from '../../src/engine';
import type { PlannedAction, Strategy } from './run';

export const planter: Strategy = {
  name: 'planter',
  plan(state) {
    const plan: PlannedAction[] = [];
    const orchard = state.plots['orchard-1'];
    const reservoir = state.plots['reservoir'];

    if (orchard?.stage === 'empty' || orchard?.stage === 'dead') {
      plan.push({ type: 'plantOrchard', plotId: 'orchard-1', t: 0 });
    } else if (orchard?.stage === 'fruiting') {
      plan.push({ type: 'harvest', plotId: 'orchard-1', t: 0, eat: true });
    }
    if (orchard && orchard.wear >= 1) plan.push({ type: 'maintain', plotId: 'orchard-1', t: 1 });

    if (reservoir?.stage !== 'full') {
      plan.push({ type: 'repairReservoir', plotId: 'reservoir', t: 2 });
    } else if (reservoir.wear >= 1) {
      plan.push({ type: 'maintain', plotId: 'reservoir', t: 2 });
    }

    plan.push({ type: 'plantCrops', plotId: 'field-1', t: 3 });
    plan.push({
      type: 'harvest',
      plotId: 'field-1',
      t: 3 + state.turnSeconds * CONFIG.cropRipenPct,
    });
    return plan;
  },
};
