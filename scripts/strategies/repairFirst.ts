// The reservoir-dilemma probe: repair whenever it isn't full, then feed with what's left.

import { cropCycles, type PlannedAction, type Strategy } from './run';

export const repairFirst: Strategy = {
  name: 'repairFirst',
  plan(state) {
    const plan: PlannedAction[] = [];
    const reservoir = state.plots['reservoir'];
    if (reservoir?.stage !== 'full') {
      plan.push({ type: 'repairReservoir', plotId: 'reservoir', t: 0 });
    } else if (reservoir.wear >= 1) {
      plan.push({ type: 'maintain', plotId: 'reservoir', t: 0 });
    }
    plan.push(...cropCycles(state, 1).map((a) => ({ ...a, t: a.t + 1 })));
    return plan;
  },
};
