// applyAction (02 › Engine API): validates one player action, pays its cost and applies or
// schedules its effect. Rejected actions return `error` and leave the state untouched.

import { CONFIG } from './config';
import { resolveDue, resolveEffect, schedule } from './effects';
import {
  builtCause,
  clampT,
  cloneState,
  event,
  eventAt,
  isBuilt,
  rule,
  setResource,
  setStage,
  setWear,
  setWorld,
  settleStage,
} from './state';
import { createRecorder, type Recorder } from './transitions';
import type {
  ActionCause,
  ActionInput,
  ActionResult,
  Cause,
  PlotState,
  TimePoint,
  WorldState,
} from './types';

interface Ctx {
  state: WorldState;
  rec: Recorder;
  input: ActionInput;
  cause: ActionCause;
  at: TimePoint & { t: number };
  plot: PlotState | undefined;
}

/** A handler returns the action's `dueAt`, or a player-readable reason it can't happen. */
type Handler = (ctx: Ctx) => TimePoint | string;

export function applyAction(state: WorldState, input: ActionInput, t: number): ActionResult {
  const at = { turn: state.turn, t: clampT(state, t) };
  const next = cloneState(state);
  const rec = createRecorder(input.id, at);

  // Crops due by now ripen before the action, so "harvest at 160 s" sees a ripe field.
  resolveDue(next, rec, at);

  const cause: ActionCause = {
    kind: 'action',
    actionId: input.id,
    actorId: input.actorId,
    committedTurn: state.turn,
  };
  const plot = input.plotId ? next.plots[input.plotId] : undefined;
  const result = HANDLERS[input.type]({ state: next, rec, input, cause, at, plot });
  if (typeof result === 'string') return { state, transitions: [], error: result };

  const entry = {
    ...input,
    worldId: state.worldId,
    committedAt: at,
    dueAt: result,
  };
  return { state: next, transitions: rec.transitions, entry };
}

/** Checks a cost can be paid. Call before changing anything. */
function cannotAfford(state: WorldState, stamina: number, water = 0): string | null {
  if (state.resources.stamina < stamina) return 'Not enough stamina';
  if (state.resources.water < water) return 'Not enough water';
  return null;
}

function pay({ state, rec, cause }: Ctx, stamina: number, water = 0): void {
  setResource(state, rec, 'stamina', state.resources.stamina - stamina, [cause]);
  state.tally.staminaSpent += stamina;
  if (water > 0) {
    setResource(state, rec, 'water', state.resources.water - water, [cause]);
    state.tally.waterSpent += water;
  }
}

function addFood(ctx: Ctx, amount: number, causes: Cause[]): void {
  const { state, rec } = ctx;
  if (amount <= 0) return;
  setResource(state, rec, 'food', state.resources.food + amount, causes);
  state.tally.foodGained += amount;
}

const harvest: Handler = (ctx) => {
  const { state, rec, cause, plot, input, at } = ctx;
  if (!plot) return 'Nothing to harvest here';

  let amount: number;
  const causes: Cause[] = [];
  if (plot.kind === 'field' && plot.stage === 'ripe') {
    amount = CONFIG.cropYield;
    causes.push({ ...cause, share: CONFIG.cropYield }, ...builtCause(plot));
    const good = eventAt(state, 'goodHarvest');
    if (good) {
      amount = Math.round(CONFIG.cropYield * CONFIG.goodHarvestMult);
      causes.push(event(good, amount - CONFIG.cropYield));
    }
  } else if (plot.kind === 'orchard' && plot.stage === 'fruiting') {
    if (plot.harvestedTurn === state.turn) return 'Already harvested this generation';
    amount = CONFIG.orchardYield;
    causes.push({ ...cause, share: CONFIG.orchardYield }, ...builtCause(plot));
    if (plot.wear >= CONFIG.wearHalveAt) {
      amount = Math.round(CONFIG.orchardYield / 2);
      causes.push(rule('wear', amount - CONFIG.orchardYield));
    }
  } else {
    return 'Nothing to harvest here';
  }

  // Harvest and eat is free, so it needs room to eat; otherwise it would be a free harvest (decision 016).
  if (input.eat && state.resources.hunger >= CONFIG.hungerMax) return "You're not hungry";
  const cost = input.eat ? CONFIG.harvestEatCost : CONFIG.harvestCost;
  const blocked = cannotAfford(state, cost);
  if (blocked) return blocked;
  if (cost > 0) pay(ctx, cost);

  let stored = amount;
  if (input.eat) {
    // Eat only the fresh yield, until hunger is full; the rest goes to the store (decisions 003, 016).
    const room = CONFIG.hungerMax - state.resources.hunger;
    const eaten = Math.min(amount, Math.ceil(room / CONFIG.hungerPerFoodEaten));
    if (eaten > 0) {
      const gain = Math.min(eaten * CONFIG.hungerPerFoodEaten, room);
      setResource(state, rec, 'hunger', state.resources.hunger + gain, [cause]);
      state.tally.foodEaten += eaten;
      stored -= eaten;
    }
  }
  // Shares only add up when the whole yield was stored.
  addFood(ctx, stored, stored === amount ? causes : causes.map(withoutShare));

  if (plot.kind === 'field') {
    setStage(rec, plot, 'empty', [cause]);
    plot.builtBy = null;
  } else {
    plot.harvestedTurn = state.turn;
  }
  return at;
};

