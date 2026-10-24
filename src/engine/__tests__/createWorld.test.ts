import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createWorld } from '../createWorld';

const opts = { worldId: 'world-1' };

describe('createWorld', () => {
  it('gives the same world for the same seed', () => {
    expect(createWorld(42, opts)).toEqual(createWorld(42, opts));
  });

  it('gives different worlds for different seeds', () => {
    const a = createWorld(1, { ...opts, biome: 'forest' }).state;
    const b = createWorld(2, { ...opts, biome: 'forest' }).state;
    expect(a.seed).not.toBe(b.seed);
  });

  it.each(['forest', 'island'] as const)(
    'starts %s with the confirmed founder numbers',
    (biome) => {
      const { state } = createWorld(7, { ...opts, biome });
      const start = CONFIG.biomes[biome];
      expect(state.biome).toBe(biome);
      expect(state.resources).toEqual({
        food: start.food,
        water: start.water,
        stamina: CONFIG.baseStamina,
      });
      expect(state.wildStock).toBe(start.wildStock);
      expect(state.wildCap).toBe(start.wildCap);
    },
  );

  it('starts at turn 1 with the default length and nothing pending', () => {
    const { state } = createWorld(7, opts);
    expect(state.turn).toBe(1);
    expect(state.generationCount).toBe(CONFIG.generationCount);
    expect(state.turnSeconds).toBe(CONFIG.turnSeconds);
    expect(state.pending).toEqual([]);
    expect(state.weakened).toBe(0);
  });

  it('sets the founder stage on each plot, with no wear', () => {
    const { plots } = createWorld(7, opts).state;
    expect(plots['field-1']?.stage).toBe('empty');
    expect(plots['orchard-1']?.stage).toBe('empty');
    expect(plots['reservoir']?.stage).toBe('cracked');
    expect(plots['well']?.stage).toBe('none');
    for (const plot of Object.values(plots)) {
      expect(plot.wear).toBe(0);
      expect(plot.lastMaintainedTurn).toBeNull();
    }
  });

  it('keeps every event inside the world length', () => {
    const { state } = createWorld(7, { ...opts, generationCount: 3 });
    expect(state.generationCount).toBe(3);
    for (const event of state.events) {
      expect(event.turn).toBeGreaterThanOrEqual(1);
      expect(event.turn).toBeLessThanOrEqual(3);
    }
  });

  it('records no transitions', () => {
    expect(createWorld(7, opts).transitions).toEqual([]);
  });
});
