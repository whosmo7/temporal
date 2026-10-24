// Stockpiles food and water: keeps the well going, farms crops, never invests in the long term.

import { cropCycles, type PlannedAction, type Strategy } from './run';

export const hoarder: Strategy = {
  name: 'hoarder',
  plan(state) {
    const plan: PlannedAction[] = [];
    const well = state.plots['well'];
    if (well?.stage === 'none') plan.push({ type: 'digWell', plotId: 'well', t: 0 });
    else if (well && well.wear >= 1) plan.push({ type: 'maintain', plotId: 'well', t: 0 });
    plan.push(...cropCycles(state, 2));
    return plan;
  },
};
