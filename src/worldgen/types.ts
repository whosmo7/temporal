// The `TileMap` contract (03) between worldgen, the engine's createWorld (A) and the renderer (B).
// `Biome` and `PlotKind` match inheritance-core ids.md. When src/engine/types.ts exists, import them
// from there instead and delete these copies.

export type Biome = 'forest' | 'island';
export type PlotKind = 'field' | 'orchard' | 'reservoir' | 'well' | 'wild' | 'lectern' | 'graveyard';
/** `field-1`, `field-2`, …, `orchard-1`, otherwise the kind itself (ids.md). */
export type PlotId = string;

/** Walkable ground, except `water` (ponds inside the boundary). Sea lives in the boundary layer. */
export type TerrainTile = 'grass' | 'dirt' | 'sand' | 'water' | 'path';
/** What frames the map. Never walkable. `null` = inside the boundary. */
export type BoundaryTile = 'tree' | 'sea';
/** Seeded visual scatter. `rock` and `bush` block movement, `flower` doesn't. */
export type DecoTile = 'rock' | 'bush' | 'flower';

export interface Point {
  x: number;
  y: number;
}

export interface Plot {
  id: PlotId;
  kind: PlotKind;
  /** Top-left tile. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Layers are flat, row-major arrays of `width * height` tiles: the tile at (x, y) is at
 * `y * width + x` (see `tileIndex`). Plain data, so it survives JSON and structuredClone.
 */
export interface TileMap {
  width: number;
  height: number;
  biome: Biome;
  seed: number;
  layers: {
    terrain: TerrainTile[];
    boundary: (BoundaryTile | null)[];
    deco: (DecoTile | null)[];
  };
  plots: Plot[];
  spawn: Point;
}

export function tileIndex(map: { width: number }, x: number, y: number): number {
  return y * map.width + x;
}
