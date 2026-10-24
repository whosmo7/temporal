import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { asActor, newGame } from '../__fixtures__/play';

describe('applyAction', () => {
  it('plant crops costs stamina and water and ripens later the same turn', () => {
    const game = newGame().begin();
    const r = game.act('plantCrops', { plotId: 'field-1', t: 20 });
    expect(r.error).toBeUndefined();
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantCropsCost);
    expect(game.state.resources.water).toBe(CONFIG.biomes.forest.water - CONFIG.plantCropsWater);
    expect(r.entry?.committedAt).toEqual({ turn: 1, t: 20 });
    expect(r.entry?.dueAt).toEqual({ turn: 1, t: 20 + CONFIG.cropRipenPct * 600 });
    expect(game.state.plots['field-1']?.stage).toBe('sown');
  });

  it('crops can only be harvested once ripe', () => {
    const game = newGame().begin();
    game.act('plantCrops', { plotId: 'field-1', t: 0 });
    expect(game.act('harvest', { plotId: 'field-1', t: 100 }).error).toBe(
      'Nothing to harvest here',
    );
    const r = game.act('harvest', { plotId: 'field-1', t: 150 });
    expect(r.error).toBeUndefined();
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + CONFIG.cropYield);
    expect(game.state.plots['field-1']?.stage).toBe('empty');
  });

  it('harvest and eat is free and turns the fresh yield into hunger, up to full', () => {
    const game = newGame().begin();
    game.state.resources.hunger = 70;
    game.act('plantCrops', { plotId: 'field-1', t: 0 });
    const r = game.act('harvest', { plotId: 'field-1', t: 150, eat: true });
    expect(r.error).toBeUndefined();
    // 30 short of full: 3 food (30 hunger) is eaten and the other 2 stored. No stamina for the harvest.
    expect(game.state.resources.hunger).toBe(CONFIG.hungerMax);
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantCropsCost);
    expect(game.state.resources.food).toBe(CONFIG.biomes.forest.food + 2);
    expect(game.state.tally.foodEaten).toBe(3);
    const hunger = r.transitions.find((t) => 'resource' in t.target && t.target.resource === 'hunger');
    expect(hunger?.causes).toEqual([expect.objectContaining({ kind: 'action', actorId: 'AL' })]);
  });

  it('harvest and eat is refused when the player is not hungry', () => {
    const game = newGame().begin();
    game.act('plantCrops', { plotId: 'field-1', t: 0 });
    expect(game.act('harvest', { plotId: 'field-1', t: 150, eat: true }).error).toBe("You're not hungry");
    expect(game.act('harvest', { plotId: 'field-1', t: 150 }).error).toBeUndefined();
  });

  it('a good harvest raises crop yield and is a cause', () => {
    const game = newGame();
    game.state.events = [{ id: 'goodHarvest-1', kind: 'goodHarvest', turn: 1 }];
    game.begin();
    game.act('plantCrops', { plotId: 'field-1', t: 0 });
    const r = game.act('harvest', { plotId: 'field-1', t: 150 });
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
    const r = game.act('plantOrchard', { plotId: 'orchard-1' });
    expect(r.entry?.dueAt).toEqual({ turn: 1 + CONFIG.orchardMatureGens });
    expect(game.state.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantOrchardCost);
    expect(game.state.plots['orchard-1']?.stage).toBe('sapling');
  });

  it('repairing the reservoir costs 60 stamina and lands next generation', () => {
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

  it('maintain only works on built structures, once per turn', () => {
    const game = newGame().begin();
    expect(game.act('maintain', { plotId: 'well' }).error).toBe('Nothing to maintain here');
    game.act('digWell', { plotId: 'well' });
    expect(game.act('maintain', { plotId: 'well' }).error).toBe('Already maintained this turn');
  });

  it('rejects actions that cost more stamina than is left', () => {
    const game = newGame().begin();
    game.act('repairReservoir', { plotId: 'reservoir' });
    game.act('plantOrchard', { plotId: 'orchard-1' });
    expect(game.act('digWell', { plotId: 'well' }).error).toBe('Not enough stamina');
  });

  it('a rejected action leaves the state untouched', () => {
    const game = newGame().begin();
    const before = game.state;
    const r = game.act('harvest', { plotId: 'field-1' });
    expect(r.error).toBeDefined();
    expect(r.state).toBe(before);
    expect(r.transitions).toEqual([]);
    expect(r.entry).toBeUndefined();
  });

  it("fast track on another player's orchard costs double, resolves now and marks it", () => {
    const game = newGame();
    asActor(game, 'AL', (g) => g.act('plantOrchard', { plotId: 'orchard-1' }));
    game.begin();
    game.state.resources.water = 50;
    const effect = game.state.pending.find((e) => e.kind === 'orchardMature');
    const before = { ...game.state.resources };
    const r = game.act('fastTrack', { actorId: 'MO', targetEffectId: effect?.id });

    expect(r.error).toBeUndefined();
    expect(game.state.resources.stamina).toBe(before.stamina - 2 * CONFIG.plantOrchardCost);
    expect(game.state.resources.water).toBe(before.water - 2 * CONFIG.plantOrchardWater);
    expect(game.state.plots['orchard-1']?.stage).toBe('fruiting');
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
