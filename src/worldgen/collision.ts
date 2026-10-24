import { bfsDistance, rectTiles } from './grid';
import type { DecoTile, FurnitureKind, PlotKind, Point, TileMap } from './types';

/** Plots you walk up to rather than onto. The player interacts from an adjacent tile. */
export const SOLID_PLOT_KINDS: ReadonlySet<PlotKind> = new Set(['orchard', 'reservoir', 'well', 'lectern', 'graveyard']);
export const BLOCKING_DECO: ReadonlySet<DecoTile> = new Set(['rock', 'bush']);
/** Furniture you can walk over. Everything else blocks. */
export const WALKABLE_FURNITURE: ReadonlySet<FurnitureKind> = new Set(['rug']);

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
  const house = map.house;
  if (house) {
    // Walls block, the door and the room don't, then furniture blocks inside the room.
    for (const i of rectTiles(map, house)) grid[i] = 1;
    for (const i of rectTiles(map, house.interior)) grid[i] = 0;
    grid[house.door.y * map.width + house.door.x] = 0;
    for (const f of house.furniture) if (!WALKABLE_FURNITURE.has(f.kind)) for (const i of rectTiles(map, f)) grid[i] = 1;
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
