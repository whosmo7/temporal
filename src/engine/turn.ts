// beginTurn and endTurn (02 › Engine API). The order of beginTurn's steps is part of the contract:
// changing it changes outcomes, so raise any reorder as an open question first.

import { CONFIG } from './config';
import { resolveDue } from './effects';
import {
  builtCause,
  cloneState,
  emptyTally,
  event,
  eventAt,
  isBuilt,
  reservoirProtects,
  rule,
  setEffectStatus,
  setResource,
  setStage,
  setWear,
  setWorld,
  settleStage,
  wellStagnant,
} from './state';
import { createRecorder, type Recorder } from './transitions';
import type { Cause, EndTurnResult, StepResult, WorldState } from './types';

/**
 * Applies the between-generation rules for `state.turn`. Gen 1 starts from the founder state
 * exactly, so it applies no decay, wear or income (01 › Decay & wear).
 */
export function beginTurn(state: WorldState): StepResult {
  const next = cloneState(state);
  const n = next.turn;
  const rec = createRecorder(`begin-${n}`, { turn: n });
  next.tally = emptyTally();

  if (n > 1) {
    // 1. Resolve pending effects due at turn n
    resolveDue(next, rec, { turn: n, t: 0 });
    growSaplings(next, rec);

    // 2. Apply seeded events for turn n
    applyEvents(next, rec);

    // 3. Structure wear +1 (unless maintained last turn)
    applyWear(next, rec);

    // 4. Food rot, water stagnation, hunger
    applyDecay(next, rec);

    // 5. Resource income (reservoir, well), reduced by wear and events
    applyIncome(next, rec);

    // 6. Wild stock regrowth
    const regrown = Math.min(next.wildCap, next.wildStock + CONFIG.wildRegrow);
    setWorld(next, rec, 'wildStock', regrown, [rule('regrow')]);
  }

  // 7. Starting stamina, applying `weakened`
  applyStartingStamina(next, rec);

  return { state: next, transitions: rec.transitions };
}

/** An orchard one generation from fruiting shows as `young`. */
function growSaplings(state: WorldState, rec: Recorder): void {
  for (const plot of Object.values(state.plots)) {
    if (plot.kind !== 'orchard' || plot.stage !== 'sapling' || !plot.builtBy) continue;
    if (state.turn > plot.builtBy.committedTurn) setStage(rec, plot, 'young', [plot.builtBy]);
  }
}

function applyEvents(state: WorldState, rec: Recorder): void {
  const storm = eventAt(state, 'storm');
  if (storm) {
    for (const plot of Object.values(state.plots)) {
      if (!isBuilt(plot)) continue;
      setWear(rec, plot, plot.wear + CONFIG.stormWear, [event(storm)]);
      settleStage(state, rec, plot, [event(storm)]);
    }
  }

  const drought = eventAt(state, 'drought');
  if (drought && !reservoirProtects(state)) {
    const water = state.resources.water;
    const after = water - Math.round(water * CONFIG.droughtEvaporatePct);
    setResource(state, rec, 'water', after, [event(drought)]);
  }
  // goodHarvest has no between-turn effect; harvest reads it.
}

function applyWear(state: WorldState, rec: Recorder): void {
  for (const plot of Object.values(state.plots)) {
    if (!isBuilt(plot) || plot.lastMaintainedTurn === state.turn - 1) continue;
    setWear(rec, plot, plot.wear + 1, [rule('wear')]);
    settleStage(state, rec, plot, [rule('wear')]);
  }
}

function applyDecay(state: WorldState, rec: Recorder): void {
  const food = state.resources.food;
  setResource(state, rec, 'food', food - Math.round(food * CONFIG.foodRotPct), [rule('foodRot')]);

  const water = state.resources.water;
  const pct = wellStagnant(state) ? CONFIG.waterStagnateStagnantWellPct : CONFIG.waterStagnatePct;
  setResource(state, rec, 'water', water - Math.round(water * pct), [rule('waterStagnate')]);

  // Hunger carries from the last generation and drops at each new one (decision 016).
  const hunger = Math.max(0, state.resources.hunger - CONFIG.hungerDropPerGen);
  setResource(state, rec, 'hunger', hunger, [rule('hunger')]);
}

