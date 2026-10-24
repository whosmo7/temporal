import { describe, expect, it } from 'vitest';
import { createWorld } from '../../engine/createWorld';
import { CONFIG } from '../../engine/config';
import { TILED_KINDS, tileId } from '../../engine/tiles';
import { biomeFromSeed, founderState, generateMap } from '..';

// The worldgen side of `createWorld` (03 › Biome starter state + modifiers): the engine's world is
// the one worldgen drew, with the biome's modifiers applied.
const opts = { worldId: 'w' };

describe('createWorld uses worldgen', () => {
  it('has a plot state for every plot on the map, one per tile for fields and orchards, and nothing else', () => {
    for (const preset of ['default', 'large', 'bare'] as const) {
      const map = generateMap(9, 'island', preset);
      const { plots } = createWorld(9, { ...opts, biome: 'island', preset }).state;
      const expected = map.plots.flatMap((p) => {
        if (!TILED_KINDS.has(p.kind)) return [p.id];
        const tiles: string[] = [];
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) tiles.push(tileId(p.id, x, y));
        return tiles;
      });
      expect(Object.keys(plots)).toEqual(expected);
      for (const p of map.plots) {
        const id = TILED_KINDS.has(p.kind) ? tileId(p.id, p.w - 1, p.h - 1) : p.id;
        expect(plots[id]!.kind).toBe(p.kind);
      }
      const corner = map.plots.find((p) => p.kind === 'field');
      if (corner) expect(plots[tileId(corner.id, 1, 0)]!.tile).toEqual({ plot: corner.id, x: 1, y: 0 });
    }
  });

  it('carries the founder events for its own length', () => {
    const state = createWorld(21, { ...opts, biome: 'island', generationCount: 12 }).state;
    expect(state.events).toEqual(founderState(21, 'island', { ...CONFIG, generationCount: 12 }).events);
    expect(state.events.filter((e) => e.kind === 'drought')).toHaveLength(2); // ceil(12 / 10)
  });

  it('picks the biome from the seed when none is given', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(createWorld(seed, opts).state.biome).toBe(biomeFromSeed(seed));
    }
  });

  it('applies the biome modifiers: storms only on Island, wild cap and water per biome', () => {
    let islandStorms = 0;
    for (let seed = 0; seed < 200; seed++) {
      const forest = createWorld(seed, { ...opts, biome: 'forest' }).state;
      const island = createWorld(seed, { ...opts, biome: 'island' }).state;
      expect(forest.events.some((e) => e.kind === 'storm')).toBe(false);
      if (island.events.some((e) => e.kind === 'storm')) islandStorms++;
      expect([forest.wildCap, forest.resources.water]).toEqual([CONFIG.biomes.forest.wildCap, CONFIG.biomes.forest.water]);
      expect([island.wildCap, island.resources.water]).toEqual([CONFIG.biomes.island.wildCap, CONFIG.biomes.island.water]);
    }
    expect(islandStorms).toBeGreaterThan(0);
  });
});
