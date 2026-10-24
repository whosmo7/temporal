import { rectGap, type Grid } from './grid';
import { plotSlots, WorldgenError, type WorldgenOptions } from './options';
import type { Rng } from './rng';
import type { Furniture, House, Point } from './types';

export const HOUSE_SIZE = { w: 7, h: 5 } as const;

/**
 * Room layout relative to the house's top-left, in the 5×3 interior (x 1–5, y 1–3).
 * Back wall: cabinet, oven, window gap, shelf, plant. Bed on the right, table bottom-left,
 * rug in front of the door. The tiles in front of the oven and cabinet stay free.
 *
 *   y0  W W W W W W W      W wall
 *   y1  W c o . s p W      c cabinet  o oven  s shelf  p plant
 *   y2  W . . . . b W      b bed (1×2)
 *   y3  W t . r . b W      t table  r rug (walkable)
 *   y4  W W W D W W W      D door
 */
const FURNITURE: Furniture[] = [
  { kind: 'cabinet', x: 1, y: 1, w: 1, h: 1 },
  { kind: 'oven', x: 2, y: 1, w: 1, h: 1 },
  { kind: 'shelf', x: 4, y: 1, w: 1, h: 1 },
  { kind: 'plant', x: 5, y: 1, w: 1, h: 1 },
  { kind: 'bed', x: 5, y: 2, w: 1, h: 2 },
  { kind: 'table', x: 1, y: 3, w: 1, h: 1 },
  { kind: 'rug', x: 3, y: 3, w: 1, h: 1 },
];

/** Builds the house record for a top-left position. */
export function houseAt(x: number, y: number): House {
  const { w, h } = HOUSE_SIZE;
  return {
    x,
    y,
    w,
    h,
    door: { x: x + Math.floor(w / 2), y: y + h - 1 },
    interior: { x: x + 1, y: y + 1, w: w - 2, h: h - 2 },
    furniture: FURNITURE.map((f) => ({ ...f, x: x + f.x, y: y + f.y })),
  };
}

/** The outdoor tile in front of the door: where the path network starts. */
export function entranceOf(house: House): Point {
  return { x: house.door.x, y: house.door.y + 1 };
}

/** The player's start tile: inside, just above the door. */
export function spawnOf(house: House): Point {
  return { x: house.door.x, y: house.door.y - 1 };
}

/**
 * Places the house on farmable ground with its entrance within `houseRange` of `anchor`,
 * a tile clear of the boundary all round, and `plotSpacing` from any pinned plot.
 * `pin.house` fixes it instead. Runs before ponds, which then keep off it.
 */
export function placeHouse(g: Grid, inside: Uint8Array, edgeDist: Int32Array, anchor: Point, o: WorldgenOptions, rng: Rng): House {
  const pinnedPlots = plotSlots(o).flatMap((s) => {
    const at = o.pin[s.id];
    return at ? [{ ...at, ...o.plotSizes[s.kind] }] : [];
  });
  const fits = (house: House) => {
    if (house.x < 0 || house.y < 0 || house.x + house.w > g.width || house.y + house.h + 1 > g.height) return false;
    for (let y = house.y; y <= house.y + house.h; y++) {
      for (let x = house.x; x < house.x + house.w; x++) {
        // Footprint plus the entrance row, all at least one tile in from the boundary.
        if (!inside[y * g.width + x] || edgeDist[y * g.width + x]! < 2) return false;
      }
    }
    return pinnedPlots.every((p) => rectGap(p, house) >= o.plotSpacing);
  };

  if (o.pin.house) {
    const house = houseAt(o.pin.house.x, o.pin.house.y);
    if (!fits(house)) {
      throw new WorldgenError(`pinned house at (${house.x}, ${house.y}) is off the farmable area or too close to a pinned plot`);
    }
    return house;
  }

  const candidates: House[] = [];
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const house = houseAt(x, y);
      const e = entranceOf(house);
      if (Math.max(Math.abs(e.x - anchor.x), Math.abs(e.y - anchor.y)) <= o.houseRange && fits(house)) candidates.push(house);
    }
  }
  if (candidates.length === 0) {
    throw new WorldgenError(`no room for the house within ${o.houseRange} tiles of (${anchor.x}, ${anchor.y}); try a bigger map or a larger houseRange`);
  }
  return rng.pick(candidates);
}