// Sow, then water, then it grows (decision 027). Sowing alone schedules nothing: a sown tile
// waits, across generations if need be, until someone waters it or it withers.
const plantCrops: Handler = (ctx) => {
  const { state, rec, cause, plot, at } = ctx;
  if (!plot || plot.kind !== 'field') return 'Crops can only go in a field';
  if (plot.stage === 'rotten' || plot.stage === 'withered') return 'Clear it first';
  if (plot.stage !== 'empty') return 'Already sown';
  const blocked = cannotAfford(state, CONFIG.plantCropsCost, CONFIG.plantCropsWater);
  if (blocked) return blocked;

  pay(ctx, CONFIG.plantCropsCost, CONFIG.plantCropsWater);
  setStage(rec, plot, 'sown', [cause]);
  plot.builtBy = cause;
  return at;
};

/** One pour from the can on a sown tile starts its ripening clock. */
const water: Handler = (ctx) => {
  const { state, rec, cause, plot, input, at } = ctx;
  if (!plot || plot.kind !== 'field') return 'Nothing to water here';
  if (plot.stage === 'watered' || plot.stage === 'growing') return 'Already watered';
  if (plot.stage !== 'sown') return 'Nothing to water here';
  if (state.resources.can < 1) return 'The can is empty';

  setResource(state, rec, 'can', state.resources.can - 1, [cause]);
  setStage(rec, plot, 'watered', [cause]);
  const dueAt = { turn: state.turn, t: at.t + CONFIG.cropRipenPct * state.turnSeconds };
  schedule(state, {
    id: `${input.id}:cropRipe`,
    sourceActionId: input.id,
    sourceActorId: input.actorId,
    committedAt: at,
    dueAt,
    kind: 'cropRipe',
    plotId: plot.id,
    payload: { stamina: CONFIG.plantCropsCost, water: CONFIG.plantCropsWater },
    status: 'pending',
  });
  return dueAt;
};

/**
 * Fills the can to the brim at a dug well or the reservoir (`plotId`), or at a pond or the sea
 * edge (no `plotId`: the engine has no map, so the client checks the player is at the water).
 * It never takes stored water.
 */
const fillCan: Handler = (ctx) => {
  const { state, rec, cause, plot, at } = ctx;
  if (plot) {
    const source = plot.kind === 'reservoir' || (plot.kind === 'well' && plot.stage !== 'none');
    if (!source) return "There's no water here";
  }
  if (state.resources.can >= CONFIG.canCapacity) return 'The can is full';
  setResource(state, rec, 'can', CONFIG.canCapacity, [cause]);
  return at;
};

const plantOrchard: Handler = (ctx) => {
  const { state, rec, cause, plot, input, at } = ctx;
  if (!plot || plot.kind !== 'orchard') return 'An orchard needs an orchard plot';
  if (plot.stage !== 'empty' && plot.stage !== 'dead') return 'Something is already growing here';
  const blocked = cannotAfford(state, CONFIG.plantOrchardCost, CONFIG.plantOrchardWater);
  if (blocked) return blocked;

  pay(ctx, CONFIG.plantOrchardCost, CONFIG.plantOrchardWater);
  setStage(rec, plot, 'sapling', [cause]);
  setWear(rec, plot, 0, [cause]);
  plot.lastMaintainedTurn = state.turn;
  plot.builtBy = cause;
  plot.harvestedTurn = null;
  const dueAt = { turn: state.turn + CONFIG.orchardMatureGens };
  schedule(state, {
    id: `${input.id}:orchardMature`,
    sourceActionId: input.id,
    sourceActorId: input.actorId,
    committedAt: at,
    dueAt,
    kind: 'orchardMature',
    plotId: plot.id,
    payload: { stamina: CONFIG.plantOrchardCost, water: CONFIG.plantOrchardWater },
    status: 'pending',
  });
  return dueAt;
};

