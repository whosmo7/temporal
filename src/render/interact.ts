import { TILED_KINDS, tileId } from '../engine';
import type { Plot, PlotId, TileMap } from '../worldgen';
import { PLAYER_HITBOX } from './constants';
import type { Facing, Walker } from './movement';

/** How far (tiles) the player's hitbox may be from a plot's edge and still use it. */
export const REACH = 0.6;

const STEP: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * What the player can use right now: the field or orchard tile they face (decision 019), or else
 * the nearest whole plot. Pure, so the prompt logic is tested without Pixi.
 */
export function interactTarget(map: TileMap, w: Walker): PlotId | null {
  return facedTile(map, w) ?? nearbyPlot(map, w);
}

/** The tile next to the player's feet in the direction they face, as a tile id, if it's a field or orchard tile. */
export function facedTile(map: TileMap, w: Walker): PlotId | null {
  const step = STEP[w.facing];
  // A hair above the feet, so standing on a tile's bottom edge counts as standing on that tile.
  const x = Math.floor(w.x) + step.x;
  const y = Math.floor(w.y - 0.01) + step.y;
  for (const p of map.plots) {
    if (!TILED_KINDS.has(p.kind)) continue;
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return tileId(p.id, x - p.x, y - p.y);
  }
  return null;
}

/** True if the tile in front of the player is a pond or the sea, where the can fills (decision 027). */
export function facingWater(map: TileMap, w: Walker): boolean {
  const step = STEP[w.facing];
  const x = Math.floor(w.x) + step.x;
  const y = Math.floor(w.y - 0.01) + step.y;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  return map.layers.terrain[i] === 'water' || map.layers.boundary[i] === 'sea';
}

/**
 * The whole plot the player can use: the nearest one whose rectangle comes within `REACH` of the
 * player's hitbox, preferring the one they're facing. Fields and orchards are left out: their
 * tiles are used one at a time, by facing them.
 */
export function nearbyPlot(map: TileMap, w: Walker): PlotId | null {
  const box = { left: w.x - PLAYER_HITBOX.w / 2, right: w.x + PLAYER_HITBOX.w / 2, top: w.y - PLAYER_HITBOX.h, bottom: w.y };
  let best: { id: PlotId; score: number } | null = null;
  for (const p of map.plots) {
    if (TILED_KINDS.has(p.kind)) continue;
    const gap = rectGap(box, p);
    if (gap > REACH) continue;
    const score = gap - (facing(w, p) ? 0.5 : 0);
    if (!best || score < best.score) best = { id: p.id, score };
  }
  return best?.id ?? null;
}

function rectGap(b: { left: number; right: number; top: number; bottom: number }, p: Plot): number {
  const dx = Math.max(p.x - b.right, 0, b.left - (p.x + p.w));
  const dy = Math.max(p.y - b.bottom, 0, b.top - (p.y + p.h));
  return Math.hypot(dx, dy);
}

function facing(w: Walker, p: Plot): boolean {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const fy = w.y - PLAYER_HITBOX.h / 2;
  if (w.facing === 'left') return cx < w.x;
  if (w.facing === 'right') return cx > w.x;
  if (w.facing === 'up') return cy < fy;
  return cy > fy;
}
