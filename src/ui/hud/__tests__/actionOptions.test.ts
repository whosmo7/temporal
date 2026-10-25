import { describe, expect, it } from 'vitest';
import { applyAction, beginTurn, createWorld, tick, visibleView, type WorldState } from '../../../engine';
import type { ActionRequest } from '../../../store/game';
import { ovenOptions, plotOptions, waterEdgeOptions } from '../actionOptions';

const fresh = () => {
  const w = createWorld(7, { worldId: 'w', biome: 'forest' }).state;
  w.events = [];
  return beginTurn(w).state;
};
const checker = (state: WorldState, t = 0) => (r: ActionRequest) =>
  applyAction(state, { ...r, id: 'c', actorId: 'AL', seq: 0 }, t).error ?? null;
const keys = (state: WorldState, id: string, kind: 'field' | 'orchard' | 'reservoir' | 'well' | 'wild', t = 0) =>
  plotOptions(visibleView(state, t), { id, kind }, checker(state, t)).map((o) => `${o.key} ${o.label}${o.error ? ` (${o.error})` : ''}`);

// Fields and orchards are worked one tile at a time (decision 019).
const FIELD = 'field-1:0,0';
const TREE = 'orchard-1:0,0';

describe('plot options', () => {
  it('offers what fits the plot as it looks now, default on E', () => {
    const s = fresh();
    expect(keys(s, FIELD, 'field')).toEqual(['E Sow crops']);
    expect(keys(s, TREE, 'orchard')).toEqual(['E Plant a tree']);
    // The can starts empty, so it fills first where there's water (decision 027).
    expect(keys(s, 'reservoir', 'reservoir')).toEqual(['E Fill the can', '5 Repair the reservoir wall']);
    expect(keys(s, 'well', 'well')).toEqual(['E Dig a well']);
    expect(keys(s, 'wild', 'wild')).toEqual(['E Hunt']);
  });

  it('sow, then water, then hurry on F while it grows, then harvest on E (eating is at the oven)', () => {
    const act = (state: WorldState, r: ActionRequest, t = 0) => applyAction(state, { ...r, id: `${r.type}-${t}`, actorId: 'AL', seq: 0 }, t).state;
    const sown = act(fresh(), { type: 'plantCrops', plotId: FIELD });
    expect(keys(sown, FIELD, 'field')).toEqual(['E Water (The can is empty)']);
    const watered = act(act(sown, { type: 'fillCan' }), { type: 'water', plotId: FIELD });
    expect(keys(watered, FIELD, 'field')).toEqual(['F Hurry this along']);
    expect(keys(tick(watered, 200).state, FIELD, 'field', 200)).toEqual(['E Harvest']);
  });

  it('the oven offers a meal on E, free, and says when the store is empty', () => {
    const s = fresh();
    const oven = (state: WorldState) =>
      ovenOptions(visibleView(state, 0), checker(state)).map((o) => `${o.key} ${o.label}${o.error ? ` (${o.error})` : ''}`);
    expect(oven(s)).toEqual(['E Cook and eat']);
    expect(ovenOptions(visibleView(s, 0), checker(s))[0]?.cost).toEqual({ stamina: 0, water: 0 });
    s.resources.food = 0;
    expect(oven(s)).toEqual(['E Cook and eat (The store is empty)']);
  });

  it('a full can is not offered a fill; a rotten tile offers clearing', () => {
    const s = fresh();
    s.resources.can = 4;
    expect(keys(s, 'reservoir', 'reservoir')).toEqual(['E Repair the reservoir wall']);
    expect(waterEdgeOptions(visibleView(s, 0), checker(s))).toEqual([]);
    s.plots[FIELD]!.stage = 'rotten';
    expect(keys(s, FIELD, 'field')).toEqual(['E Clear and till']);
  });

  it('greys out what the player cannot afford, with the engine reason', () => {
    const s = fresh();
    s.resources.water = 0;
    expect(keys(s, TREE, 'orchard')).toEqual(['E Plant a tree (Not enough water)']);
  });
});
