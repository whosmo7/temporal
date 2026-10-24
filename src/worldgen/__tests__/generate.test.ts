import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKING_DECO,
  buildCollision,
  generateMap,
  plotSlots,
  PRESETS,
  resolveOptions,
  SOLID_PLOT_KINDS,
  toAscii,
  walkDistance,
  WorldgenError,
  type Biome,
  type PresetName,
  type TileMap,
} from '..';
import { rectBorder, rectGap, rectTiles } from '../grid';
import { fbm, valueNoise } from '../noise';
import { createRng, hash } from '../rng';

const BIOMES: Biome[] = ['forest', 'island'];
/** The seed sweeps take ~3 s; give them room on a busy CI machine instead of the 5 s default. */
const SWEEP_TIMEOUT = 60_000;

/** Every property a generated map must have, whatever the seed or preset. */
function expectValidMap(map: TileMap, label: string): void {
  const size = map.width * map.height;
  expect(map.layers.terrain, label).toHaveLength(size);
  expect(map.layers.boundary, label).toHaveLength(size);
  expect(map.layers.deco, label).toHaveLength(size);

  const grid = buildCollision(map);
  const spawn = map.spawn.y * map.width + map.spawn.x;
  expect(grid[spawn], `${label}: spawn is walkable`).toBe(0);
  const dist = walkDistance(map, grid);

  for (const plot of map.plots) {
    const where = `${label}: ${plot.id}`;
    expect(plot.x >= 0 && plot.y >= 0 && plot.x + plot.w <= map.width && plot.y + plot.h <= map.height, where).toBe(true);
    for (const i of rectTiles(map, plot)) {
      expect(map.layers.boundary[i], `${where} on boundary`).toBeNull();
      expect(map.layers.terrain[i], `${where} in water`).not.toBe('water');
      const d = map.layers.deco[i];
      expect(d === null || !BLOCKING_DECO.has(d), `${where} under deco`).toBe(true);
    }
    const approach = SOLID_PLOT_KINDS.has(plot.kind) ? rectBorder(map, plot) : rectTiles(map, plot);
    expect(
      approach.some((i) => dist[i]! >= 0),
      `${where} reachable from spawn`,
    ).toBe(true);
  }

  for (let a = 0; a < map.plots.length; a++) {
    for (let b = a + 1; b < map.plots.length; b++) {
      expect(rectGap(map.plots[a]!, map.plots[b]!), `${label}: ${map.plots[a]!.id} overlaps ${map.plots[b]!.id}`).toBeGreaterThanOrEqual(0);
    }
  }
}

describe('generateMap', () => {
  it.each(BIOMES)('same seed gives an identical %s map', (biome) => {
    for (const seed of [0, 1, 123, 0xdeadbeef]) {
      const a = generateMap(seed, biome);
      const b = generateMap(seed, biome);
      expect(b).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    }
  });

  it('different seeds give different maps', () => {
    const maps = new Set([1, 2, 3, 4, 5].map((s) => toAscii(generateMap(s, 'forest'))));
    expect(maps.size).toBe(5);
  });

  it.each(BIOMES)('1000 random %s seeds: all plots reachable, no overlaps', (biome) => {
    const rng = createRng(hash('worldgen-sweep', biome));
    for (let n = 0; n < 1000; n++) {
      const seed = Math.floor(rng.next() * 0x100000000);
      expectValidMap(generateMap(seed, biome), `${biome} seed ${seed}`);
    }
  }, SWEEP_TIMEOUT);

  it.each(Object.keys(PRESETS) as PresetName[])('preset %s gives valid maps in both biomes', (name) => {
    for (const biome of BIOMES) {
      for (let seed = 0; seed < 100; seed++) {
        const map = generateMap(seed, biome, name);
        const opts = resolveOptions(biome, PRESETS[name]);
        expect([map.width, map.height]).toEqual([opts.width, opts.height]);
        expect(map.plots.map((p) => p.id)).toEqual(plotSlots(opts).map((s) => s.id));
        expectValidMap(map, `${name}/${biome} seed ${seed}`);
      }
    }
  }, SWEEP_TIMEOUT);

  it('has 2 fields and the canonical plot IDs by default', () => {
    expect(generateMap(7, 'forest').plots.map((p) => p.id)).toEqual([
      'field-1',
      'field-2',
      'orchard-1',
      'reservoir',
      'well',
      'wild',
      'lectern',
      'graveyard',
    ]);
  });

  it('frames Forest with trees and Island with sea', () => {
    const forest = generateMap(5, 'forest');
    const island = generateMap(5, 'island');
    expect(new Set(forest.layers.boundary.filter(Boolean))).toEqual(new Set(['tree']));
    expect(new Set(island.layers.boundary.filter(Boolean))).toEqual(new Set(['sea']));
    expect(island.layers.terrain).toContain('sand');
    expect(forest.layers.terrain).not.toContain('sand');
  });

  it('keeps the plot spacing, puts the lectern near spawn and the wild spot on the edge', () => {
    for (const biome of BIOMES) {
      for (let seed = 0; seed < 50; seed++) {
        const map = generateMap(seed, biome);
        const opts = resolveOptions(biome);
        for (let a = 0; a < map.plots.length; a++) {
          for (let b = a + 1; b < map.plots.length; b++) {
            expect(rectGap(map.plots[a]!, map.plots[b]!)).toBeGreaterThanOrEqual(opts.plotSpacing);
          }
        }
        const lectern = map.plots.find((p) => p.kind === 'lectern')!;
        expect(Math.max(Math.abs(lectern.x - map.spawn.x), Math.abs(lectern.y - map.spawn.y))).toBeLessThanOrEqual(opts.lecternRange);
        const wild = map.plots.find((p) => p.kind === 'wild')!;
        const touchesEdge = rectBorder(map, wild).some((i) => map.layers.boundary[i] !== null);
        expect(touchesEdge, `${biome} seed ${seed}`).toBe(true);
      }
    }
  });

  it('changing decoration does not move plots or paths', () => {
    const plain = generateMap(42, 'island', { decoDensity: 0 });
    const busy = generateMap(42, 'island', { decoDensity: 0.2, decoWeights: { flower: 0 } });
    expect(busy.plots).toEqual(plain.plots);
    expect(busy.layers.terrain).toEqual(plain.layers.terrain);
    expect(busy.layers.deco.some(Boolean)).toBe(true);
    expect(busy.layers.deco).not.toContain('flower');
    expect(plain.layers.deco.every((d) => d === null)).toBe(true);
  });
});

