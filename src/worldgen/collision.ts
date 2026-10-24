import { bfsDistance, rectTiles } from './grid';
import type { DecoTile, PlotKind, Point, TileMap } from './types';

/** Plots you walk up to rather than onto. The player interacts from an adjacent tile. */
export const SOLID_PLOT_KINDS: ReadonlySet<PlotKind> = new Set(['orchard', 'reservoir', 'well', 'lectern']);
export const BLOCKING_DECO: ReadonlySet<DecoTile> = new Set(['rock', 'bush']);

/**
 * Collision grid for WASD movement: 1 = blocked, 0 = walkable, indexed like the layers
 * (`y * width + x`). Derived from the layers, so it's never stored separately.
 */
export function buildCollision(map: TileMap): Uint8Array {
  const { terrain, boundary, deco } = map.layers;
  const grid = new Uint8Array(map.width * map.height);
  for (let i = 0; i < grid.length; i++) {
    const d = deco[i];
    if (boundary[i] !== null || terrain[i] === 'water' || (d && BLOCKING_DECO.has(d))) grid[i] = 1;
  }
  for (const plot of map.plots) {
    if (SOLID_PLOT_KINDS.has(plot.kind)) for (const i of rectTiles(map, plot)) grid[i] = 1;
  }
  return grid;
}

/** True if (x, y) is on the map and walkable. Out of bounds counts as blocked. */
export function isWalkable(map: Pick<TileMap, 'width' | 'height'>, grid: Uint8Array, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && grid[y * map.width + x] === 0;
}

/** Steps from `from` to every tile over walkable ground, -1 where unreachable. */
export function walkDistance(map: TileMap, grid: Uint8Array, from: Point = map.spawn): Int32Array {
  return bfsDistance(map, [from.y * map.width + from.x], (i) => grid[i] === 0);
}
