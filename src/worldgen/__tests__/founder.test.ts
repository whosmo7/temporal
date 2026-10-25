import { describe, expect, it } from 'vitest';
import { founderState, generateEvents, WorldgenError, type Biome, type EventConfig } from '..';
import { FOUNDER_CONFIG } from '../__fixtures__/founder-config';

const BIOMES: Biome[] = ['forest', 'island'];

function eventConfig(generationCount: number, overrides: Partial<EventConfig> = {}): EventConfig {
  return {
    ...FOUNDER_CONFIG,
    generationCount,
    stormBiomes: { forest: false, island: true },
    ...overrides,
  };
}

describe('generateEvents', () => {
  it('gives the same events for the same seed', () => {
    for (const biome of BIOMES) {
      expect(generateEvents(77, biome, eventConfig(6))).toEqual(generateEvents(77, biome, eventConfig(6)));
    }
  });

  it('every world has exactly one drought of min(5, ceil(gens / 10)) consecutive gens, never in gen 1', () => {
    for (let gens = 1; gens <= 80; gens++) {
      const expectedLength = Math.min(5, Math.ceil(gens / 10));
      for (let seed = 0; seed < 50; seed++) {
        const drought = generateEvents(seed, 'island', eventConfig(gens)).filter((e) => e.kind === 'drought');
        const turns = drought.map((e) => e.turn);
        const where = `gens ${gens} seed ${seed}`;
        expect(turns, where).toHaveLength(expectedLength);
        turns.forEach((t, i) => expect(t, where).toBe(turns[0]! + i));
        expect(new Set(drought.map((e) => e.spellId)).size, where).toBe(1);
        expect(turns.at(-1)!, where).toBeLessThanOrEqual(gens);
        expect(turns[0]!, where).toBeGreaterThanOrEqual(gens === 1 ? 1 : 2);
      }
    }
  });

  it('a 1-generation world has its drought in gen 1', () => {
    expect(generateEvents(3, 'forest', eventConfig(1))).toEqual([
      { id: 'drought-1', kind: 'drought', turn: 1, spellId: 'drought-1' },
    ]);
  });

  it('the drought can start in any gen from 2 to the last one it fits in', () => {
    const starts = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      starts.add(generateEvents(seed, 'forest', eventConfig(6)).find((e) => e.kind === 'drought')!.turn);
    }
    expect([...starts].sort()).toEqual([2, 3, 4, 5, 6]);

    const longStarts = new Set<number>();
    for (let seed = 0; seed < 2000; seed++) {
      longStarts.add(generateEvents(seed, 'forest', eventConfig(15)).find((e) => e.kind === 'drought')!.turn);
    }
    expect(Math.min(...longStarts)).toBe(2);
    expect(Math.max(...longStarts)).toBe(14); // 2-gen drought must end by gen 15
  });

  it('places one good harvest outside the drought', () => {
    for (let seed = 0; seed < 300; seed++) {
      const events = generateEvents(seed, 'forest', eventConfig(6));
      const drought = new Set(events.filter((e) => e.kind === 'drought').map((e) => e.turn));
      const harvests = events.filter((e) => e.kind === 'goodHarvest');
      expect(harvests).toHaveLength(1);
      expect(drought.has(harvests[0]!.turn)).toBe(false);
    }
  });

  it('storms only on Island, about half the time, never during the drought', () => {
    let storms = 0;
    const runs = 1000;
    for (let seed = 0; seed < runs; seed++) {
      expect(generateEvents(seed, 'forest', eventConfig(6)).some((e) => e.kind === 'storm')).toBe(false);
      const events = generateEvents(seed, 'island', eventConfig(6));
      const drought = new Set(events.filter((e) => e.kind === 'drought').map((e) => e.turn));
      const island = events.filter((e) => e.kind === 'storm');
      expect(island.length).toBeLessThanOrEqual(1);
      if (island[0]) {
        storms++;
        expect(drought.has(island[0].turn)).toBe(false);
      }
    }
    expect(storms / runs).toBeGreaterThan(0.43);
    expect(storms / runs).toBeLessThan(0.57);
  });

  it('Forest and Island with the same seed share their drought and good harvest', () => {
    for (let seed = 0; seed < 100; seed++) {
      const keep = (b: Biome) => generateEvents(seed, b, eventConfig(8)).filter((e) => e.kind !== 'storm');
      expect(keep('island')).toEqual(keep('forest'));
    }
  });

  it('lists events in turn order with unique ids', () => {
    for (let seed = 0; seed < 200; seed++) {
      const events = generateEvents(seed, 'island', eventConfig(30));
      const turns = events.map((e) => e.turn);
      expect(turns).toEqual([...turns].sort((a, b) => a - b));
      expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    }
  });

  it('rejects a world with no generations', () => {
    expect(() => generateEvents(1, 'forest', eventConfig(0))).toThrow(WorldgenError);
    expect(() => generateEvents(1, 'forest', eventConfig(2.5))).toThrow(WorldgenError);
  });
});

describe('founderState', () => {
  it('uses the biome starter numbers', () => {
    const forest = founderState(10, 'forest', FOUNDER_CONFIG);
    const island = founderState(10, 'island', FOUNDER_CONFIG);
    expect(forest.resources).toEqual({ food: 12, water: 16, stamina: 100, hunger: 100, can: 0 });
    expect(island.resources).toEqual({ food: 12, water: 18, stamina: 100, hunger: 100, can: 0 });
    expect([forest.wildStock, forest.wildCap]).toEqual([8, 10]);
    expect([island.wildStock, island.wildCap]).toEqual([8, 8]);
  });

  it('starts every plot empty, with a cracked reservoir and an undug well', () => {
    const state = founderState(10, 'forest', FOUNDER_CONFIG, 'large');
    expect(Object.keys(state.plots)).toEqual(state.map.plots.map((p) => p.id));
    expect(state.plots['field-3']).toEqual({ kind: 'field', stage: 'empty' });
    expect(state.plots['orchard-1']).toEqual({ kind: 'orchard', stage: 'empty' });
    expect(state.plots.reservoir).toEqual({ kind: 'reservoir', stage: 'cracked' });
    expect(state.plots.well).toEqual({ kind: 'well', stage: 'none' });
    expect(state.plots.graveyard).toEqual({ kind: 'graveyard' });
  });

  it('is deterministic and carries the seeded events', () => {
    const a = founderState(5, 'island', FOUNDER_CONFIG);
    expect(founderState(5, 'island', FOUNDER_CONFIG)).toEqual(a);
    expect(a.events).toEqual(generateEvents(5, 'island', eventConfig(6)));
    expect(a.events.some((e) => e.kind === 'drought')).toBe(true);
  });
});