function applyIncome(state: WorldState, rec: Recorder): void {
  const reservoir = state.plots['reservoir'];
  if (reservoir) {
    const repaired = isBuilt(reservoir);
    const base: number = repaired ? CONFIG.reservoirIncomeRepaired : CONFIG.reservoirIncomeCracked;
    const causes: Cause[] = [rule('income', base), ...builtCause(reservoir)];
    let income: number = base;
    if (repaired && reservoir.wear >= CONFIG.wearHalveAt) {
      const halved = Math.round(base / 2);
      causes.push(rule('wear', halved - income));
      income = halved;
    }
    const drought = eventAt(state, 'drought');
    if (drought && !reservoirProtects(state)) {
      const dried = Math.round(income * CONFIG.droughtIncomeMult);
      causes.push(event(drought, dried - income));
      income = dried;
    }
    setResource(state, rec, 'water', state.resources.water + income, causes);
  }

  const well = state.plots['well'];
  if (well && well.stage === 'clear') {
    const causes: Cause[] = [rule('income', CONFIG.wellIncome), ...builtCause(well)];
    let income: number = CONFIG.wellIncome;
    if (well.wear >= CONFIG.wearHalveAt) {
      const halved = Math.round(income / 2);
      causes.push(rule('wear', halved - income));
      income = halved;
    }
    setResource(state, rec, 'water', state.resources.water + income, causes);
  }
}

function applyStartingStamina(state: WorldState, rec: Recorder): void {
  const full = CONFIG.baseStamina;
  const reduced = Math.round(full * (1 - state.weakened * CONFIG.weakenFactor));
  const stamina = Math.max(reduced, Math.round(full * CONFIG.minStaminaPct));
  const causes: Cause[] = [rule('newTurn', full - state.resources.stamina)];
  if (stamina < full) causes.push(rule('weakened', stamina - full));
  setResource(state, rec, 'stamina', stamina, causes);
}

/**
 * Freezes the turn: crops still in the ground rot, upkeep is paid, and the shortfall becomes the
 * next player's `weakened`. Returns the realised-only summary and moves `turn` on by one.
 */
export function endTurn(state: WorldState): EndTurnResult {
  const next = cloneState(state);
  const n = next.turn;
  const rec = createRecorder(`end-${n}`, { turn: n, t: next.turnSeconds });

  // Anything due by the final second still lands.
  resolveDue(next, rec, { turn: n, t: next.turnSeconds });

  // Unharvested crops rot
  let cropsRotted = 0;
  for (const plot of Object.values(next.plots)) {
    if (plot.kind !== 'field' || (plot.stage !== 'sown' && plot.stage !== 'ripe')) continue;
    setStage(rec, plot, 'rotten', [rule('foodRot'), ...builtCause(plot)]);
    plot.builtBy = null;
    cropsRotted++;
  }
  for (const effect of next.pending) {
    if (effect.kind === 'cropRipe' && effect.status === 'pending') {
      setEffectStatus(rec, effect, 'cancelled', [rule('foodRot')]);
    }
  }

  // Upkeep
  const foodPaid = Math.min(next.resources.food, CONFIG.upkeepFood);
  const waterPaid = Math.min(next.resources.water, CONFIG.upkeepWater);
  setResource(next, rec, 'food', next.resources.food - foodPaid, [rule('upkeep')]);
  setResource(next, rec, 'water', next.resources.water - waterPaid, [rule('upkeep')]);

  // Shortfall ratio, averaged over food and water
  const shortfall =
    ((CONFIG.upkeepFood - foodPaid) / CONFIG.upkeepFood +
      (CONFIG.upkeepWater - waterPaid) / CONFIG.upkeepWater) /
    2;
  setWorld(next, rec, 'weakened', shortfall, [rule('upkeep')]);

  const { tally } = next;
  const summary = {
    turn: n,
    spent: { stamina: tally.staminaSpent, water: tally.waterSpent },
    gained: { food: tally.foodGained, water: tally.waterGained },
    foodEaten: tally.foodEaten,
    upkeep: {
      food: { required: CONFIG.upkeepFood, paid: foodPaid },
      water: { required: CONFIG.upkeepWater, paid: waterPaid },
      met: shortfall === 0,
    },
    weakenedNext: shortfall,
    cropsRotted,
  };

  next.turn = n + 1;
  return { state: next, transitions: rec.transitions, summary };
}
