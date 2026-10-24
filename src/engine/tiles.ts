// Fields and orchards are worked one tile at a time (decision 019). Each of their tiles is its own
// PlotState, keyed `<plot>:<x>,<y>` with x and y counted from the plot's top-left tile, so every
// rule that works on plots (ripening, wear, rot, causes) works on tiles unchanged.

import type { PlotId, PlotKind } from './types';

/** Plot kinds whose tiles are separate plots: one crop per field tile, one tree per orchard tile. */
export const TILED_KINDS: ReadonlySet<PlotKind> = new Set(['field', 'orchard']);

/** Where a tile sits: its map plot and its offset in tiles from that plot's top-left. */
export interface TileRef {
  plot: PlotId;
  x: number;
  y: number;
}

export function tileId(plot: PlotId, x: number, y: number): PlotId {
  return `${plot}:${x},${y}`;
}

/** The tile an id names, or null for a whole plot. */
export function tileOf(id: PlotId): TileRef | null {
  const m = /^(.+):(\d+),(\d+)$/.exec(id);
  return m ? { plot: m[1]!, x: Number(m[2]), y: Number(m[3]) } : null;
}

/** The map plot an engine plot belongs to: itself, or the plot a tile is part of. */
export function mapPlotOf(id: PlotId): PlotId {
  return tileOf(id)?.plot ?? id;
}