describe('customisation', () => {
  it('supports any map size, including non-square', () => {
    const map = generateMap(3, 'forest', { width: 48, height: 20 });
    expect([map.width, map.height]).toEqual([48, 20]);
    expectValidMap(map, '48x20');
  });

  it('supports a field count and custom plot sizes', () => {
    const map = generateMap(3, 'island', { width: 40, height: 40, fields: 4, plotSizes: { orchard: { w: 4, h: 4 } } });
    expect(map.plots.filter((p) => p.kind === 'field')).toHaveLength(4);
    expect(map.plots.find((p) => p.kind === 'orchard')).toMatchObject({ w: 4, h: 4 });
    expectValidMap(map, 'custom plots');
  });

  it('places pinned plots exactly and seeds the rest around them', () => {
    for (let seed = 0; seed < 20; seed++) {
      const map = generateMap(seed, 'forest', { pin: { reservoir: { x: 6, y: 6 }, 'field-1': { x: 20, y: 20 } } });
      expect(map.plots.find((p) => p.id === 'reservoir')).toMatchObject({ x: 6, y: 6 });
      expect(map.plots.find((p) => p.id === 'field-1')).toMatchObject({ x: 20, y: 20 });
      expectValidMap(map, `pinned seed ${seed}`);
    }
  });

  it('honours a custom spawn', () => {
    const map = generateMap(1, 'forest', { spawn: { x: 10, y: 20 } });
    expect(map.spawn).toEqual({ x: 10, y: 20 });
    expectValidMap(map, 'custom spawn');
  });

  it('rejects bad options with a WorldgenError', () => {
    expect(() => generateMap(1, 'forest', { width: 8 })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { fields: 0 })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { boundaryDepth: { min: 4, max: 2 } })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { pin: { 'field-3': { x: 5, y: 5 } } })).toThrow(/not a plot/);
    expect(() => generateMap(1, 'forest', { pin: { well: { x: 0, y: 0 } } })).toThrow(/boundary/);
    expect(() => generateMap(1, 'forest', { pin: { well: { x: 6, y: 6 }, wild: { x: 7, y: 7 } } })).toThrow(/overlaps/);
    expect(() => generateMap(1, 'forest', { spawn: { x: 0, y: 0 } })).toThrow(/outside the boundary/);
  });

  it('fails loudly instead of looping when plots cannot fit', () => {
    expect(() => generateMap(1, 'island', { width: 16, height: 16, fields: 9, maxAttempts: 3 })).toThrow(
      /couldn't place every plot/,
    );
  });
});

describe('performance', () => {
  it('generates a map in under 50 ms', () => {
    for (let s = 0; s < 5; s++) generateMap(s, 'forest'); // warm up the JIT
    for (const biome of BIOMES) {
      const start = performance.now();
      const runs = 100;
      for (let seed = 0; seed < runs; seed++) generateMap(seed, biome);
      expect((performance.now() - start) / runs).toBeLessThan(50);
    }
  }, SWEEP_TIMEOUT);
});

describe('noise and rng', () => {
  it('value noise is deterministic, seed-dependent and in [0, 1)', () => {
    const a = valueNoise(1, 'x');
    const b = valueNoise(1, 'x');
    const c = valueNoise(2, 'x');
    const f = fbm(1, 'y', { frequency: 0.1, octaves: 3 });
    let differs = false;
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const y = i * 0.61 - 40;
      expect(a(x, y)).toBe(b(x, y));
      if (a(x, y) !== c(x, y)) differs = true;
      for (const v of [a(x, y), f(x, y)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
    expect(differs).toBe(true);
  });

  it('rng repeats per seed', () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('purity', () => {
  it('worldgen source uses no global randomness, clock, DOM, React or Pixi', () => {
    const dir = join(import.meta.dirname, '..');
    const banned = /Math\.random|Date\.now|new Date\b|performance\.now|crypto\.|\bwindow\b|\bdocument\b|from ['"](react|pixi\.js|node:)/;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const code = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, file).not.toMatch(banned);
    }
  });
});
