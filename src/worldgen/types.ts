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

/** House furniture. `cabinet` is the food store (sprite stages `store/<full|half|empty|rotting>`). `rug` is walkable. */
export type FurnitureKind = 'oven' | 'cabinet' | 'bed' | 'table' | 'shelf' | 'plant' | 'rug';

export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The player's house: a 7×5 footprint with 1-tile walls round a 5×3 room, and the door in the
 * middle of the bottom wall. Entering lifts the roof (`04`). Coordinates are map tiles.
 */
export interface House {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The door tile, in the bottom wall. Walkable. */
  door: Point;
  /** The walkable room inside the walls. */
  interior: { x: number; y: number; w: number; h: number };
  furniture: Furniture[];
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
  /** `null` when the preset turns the house off. */
  house: House | null;
  /** Where the player starts: inside the house just above the door, or outdoors with no house. */
  spawn: Point;
}

export function tileIndex(map: { width: number }, x: number, y: number): number {
  return y * map.width + x;
}
