import { describe, expect, it } from 'vitest';
import { applyAction, beginTurn, createWorld, tick, visibleView, type WorldState } from '../../../engine';
import type { ActionRequest } from '../../../store/game';
import { plotOptions } from '../actionOptions';

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
    expect(keys(s, 'reservoir', 'reservoir')).toEqual(['E Repair the reservoir wall']);
    expect(keys(s, 'well', 'well')).toEqual(['E Dig a well']);
    expect(keys(s, 'wild', 'wild')).toEqual(['E Hunt']);
  });

  it('offers harvest on E and eat on Q at a ripe field, and hurry on F while it grows', () => {
    const sown = applyAction(fresh(), { id: 'a', actorId: 'AL', seq: 0, type: 'plantCrops', plotId: FIELD }, 0).state;
    expect(keys(sown, FIELD, 'field')).toEqual(['F Hurry this along']);
    expect(keys(tick(sown, 200).state, FIELD, 'field', 200)).toEqual(["E Harvest", "Q Harvest and eat (You're not hungry)"]);
  });

  it('greys out what the player cannot afford, with the engine reason', () => {
    const s = fresh();
    s.resources.water = 0;
    expect(keys(s, TREE, 'orchard')).toEqual(['E Plant a tree (Not enough water)']);
  });
});
