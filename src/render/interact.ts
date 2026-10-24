import type { Plot, PlotId, TileMap } from '../worldgen';
import { PLAYER_HITBOX } from './constants';
import type { Walker } from './movement';

/** How far (tiles) the player's hitbox may be from a plot's edge and still use it. */
export const REACH = 0.6;

/**
 * The plot the player can use right now: the nearest one whose rectangle comes within `REACH`
 * of the player's hitbox, preferring the one they're facing. Pure, so the prompt logic is tested
 * without Pixi.
 */
export function nearbyPlot(map: TileMap, w: Walker): PlotId | null {
  const box = { left: w.x - PLAYER_HITBOX.w / 2, right: w.x + PLAYER_HITBOX.w / 2, top: w.y - PLAYER_HITBOX.h, bottom: w.y };
  let best: { id: PlotId; score: number } | null = null;
  for (const p of map.plots) {
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
