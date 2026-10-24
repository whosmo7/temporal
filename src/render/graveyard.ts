// Where each gravestone stands inside the graveyard plot (`09` › graveyard layout). The renderer
// draws one stone per committed turn (`04`/`05`); this only decides positions and shapes, so the
// same graveyard always looks the same in play, the replay and the gallery.
import type { Plot } from '../worldgen';
import { TILE } from './constants';

export interface GraveSlot {
  /** Bottom-centre of the stone, in world px. */
  x: number;
  y: number;
  /** `grave/1` … `grave/4`. */
  frame: string;
}

/** Stones per row before the graveyard starts packing them closer. */
const PER_ROW = 5;
/** Row baselines inside the fence, in px below the plot's top: both clear of the front pickets. */
const ROW_BOTTOMS = [18, 31];
/** Keeps stones clear of the side rails. */
const SIDE = 7;

/** Shapes cycle in an order that never puts the same stone side by side. */
const SHAPES = [1, 3, 2, 4, 3, 1, 4, 2];

/**
 * Slots for `count` stones in generation order: back row first, left to right, then forward. Rows
 * fill evenly across the plot's width; past `PER_ROW × rows` stones the rows pack tighter
 * rather than spill out of the fence.
 */
export function graveSlots(plot: Pick<Plot, 'x' | 'y' | 'w' | 'h'>, count: number): GraveSlot[] {
  if (count <= 0) return [];
  const w = plot.w * TILE;
  const scaleY = plot.h / 3; // rows were laid out for the default 3-tile depth
  const rows = ROW_BOTTOMS.length;
  const perRow = Math.max(PER_ROW, Math.ceil(count / rows));
  const step = (w - 2 * SIDE) / perRow;
  const slots: GraveSlot[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    slots.push({
      x: Math.round(plot.x * TILE + SIDE + step * (col + 0.5)),
      y: Math.round(plot.y * TILE + ROW_BOTTOMS[Math.min(row, rows - 1)]! * scaleY),
      frame: `grave/${SHAPES[i % SHAPES.length]}`,
    });
  }
  return slots;
}
