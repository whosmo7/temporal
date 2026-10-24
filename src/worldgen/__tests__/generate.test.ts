import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKING_DECO,
  buildCollision,
  entranceOf,
  generateMap,
  HOUSE_SIZE,
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

  const house = map.house;
  if (house) {
    for (const i of rectTiles(map, house)) {
      expect(map.layers.boundary[i], `${label}: house on boundary`).toBeNull();
      expect(map.layers.terrain[i], `${label}: house in water`).not.toBe('water');
      expect(map.layers.deco[i], `${label}: deco in house`).toBeNull();
    }
    for (const plot of map.plots) expect(rectGap(plot, house), `${label}: ${plot.id} overlaps house`).toBeGreaterThanOrEqual(0);
    const { interior } = house;
    expect(rectTiles(map, interior), `${label}: spawn inside`).toContain(spawn);
    for (const kind of ['oven', 'cabinet'] as const) {
      const f = house.furniture.find((x) => x.kind === kind)!;
      expect(rectBorder(map, f).some((i) => dist[i]! >= 0), `${label}: ${kind} reachable`).toBe(true);
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
        const door = entranceOf(map.house!);
        expect(Math.max(Math.abs(lectern.x - door.x), Math.abs(lectern.y - door.y))).toBeLessThanOrEqual(opts.lecternRange);
        for (const p of map.plots) expect(rectGap(p, map.house!)).toBeGreaterThanOrEqual(opts.plotSpacing);
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

  it('honours a custom spawn: the player starts there with no house, near it with one', () => {
    const outdoors = generateMap(1, 'forest', { spawn: { x: 10, y: 20 }, house: false });
    expect(outdoors.spawn).toEqual({ x: 10, y: 20 });
    expect(outdoors.house).toBeNull();
    expectValidMap(outdoors, 'custom spawn, no house');

    const housed = generateMap(1, 'forest', { spawn: { x: 10, y: 20 } });
    const e = entranceOf(housed.house!);
    expect(Math.max(Math.abs(e.x - 10), Math.abs(e.y - 20))).toBeLessThanOrEqual(resolveOptions('forest').houseRange);
    expectValidMap(housed, 'custom spawn, house');
  });

  it('rejects bad options with a WorldgenError', () => {
    expect(() => generateMap(1, 'forest', { width: 8 })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { fields: 0 })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { boundaryDepth: { min: 4, max: 2 } })).toThrow(WorldgenError);
    expect(() => generateMap(1, 'forest', { pin: { 'field-3': { x: 5, y: 5 } } })).toThrow(/not a plot/);
    expect(() => generateMap(1, 'forest', { pin: { well: { x: 0, y: 0 } } })).toThrow(/boundary/);
    expect(() => generateMap(1, 'forest', { pin: { wild: { x: 6, y: 6 }, well: { x: 7, y: 7 } } })).toThrow(/overlaps/);
    expect(() => generateMap(1, 'forest', { pin: { house: { x: 0, y: 0 } } })).toThrow(/pinned house/);
    expect(() => generateMap(1, 'forest', { house: false, pin: { house: { x: 9, y: 9 } } })).toThrow(/not a plot/);
    expect(() => generateMap(1, 'forest', { spawn: { x: 0, y: 0 } })).toThrow(/outside the boundary/);
  });

  it('fails loudly instead of looping when plots cannot fit', () => {
    expect(() => generateMap(1, 'island', { width: 16, height: 16, fields: 9, maxAttempts: 3, house: false })).toThrow(
      /couldn't place every plot/,
    );
    expect(() => generateMap(1, 'island', { width: 16, height: 16 })).toThrow(/no room for the house/);
  });
});

describe('house', () => {
  it('is 7×5 with a 5×3 room and the door in the middle of the bottom wall', () => {
    const { house, spawn } = generateMap(8, 'forest');
    expect(house).not.toBeNull();
    const h = house!;
    expect([h.w, h.h]).toEqual([HOUSE_SIZE.w, HOUSE_SIZE.h]);
    expect([h.w, h.h]).toEqual([7, 5]);
    expect(h.interior).toEqual({ x: h.x + 1, y: h.y + 1, w: 5, h: 3 });
    expect(h.door).toEqual({ x: h.x + 3, y: h.y + 4 });
    expect(spawn).toEqual({ x: h.door.x, y: h.door.y - 1 });
    expect(h.furniture.map((f) => f.kind).sort()).toEqual(['bed', 'cabinet', 'oven', 'plant', 'rug', 'shelf', 'table']);
  });

  it('walls block except the door; furniture blocks except the rug', () => {
    const map = generateMap(8, 'island');
    const grid = buildCollision(map);
    const h = map.house!;
    const at = (x: number, y: number) => grid[y * map.width + x];
    expect(at(h.x, h.y)).toBe(1);
    expect(at(h.x + 6, h.y + 2)).toBe(1);
    expect(at(h.door.x - 1, h.door.y)).toBe(1);
    expect(at(h.door.x, h.door.y)).toBe(0);
    for (const f of h.furniture) expect(at(f.x, f.y), f.kind).toBe(f.kind === 'rug' ? 0 : 1);
    expect(at(h.x + 2, h.y + 2)).toBe(0); // in front of the oven
  });

  it('the path network starts at the front door', () => {
    for (let seed = 0; seed < 30; seed++) {
      const map = generateMap(seed, 'forest');
      const e = entranceOf(map.house!);
      expect(map.layers.terrain[e.y * map.width + e.x], `seed ${seed}`).toBe('path');
    }
  });

  it('can be pinned or turned off', () => {
    const pinned = generateMap(4, 'forest', { pin: { house: { x: 6, y: 6 } } });
    expect(pinned.house).toMatchObject({ x: 6, y: 6 });
    expectValidMap(pinned, 'pinned house');
    expect(generateMap(4, 'forest', { house: false }).house).toBeNull();
  });
});

describe('plot sizes', () => {
  it('match the art direction by default', () => {
    const sizes = Object.fromEntries(generateMap(2, 'forest').plots.map((p) => [p.kind, [p.w, p.h]]));
    expect(sizes).toMatchObject({ field: [3, 3], orchard: [2, 2], reservoir: [3, 2], well: [1, 1], wild: [2, 2], lectern: [1, 1] });
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
