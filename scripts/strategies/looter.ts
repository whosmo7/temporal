// Takes everything it can today (decision 039): farms, hunts the wild spot bare, and keeps all but
// the night's food for itself. Invests in nothing.

import { CONFIG } from '../../src/engine';
import { cropCycles, type PlannedAction, type Strategy } from './run';
import { takes } from './skimmer';

export const looter: Strategy = {
  name: 'looter',
  plan(state) {
    const plan: PlannedAction[] = cropCycles(state, 1);
    for (let i = 0; i < state.wildStock; i++) plan.push({ type: 'fishHunt', plotId: 'wild', t: 1 + i });
    return plan;
  },
  dusk(state) {
    return takes(state.resources.food - CONFIG.upkeepFood, state.turnSeconds);
  },
};
