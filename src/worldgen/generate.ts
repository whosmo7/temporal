import { buildCollision, walkDistance } from './collision';
import { scatterDeco } from './deco';
import { bfsDistance, rectTiles } from './grid';
import { entranceOf, placeHouse, spawnOf } from './house';
import { buildMask, edgeDistance } from './mask';
import { fbm } from './noise';
import { plotSlots, resolveOptions, WorldgenError, type WorldgenOptions, type WorldgenPreset } from './options';
import { carvePaths } from './paths';
import { pinnedPlots, placePlots, type Site } from './plots';
import { PRESETS, type PresetName } from './presets';
import { deriveRng, hash } from './rng';
import type { Biome, BoundaryTile, House, Plot, TerrainTile, TileMap } from './types';

/**
 * Generates a world map. Pure and deterministic: the same `(seed, biome, preset)` always gives
 * a deep-equal `TileMap`. Every plot is reachable from spawn by path; throws a `WorldgenError`
 * if the options can't produce such a map.
 *
 * @param preset a name from PRESETS, or any partial `WorldgenOptions`
 */
export function generateMap(seed: number, biome: Biome, preset: WorldgenPreset | PresetName = 'default'): TileMap {
  const o = resolveOptions(biome, typeof preset === 'string' ? PRESETS[preset] : preset);
  seed = seed >>> 0;
  const { site, house } = buildSite(seed, biome, o);

  const pinned = pinnedPlots(site, o);
  const rng = deriveRng(seed, 'plots');
  for (let attempt = 0; attempt < o.maxAttempts; attempt++) {
    const plots = placePlots(site, o, pinned, rng);
    const path = plots && carvePaths(seed, site, plots, o);
    if (!plots || !path) continue;
    const deco = scatterDeco(site, plots, path, o, deriveRng(seed, 'deco'));
    const map: TileMap = {
      width: o.width,
      height: o.height,
      biome,
      seed,
      layers: { ...paintTerrain(seed, biome, site, plots, path, o), deco },
      plots,
      house,
      spawn: house ? spawnOf(house) : site.entrance,
    };
    if (treesReachable(map)) return map;
  }
  throw new WorldgenError(
    `seed ${seed} (${biome}): couldn't place every plot reachably in ${o.maxAttempts} attempts; ` +
      'try a bigger map, fewer fields or smaller plotSpacing',
  );
}

/**
 * Every orchard tile has a side the player can walk to from spawn, so each tree can be planted
 * and picked on its own (decision 019).
 */
function treesReachable(map: TileMap): boolean {
  const walk = walkDistance(map, buildCollision(map));
  const reached = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && walk[y * map.width + x]! >= 0;
  return map.plots
    .filter((p) => p.kind === 'orchard')
    .every((p) => {
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) {
          if (![[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([sx, sy]) => reached(sx!, sy!))) return false;
        }
      }
      return true;
    });
}

/** Seed-derived biome, for callers that don't choose one (open question 03.1). */
export function biomeFromSeed(seed: number): Biome {
  return hash(seed, 'biome') % 2 === 0 ? 'forest' : 'island';
}

function buildSite(seed: number, biome: Biome, o: WorldgenOptions): { site: Site; house: House | null } {
  const grid = { width: o.width, height: o.height };
  const size = o.width * o.height;
  const anchor = o.spawn ?? { x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) };

  const inside = buildMask(seed, o, anchor);
  const edgeDist = edgeDistance(grid, inside);
  // The house goes down before ponds, so a pond can never block it.
  const house = o.house ? placeHouse(grid, inside, edgeDist, anchor, o, deriveRng(seed, 'house')) : null;
  const entrance = house ? entranceOf(house) : anchor;

  const elevationNoise = fbm(seed, 'elevation', { frequency: 0.11, octaves: 3 });
  // Pinned plots keep ponds off their footprint and the ring around it, so a pinned preset
  // works with any seed.
  const pinned = plotSlots(o).flatMap((s) => {
    const at = o.pin[s.id];
    return at ? [{ ...at, ...o.plotSizes[s.kind] }] : [];
  });
  if (house) pinned.push(house);
  const nearPin = (x: number, y: number) =>
    pinned.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);

  const elevation = new Float64Array(size);
  const ground = new Uint8Array(inside);
  const waterSources: number[] = [];
  const pondable: number[] = [];
  for (let i = 0; i < size; i++) {
    const x = i % o.width;
    const y = (i - x) / o.width;
    elevation[i] = elevationNoise(x, y);
    if (!inside[i]) {
      if (biome === 'island') waterSources.push(i);
      continue;
    }
    const nearSpawn = Math.max(Math.abs(x - entrance.x), Math.abs(y - entrance.y)) <= o.spawnClearance;
    if (!nearSpawn && !nearPin(x, y) && edgeDist[i]! > o.beachWidth + 1) pondable.push(i);
  }
  // Ponds fill the lowest pondable ground until they cover `pondCoverage` of the interior.
  const insideCount = inside.reduce((n, v) => n + v, 0);
  pondable.sort((a, b) => elevation[a]! - elevation[b]! || a - b);
  for (const i of pondable.slice(0, Math.floor(insideCount * o.pondCoverage))) {
    ground[i] = 0;
    waterSources.push(i);
  }

  const underHouse = new Uint8Array(size);
  if (house) for (const i of rectTiles(grid, house)) underHouse[i] = 1;
  const reach = bfsDistance(grid, [entrance.y * o.width + entrance.x], (i) => ground[i] === 1 && !underHouse[i]);
  const open = Uint8Array.from(reach, (d) => (d >= 0 ? 1 : 0));
  const waterDist = bfsDistance(grid, waterSources, () => true);
  const site: Site = { ...grid, entrance, ground, open, obstacles: house ? [house] : [], edgeDist, waterDist, elevation };
  return { site, house };
}

function paintTerrain(seed: number, biome: Biome, site: Site, plots: Plot[], path: Uint8Array, o: WorldgenOptions) {
  const size = site.width * site.height;
  const dirtNoise = fbm(seed, 'dirt', { frequency: 0.2, octaves: 2 });
  const terrain: TerrainTile[] = new Array(size);
  const boundary: (BoundaryTile | null)[] = new Array(size).fill(null);

  for (let i = 0; i < size; i++) {
    const x = i % site.width;
    const y = (i - x) / site.width;
    if (site.edgeDist[i] === 0) {
      boundary[i] = biome === 'island' ? 'sea' : 'tree';
      terrain[i] = biome === 'island' ? 'water' : 'grass';
    } else if (!site.ground[i]) terrain[i] = 'water';
    else if (path[i]) terrain[i] = 'path';
    else if (biome === 'island' && site.edgeDist[i]! <= o.beachWidth) terrain[i] = 'sand';
    else if (dirtNoise(x, y) > o.dirtLevel) terrain[i] = 'dirt';
    else terrain[i] = 'grass';
  }
  for (const p of plots) {
    if (p.kind !== 'field') continue;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) terrain[y * site.width + x] = 'dirt';
  }
  return { terrain, boundary };
}
