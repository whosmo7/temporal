import type { Gravestone } from '../api/Backend';
import type { Plot } from '../worldgen';
import { TILE } from './constants';
import type { Walker } from './movement';

/** Gravestone frames `grave/1`..`grave/4` (ids.md). */
export const STONE_VARIANTS = 4;

/** A stone's place in the graveyard: bottom-centre in plot px, and its draw scale. */
export interface StoneSpot {
  stone: Gravestone;
  x: number;
  y: number;
  scale: number;
  frame: string;
}

/** Room left inside the fence: sides, below the front row, above the back row (plot px). */
const PAD_X = 3;
const PAD_FRONT = 4;
const PAD_BACK = 2;
/** Visible height of a stone at scale 1. */
const STONE_H = 14;

/**
 * Lays the stones out in rows inside the graveyard (05 › Graveyard): oldest at the back left, one
 * per committed turn. Rows tighten as the graveyard fills, and past a dozen or so the stones halve
 * in size, so a long world still fits its fixed plot. Positions only move when the spacing changes.
 */
export function layoutStones(plot: Pick<Plot, 'w' | 'h'>, stones: readonly Gravestone[]): StoneSpot[] {
  const w = plot.w * TILE;
  const h = plot.h * TILE;
  const n = stones.length;
  let pitch = 16;
  let grid = gridFor(w, h, pitch);
  while (grid.cols * grid.rows < n && pitch > 4) grid = gridFor(w, h, --pitch);

  const x0 = (w - grid.cols * pitch) / 2 + pitch / 2;
  const back = h - PAD_FRONT - (grid.rows - 1) * grid.pitchY;
  return [...stones]
    .sort((a, b) => a.turn - b.turn)
    .map((stone, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const nudge = (stoneHash(stone.turn) % 3) - 1; // stones a pixel out of line look set by hand
      return {
        stone,
        x: Math.round(x0 + col * pitch + nudge),
        y: Math.round(back + row * grid.pitchY),
        scale: grid.scale,
        frame: `grave/${1 + (stoneHash(stone.turn) % STONE_VARIANTS)}`,
      };
    });
}

function gridFor(w: number, h: number, pitch: number) {
  const scale = pitch >= 11 ? 1 : 0.5;
  const pitchY = Math.max(3, Math.round(pitch * 0.8));
  const cols = Math.max(1, Math.floor((w - 2 * PAD_X) / pitch));
  const rows = Math.max(1, 1 + Math.floor((h - PAD_FRONT - PAD_BACK - STONE_H * scale) / pitchY));
  return { pitch, pitchY, scale, cols, rows };
}

/** The hover label (decision 014): the player's name and their generation. */
export function stoneLabel(stone: Gravestone): string {
  return `${stone.username} · Generation ${stone.turn}`;
}

/** The stone nearest the player, for "E · Read …'s page" at the graveyard. */
export function nearestStone(plot: Pick<Plot, 'x' | 'y'>, spots: readonly StoneSpot[], w: Walker): StoneSpot | null {
  let best: { spot: StoneSpot; d: number } | null = null;
  for (const spot of spots) {
    const d = Math.hypot(plot.x * TILE + spot.x - w.x * TILE, plot.y * TILE + spot.y - w.y * TILE);
    if (!best || d < best.d) best = { spot, d };
  }
  return best?.spot ?? null;
}

function stoneHash(turn: number): number {
  let h = Math.imul(turn ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  return Math.imul(h, 0xc2b2ae35) >>> 16;
}
