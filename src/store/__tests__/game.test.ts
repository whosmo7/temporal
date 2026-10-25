import { beforeEach, describe, expect, it } from 'vitest';
import { beginTurn, CONFIG, createWorld } from '../../engine';
import { useGameStore } from '../game';

const store = () => useGameStore.getState();
// Fields are worked one tile at a time (decision 019).
const FIELD = 'field-1:0,0';
const SOW = CONFIG.actionSeconds.plantCrops;

/** Runs the clock forward in small steps, as the game loop does. */
function wait(seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) store().advance(0.1);
}

describe('play session store', () => {
  beforeEach(() => {
    const world = createWorld(7, { worldId: 'w', biome: 'forest', turnSeconds: 600 }).state;
    world.events = [];
    store().loadTurn(beginTurn(world).state, 'AL');
  });

  it('an action takes its time, then the engine applies it as the player at the end', () => {
    store().advance(20);
    expect(store().act({ type: 'plantCrops', plotId: FIELD }).error).toBeUndefined();
    expect(store().work).toMatchObject({ from: 20, until: 20 + SOW });
    expect(store().busyUntil).toBe(20 + SOW);
    expect(store().log).toEqual([]);
    expect(store().view?.plots[FIELD]?.stage).toBe('empty');

    wait(SOW + 0.05);
    expect(store().work).toBeNull();
    expect(store().log).toEqual([
      expect.objectContaining({ type: 'plantCrops', actorId: 'AL', seq: 0, committedAt: { turn: 1, t: 20 + SOW } }),
    ]);
    expect(store().view?.plots[FIELD]?.stage).toBe('sown');
    expect(store().lastAction).toMatchObject({ done: true });
  });

  it('one action at a time', () => {
    store().act({ type: 'plantCrops', plotId: FIELD });
    expect(store().act({ type: 'plantCrops', plotId: 'field-1:1,0' }).error).toBe('Busy');
  });

  it('leaves everything alone on a refused action and keeps the reason', () => {
    const before = store().world;
    expect(store().check({ type: 'harvest', plotId: FIELD })).toBe('Nothing to harvest here');
    store().act({ type: 'harvest', plotId: FIELD });
    expect(store().work).toBeNull();
    expect(store().world).toBe(before);
    expect(store().lastAction?.error).toBe('Nothing to harvest here');
  });

  it("won't start what can't finish before the day ends", () => {
    store().advance(600 - SOW / 2);
    expect(store().act({ type: 'plantCrops', plotId: FIELD }).error).toBe('Not enough time left today');
  });

  it('ticks the engine as time passes, so watered crops come up and ripen', () => {
    store().act({ type: 'plantCrops', plotId: FIELD });
    wait(SOW + 0.05);
    store().act({ type: 'fillCan' });
    wait(CONFIG.actionSeconds.fillCan + 0.05);
    expect(store().view?.resources.can).toBe(CONFIG.canCapacity);
    store().act({ type: 'water', plotId: FIELD });
    const ripe = CONFIG.cropRipenPct * 600;
    wait(CONFIG.actionSeconds.water + ripe / 2 + 1);
    expect(store().view?.plots[FIELD]?.stage).toBe('growing');
    wait(ripe);
    expect(store().view?.plots[FIELD]?.stage).toBe('ripe');
    expect(store().check({ type: 'harvest', plotId: FIELD })).toBeNull();
  });

  it('ends the turn in the engine and hands back the summary; unfinished work is dropped', () => {
    store().act({ type: 'plantCrops', plotId: FIELD });
    wait(SOW + 0.05);
    store().act({ type: 'plantCrops', plotId: 'field-1:1,0' });
    const r = store().finishTurn();
    expect(r?.summary.cropsRotted).toBe(0); // a dry seed waits for the next player (decision 027)
    expect(store().world?.plots[FIELD]?.stage).toBe('sown');
    expect(store().log).toHaveLength(1);
    expect(store().work).toBeNull();
    expect(store().world?.turn).toBe(2);
  });
});
