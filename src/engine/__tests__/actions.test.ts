import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { asActor, newGame, sowAndWater } from '../__fixtures__/play';

// Fields and orchards are worked one tile at a time (decision 019).
const FIELD = 'field-1:0,0';
const TREE = 'orchard-1:0,0';

describe('applyAction', () => {
  it('a sown tile waits for water: sowing schedules nothing', () => {
    const game = newGame().begin();
    const r = game.act('plantCrops', { plotId: FIELD, t: 20 });
    expect(r.error).toBeUndefined();
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantCropsCost);
    expect(game.state.resources.water).toBe(CONFIG.biomes.forest.water - CONFIG.plantCropsWater);
    expect(r.entry?.dueAt).toEqual({ turn: 1, t: 20 });
    expect(game.state.plots[FIELD]?.stage).toBe('sown');
    expect(game.state.pending).toEqual([]);
    expect(game.act('harvest', { plotId: FIELD, t: 500 }).error).toBe('Nothing to harvest here');
  });

  it('watering takes a pour from the can and starts that tile ripening', () => {
    const game = newGame().begin();
    game.act('plantCrops', { plotId: FIELD, t: 0 });
    expect(game.state.resources.can).toBe(0);
    expect(game.act('water', { plotId: FIELD, t: 5 }).error).toBe('The can is empty');
    game.act('fillCan', { t: 8 });
    expect(game.state.resources.can).toBe(CONFIG.canCapacity);
    const r = game.act('water', { plotId: FIELD, t: 20 });
    expect(r.entry?.dueAt).toEqual({ turn: 1, t: 20 + CONFIG.cropRipenPct * 600 });
    expect(game.state.resources.can).toBe(CONFIG.canCapacity - 1);
    expect(game.state.plots[FIELD]?.stage).toBe('watered');
    expect(game.act('water', { plotId: FIELD, t: 21 }).error).toBe('Already watered');
    expect(game.act('water', { plotId: 'field-1:1,0', t: 22 }).error).toBe('Nothing to water here');
  });

  it('filling the can never takes stored water, and works only at water', () => {
    const game = newGame().begin();
    const stored = game.state.resources.water;
    expect(game.act('fillCan', { plotId: 'well', t: 0 }).error).toBe("There's no water here"); // not dug yet
    expect(game.act('fillCan', { plotId: FIELD, t: 0 }).error).toBe("There's no water here");
    expect(game.act('fillCan', { plotId: 'reservoir', t: 0 }).error).toBeUndefined(); // even cracked
    expect(game.act('fillCan', { t: 1 }).error).toBe('The can is full');
    game.act('water', { plotId: FIELD, t: 2 }); // nothing sown: refused
    game.act('digWell', { plotId: 'well', t: 3 });
    for (const id of ['field-1:0,0', 'field-1:1,0']) sowAndWater(game, id, 4);
    expect(game.act('fillCan', { plotId: 'well', t: 5 }).error).toBeUndefined();
    expect(game.state.resources.water).toBe(stored + CONFIG.digWellWater);
  });

  it('the can starts every turn empty', () => {
    const game = newGame().begin();
    game.act('fillCan', { t: 0 });
    game.end().begin();
    expect(game.state.resources.can).toBe(0);
  });

  it('each field tile is sown and harvested on its own', () => {
    const game = newGame().begin();
    sowAndWater(game, FIELD, 0);
    expect(game.state.plots['field-1:1,0']?.stage).toBe('empty');
    expect(game.act('plantCrops', { plotId: FIELD, t: 1 }).error).toBe('Already sown');
    sowAndWater(game, 'field-1:1,0', 10);
    game.act('harvest', { plotId: FIELD, t: 150 });
    expect(game.state.plots[FIELD]?.stage).toBe('empty');
    expect(game.state.plots['field-1:1,0']?.stage).toBe('watered');
    expect(game.act('harvest', { plotId: 'field-1:1,0', t: 160 }).error).toBeUndefined();
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + 2 * CONFIG.cropYield);
  });

  it('a whole field or orchard is not something to act on, only its tiles', () => {
    const game = newGame().begin();
    expect(game.state.plots['field-1']).toBeUndefined();
    expect(game.act('plantCrops', { plotId: 'field-1', t: 0 }).error).toBe('Crops can only go in a field');
  });

  it('crops can only be harvested once ripe', () => {
    const game = newGame().begin();
    sowAndWater(game, FIELD, 0);
    expect(game.act('harvest', { plotId: FIELD, t: 100 }).error).toBe(
      'Nothing to harvest here',
    );
    const r = game.act('harvest', { plotId: FIELD, t: 150 });
    expect(r.error).toBeUndefined();
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + CONFIG.cropYield);
    expect(game.state.plots[FIELD]?.stage).toBe('empty');
  });

  it('harvest and eat is free and turns the fresh yield into hunger, up to full', () => {
    const game = newGame().begin();
    game.state.resources.hunger = 80;
    // A tree's yield is enough to overfill: plant one and hurry it to fruit.
    game.act('plantOrchard', { plotId: TREE });
    const effect = game.state.pending.find((e) => e.kind === 'orchardMature');
    game.act('fastTrack', { targetEffectId: effect?.id });
    const food = game.state.resources.food;
    const r = game.act('harvest', { plotId: TREE, t: 10, eat: true });
    expect(r.error).toBeUndefined();
    // 20 short of full: 2 food (20 hunger) is eaten and the rest stored.
    expect(game.state.resources.hunger).toBe(CONFIG.hungerMax);
    expect(game.state.resources.food).toBe(food + CONFIG.orchardYield - 2);
    expect(game.state.tally.foodEaten).toBe(2);
    const hunger = r.transitions.find((t) => 'resource' in t.target && t.target.resource === 'hunger');
    expect(hunger?.causes).toEqual([expect.objectContaining({ kind: 'action', actorId: 'AL' })]);
  });

  it('harvest and eat is refused when the player is not hungry', () => {
    const game = newGame().begin();
    sowAndWater(game, FIELD, 0);
    expect(game.act('harvest', { plotId: FIELD, t: 150, eat: true }).error).toBe("You're not hungry");
    expect(game.act('harvest', { plotId: FIELD, t: 150 }).error).toBeUndefined();
  });

  it('a good harvest raises crop yield and is a cause', () => {
    const game = newGame();
    game.state.events = [{ id: 'goodHarvest-1', kind: 'goodHarvest', turn: 1 }];
    game.begin();
    sowAndWater(game, FIELD, 0);
    const r = game.act('harvest', { plotId: FIELD, t: 150 });
    const gain = Math.round(CONFIG.cropYield * CONFIG.goodHarvestMult);
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + gain);
    const food = r.transitions.find((t) => 'resource' in t.target && t.target.resource === 'food');
    expect(food?.causes).toContainEqual({
      kind: 'event',
      eventId: 'goodHarvest-1',
      share: gain - CONFIG.cropYield,
    });
  });

  it('plant orchard is due orchardMatureGens later', () => {
    const game = newGame().begin();
    const r = game.act('plantOrchard', { plotId: TREE });
    expect(r.entry?.dueAt).toEqual({ turn: 1 + CONFIG.orchardMatureGens });
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantOrchardCost);
    expect(game.state.plots[TREE]?.stage).toBe('sapling');
  });

  it('repairing the reservoir lands next generation', () => {
    const game = newGame().begin();
    const r = game.act('repairReservoir', { plotId: 'reservoir' });
    expect(r.entry?.dueAt).toEqual({ turn: 2 });
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.repairReservoirCost);
    expect(game.state.plots['reservoir']?.stage).toBe('cracked');
    expect(game.act('repairReservoir', { plotId: 'reservoir' }).error).toBe(
      'The reservoir is already being repaired',
    );
    game.end().begin();
    expect(game.state.plots['reservoir']?.stage).toBe('full');
  });

  it('dig well gives water now, once', () => {
    const game = newGame().begin();
    game.act('digWell', { plotId: 'well' });
    expect(game.state.resources.water).toBe(CONFIG.biomes.forest.water + CONFIG.digWellWater);
    expect(game.state.plots['well']?.stage).toBe('clear');
    expect(game.act('digWell', { plotId: 'well' }).error).toBe('The well is already dug');
  });

  it('fish/hunt takes from the wild stock until it runs out', () => {
    const game = newGame().begin();
    game.state.wildStock = 1;
    game.act('fishHunt', { plotId: 'wild' });
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + CONFIG.fishHuntYield);
    expect(game.state.wildStock).toBe(0);
    expect(game.act('fishHunt', { plotId: 'wild' }).error).toBe('Nothing left to catch');
  });

  it('a rotten tile has to be tended (cleared and tilled) before it can be sown again', () => {
    const game = newGame().begin();
    sowAndWater(game, FIELD, 500); // ripens after the day ends, so it rots
    game.end().begin();
    expect(game.state.plots[FIELD]?.stage).toBe('rotten');
    expect(game.act('plantCrops', { plotId: FIELD, t: 0 }).error).toBe('Clear it first');
    expect(game.act('maintain', { plotId: FIELD, t: 1 }).error).toBeUndefined();
    expect(game.state.plots[FIELD]?.stage).toBe('empty');
    expect(game.act('plantCrops', { plotId: FIELD, t: 2 }).error).toBeUndefined();
    expect(game.act('maintain', { plotId: 'field-1:1,0', t: 3 }).error).toBe('Nothing to maintain here');
  });

  it('maintain only works on built structures, once per turn', () => {
    const game = newGame().begin();
    expect(game.act('maintain', { plotId: 'well' }).error).toBe('Nothing to maintain here');
    game.act('digWell', { plotId: 'well' });
    expect(game.act('maintain', { plotId: 'well' }).error).toBe('Already maintained this turn');
  });

  it('rejects actions that cost more than is left', () => {
    const game = newGame().begin();
    game.state.resources.water = 0;
    expect(game.act('plantOrchard', { plotId: TREE }).error).toBe('Not enough water');
  });

  it('a rejected action leaves the state untouched', () => {
    const game = newGame().begin();
    const before = game.state;
    const r = game.act('harvest', { plotId: FIELD });
    expect(r.error).toBeDefined();
    expect(r.state).toBe(before);
    expect(r.transitions).toEqual([]);
    expect(r.entry).toBeUndefined();
  });

  it("fast track on another player's orchard costs double, resolves now and marks it", () => {
    const game = newGame();
    asActor(game, 'AL', (g) => g.act('plantOrchard', { plotId: TREE }));
    game.begin();
    game.state.resources.water = 50;
    const effect = game.state.pending.find((e) => e.kind === 'orchardMature');
    const before = { ...game.state.resources };
    const r = game.act('fastTrack', { actorId: 'MO', targetEffectId: effect?.id });

    expect(r.error).toBeUndefined();
    expect(game.state.resources.stamina).toBe(before.stamina - 2 * CONFIG.plantOrchardCost);
    expect(game.state.resources.water).toBe(before.water - 2 * CONFIG.plantOrchardWater);
    expect(game.state.plots[TREE]?.stage).toBe('fruiting');
    expect(game.state.pending.find((e) => e.id === effect?.id)?.status).toBe('fastTracked');

    const stage = r.transitions.find((t) => 'plot' in t.target && t.target.field === 'stage');
    const actors = stage?.causes.flatMap((c) => (c.kind === 'action' ? [c.actorId] : []));
    expect(actors).toEqual(['MO', 'AL']);

    // It no longer happens later.
    game.end().begin();
    expect(game.transitions.filter((t) => t.id.startsWith('begin-3'))).not.toContainEqual(
      expect.objectContaining({ target: { effect: effect?.id, field: 'status' } }),
    );
  });
});