const repairReservoir: Handler = (ctx) => {
  const { state, plot, input, at } = ctx;
  if (!plot || plot.kind !== 'reservoir') return 'Only the reservoir can be repaired';
  if (plot.stage === 'full') return 'The reservoir is sound';
  const underway = state.pending.some(
    (e) => e.kind === 'reservoirRepaired' && e.status === 'pending',
  );
  if (underway) return 'The reservoir is already being repaired';
  const blocked = cannotAfford(state, CONFIG.repairReservoirCost);
  if (blocked) return blocked;

  pay(ctx, CONFIG.repairReservoirCost);
  const dueAt = { turn: state.turn + 1 };
  schedule(state, {
    id: `${input.id}:reservoirRepaired`,
    sourceActionId: input.id,
    sourceActorId: input.actorId,
    committedAt: at,
    dueAt,
    kind: 'reservoirRepaired',
    plotId: plot.id,
    payload: { stamina: CONFIG.repairReservoirCost, water: 0 },
    status: 'pending',
  });
  return dueAt;
};

const digWell: Handler = (ctx) => {
  const { state, rec, cause, plot, at } = ctx;
  if (!plot || plot.kind !== 'well') return 'A well needs a well site';
  if (plot.stage !== 'none') return 'The well is already dug';
  const blocked = cannotAfford(state, CONFIG.digWellCost);
  if (blocked) return blocked;

  pay(ctx, CONFIG.digWellCost);
  setResource(state, rec, 'water', state.resources.water + CONFIG.digWellWater, [cause]);
  state.tally.waterGained += CONFIG.digWellWater;
  setStage(rec, plot, 'clear', [cause]);
  plot.wear = 0;
  plot.lastMaintainedTurn = state.turn;
  plot.builtBy = cause;
  return at;
};

const fishHunt: Handler = (ctx) => {
  const { state, rec, cause, plot, at } = ctx;
  if (!plot || plot.kind !== 'wild') return 'Nothing to catch here';
  if (state.wildStock <= 0) return 'Nothing left to catch';
  const blocked = cannotAfford(state, CONFIG.fishHuntCost);
  if (blocked) return blocked;

  pay(ctx, CONFIG.fishHuntCost);
  addFood(ctx, CONFIG.fishHuntYield, [cause]);
  setWorld(state, rec, 'wildStock', state.wildStock - 1, [cause]);
  return at;
};

const maintain: Handler = (ctx) => {
  const { state, rec, cause, plot, at } = ctx;
  // Tending a rotten or withered tile clears it and tills the soil for sowing (decision 027).
  if (plot?.kind === 'field' && (plot.stage === 'rotten' || plot.stage === 'withered')) {
    const blocked = cannotAfford(state, CONFIG.maintainCost);
    if (blocked) return blocked;
    pay(ctx, CONFIG.maintainCost);
    setStage(rec, plot, 'empty', [cause]);
    plot.builtBy = null;
    return at;
  }
  if (!plot || !isBuilt(plot)) return 'Nothing to maintain here';
  if (plot.lastMaintainedTurn === state.turn) return 'Already maintained this turn';
  const blocked = cannotAfford(state, CONFIG.maintainCost);
  if (blocked) return blocked;

  pay(ctx, CONFIG.maintainCost);
  setWear(rec, plot, 0, [cause]);
  plot.lastMaintainedTurn = state.turn;
  settleStage(state, rec, plot, [cause]);
  return at;
};

const fastTrack: Handler = (ctx) => {
  const { state, cause, input, at } = ctx;
  const effect = state.pending.find((e) => e.id === input.targetEffectId);
  if (!effect || effect.status !== 'pending') return 'Nothing to fast track';
  const stamina = Number(effect.payload.stamina ?? 0) * CONFIG.fastTrackMultiplier;
  const water = Number(effect.payload.water ?? 0) * CONFIG.fastTrackMultiplier;
  const blocked = cannotAfford(state, stamina, water);
  if (blocked) return blocked;

  pay(ctx, stamina, water);
  resolveEffect(state, ctx.rec, effect, [cause]);
  return at;
};

const HANDLERS: Record<ActionInput['type'], Handler> = {
  harvest,
  plantCrops,
  plantOrchard,
  repairReservoir,
  digWell,
  fishHunt,
  maintain,
  fastTrack,
  water,
  fillCan,
};

function withoutShare(cause: Cause): Cause {
  const copy = { ...cause };
  delete copy.share;
  return copy;
}
