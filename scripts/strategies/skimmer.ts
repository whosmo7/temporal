// The planter's day, then keeps for itself whatever the store holds beyond the night and a reserve
// (decision 033): selfish only with what the next player can most easily spare.

import { CONFIG } from '../../src/engine';
import { planter } from './planter';
import type { PlannedAction, Strategy } from './run';

export const skimmer: Strategy = {
  name: 'skimmer',
  plan: planter.plan,
  dusk(state) {
    const keep = CONFIG.upkeepFood * (1 + CONFIG.score.foodReserveNights);
    return takes(state.resources.food - keep, state.turnSeconds);
  },
};

/** `n` takes at the oven at time `t`. */
export function takes(n: number, t: number): PlannedAction[] {
  return Array.from({ length: Math.max(0, Math.floor(n / CONFIG.takeFood)) }, () => ({ type: 'take' as const, t }));
}
