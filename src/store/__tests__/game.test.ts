import { beforeEach, describe, expect, it } from 'vitest';
import { beginTurn, CONFIG, createWorld } from '../../engine';
import { ACTION_TIME, useGameStore } from '../game';

const store = () => useGameStore.getState();

describe('play session store', () => {
  beforeEach(() => {
    const world = createWorld(7, { worldId: 'w', biome: 'forest', turnSeconds: 600 }).state;
    world.events = [];
    store().loadTurn(beginTurn(world).state, 'AL');
  });

  it('applies an action through the engine and logs it as the player', () => {
    store().advance(20);
    const r = store().act({ type: 'plantCrops', plotId: 'field-1' });
    expect(r.error).toBeUndefined();
    expect(store().log).toEqual([expect.objectContaining({ type: 'plantCrops', actorId: 'AL', seq: 0, committedAt: { turn: 1, t: 20 } })]);
    expect(store().view?.resources.stamina).toBe(CONFIG.baseStamina - CONFIG.plantCropsCost);
    expect(store().view?.plots['field-1']?.stage).toBe('sown');
    expect(store().busyUntil).toBe(20 + ACTION_TIME);
  });

  it('leaves everything alone on a rejected action and keeps the reason', () => {
    const before = store().world;
    expect(store().check({ type: 'harvest', plotId: 'field-1' })).toBe('Nothing to harvest here');
    store().act({ type: 'harvest', plotId: 'field-1' });
    expect(store().world).toBe(before);
    expect(store().log).toEqual([]);
    expect(store().lastAction?.error).toBe('Nothing to harvest here');
  });

  it('ticks the engine as time passes, so crops come up and ripen', () => {
    store().act({ type: 'plantCrops', plotId: 'field-1' });
    const ripe = CONFIG.cropRipenPct * 600;
    for (let t = 0; t < ripe / 2 + 1; t += 0.1) store().advance(0.1);
    expect(store().view?.plots['field-1']?.stage).toBe('growing');
    for (let t = 0; t < ripe; t += 0.1) store().advance(0.1);
    expect(store().view?.plots['field-1']?.stage).toBe('ripe');
    expect(store().check({ type: 'harvest', plotId: 'field-1' })).toBeNull();
  });

  it('ends the turn in the engine and hands back the summary', () => {
    store().act({ type: 'plantCrops', plotId: 'field-1' });
    const r = store().finishTurn();
    expect(r?.summary.cropsRotted).toBe(1);
    expect(r?.summary.spent.stamina).toBe(CONFIG.plantCropsCost);
    expect(store().world?.turn).toBe(2);
  });
});
