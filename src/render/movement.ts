import { PLAYER_HITBOX } from './constants';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Walker {
  /** Feet position in tiles (centre of the hitbox's bottom edge). */
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
}

export interface CollisionGrid {
  width: number;
  height: number;
  /** 1 = blocked, indexed y * width + x (see src/worldgen/collision.ts). */
  blocked: Uint8Array;
}

/** Input direction, each axis in {-1, 0, 1}. */
export interface Direction {
  x: number;
  y: number;
}

/**
 * Moves a walker for `dt` seconds. Axes are resolved separately, so walking diagonally into a
 * wall slides along it instead of stopping. Pure: returns a new walker.
 */
export function stepWalker(w: Walker, dir: Direction, speed: number, dt: number, grid: CollisionGrid): Walker {
  if (dir.x === 0 && dir.y === 0) return { ...w, moving: false };
  const len = Math.hypot(dir.x, dir.y);
  const dx = (dir.x / len) * speed * dt;
  const dy = (dir.y / len) * speed * dt;

  let { x, y } = w;
  if (dx !== 0 && !hits(x + dx, y, grid)) x += dx;
  else if (dx !== 0) x = slideTo(x, y, dx, 'x', grid);
  if (dy !== 0 && !hits(x, y + dy, grid)) y += dy;
  else if (dy !== 0) y = slideTo(x, y, dy, 'y', grid);

  return { x, y, facing: facingFor(dir, w.facing), moving: x !== w.x || y !== w.y };
}

/** True if the hitbox with feet at (x, y) overlaps a blocked or off-map tile. */
export function hits(x: number, y: number, grid: CollisionGrid): boolean {
  const left = x - PLAYER_HITBOX.w / 2;
  const right = x + PLAYER_HITBOX.w / 2;
  const top = y - PLAYER_HITBOX.h;
  const eps = 1e-6;
  for (let ty = Math.floor(top); ty <= Math.floor(y - eps); ty++) {
    for (let tx = Math.floor(left); tx <= Math.floor(right - eps); tx++) {
      if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
      if (grid.blocked[ty * grid.width + tx]) return true;
    }
  }
  return false;
}

/** Moves as far as possible toward the wall without entering it (so fast steps don't leave gaps). */
function slideTo(x: number, y: number, delta: number, axis: 'x' | 'y', grid: CollisionGrid): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blocked = axis === 'x' ? hits(x + delta * mid, y, grid) : hits(x, y + delta * mid, grid);
    if (blocked) hi = mid;
    else lo = mid;
  }
  return (axis === 'x' ? x : y) + delta * lo;
}

function facingFor(dir: Direction, previous: Facing): Facing {
  // Horizontal wins on diagonals, matching most top-down games.
  if (dir.x < 0) return 'left';
  if (dir.x > 0) return 'right';
  if (dir.y < 0) return 'up';
  if (dir.y > 0) return 'down';
  return previous;
}
