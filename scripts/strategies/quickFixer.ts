// Fixes today's shortfall the fastest way: digs the well, fishes or hunts freely, keeps the well.

import type { PlannedAction, Strategy } from './run';

export const quickFixer: Strategy = {
  name: 'quickFixer',
  plan(state) {
    const plan: PlannedAction[] = [];
    const well = state.plots['well'];
    if (well?.stage === 'none') plan.push({ type: 'digWell', plotId: 'well', t: 0 });
    else if (well && well.wear >= 1) plan.push({ type: 'maintain', plotId: 'well', t: 0 });
    for (let i = 0; i < state.wildStock; i++) {
      plan.push({ type: 'fishHunt', plotId: 'wild', t: 1 + i });
    }
    return plan;
  },
};
