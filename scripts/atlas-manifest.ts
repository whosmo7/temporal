/**
 * Which pack sprite becomes which atlas frame (`09`). Frame names follow
 * `inheritance-core/references/ids.md`; anything not listed here keeps the renderer's painted
 * placeholder (src/render/placeholder-art.ts) until it has art.
 *
 * Coordinates are in 16 px tiles of the source sheet unless `px` is set. Recolour maps move the
 * pack's olive greens and orange sand onto the art-direction palette (docs/art/art-direction.md ›
 * Recolour only when needed), so recoloured frames are marked "modified" in ASSETS.md.
 */

export const PACK = 'art/source/ninja-adventure/Ninja Adventure - Asset Pack';

const TILESETS = `${PACK}/Backgrounds/Tilesets`;
const FLOOR = `${TILESETS}/TilesetFloor.png`;
const WATER = `${TILESETS}/TilesetWater.png`;
const NATURE = `${TILESETS}/TilesetNature.png`;
const ELEMENT = `${TILESETS}/TilesetElement.png`;
const PLAYER_WALK = `${PACK}/Actor/Character/Villager4/SeparateAnim/Walk.png`;

const INK = { '#141b1b': '#1f2027' };

/** Source colour → palette colour. Colours not listed stay as the pack drew them. */
export const RECOLOUR = {
  grass: { '#adbc3a': '#91de89', '#a8a129': '#a4ed93' },
  dirt: { '#d3865f': '#bea479', '#bd7959': '#956d42', '#adbc3a': '#91de89', '#a8a129': '#a4ed93' },
  sand: { '#ffad5d': '#f0dfa8', '#ef914f': '#dcc68a' },
  path: { '#ffad5d': '#e7d7a1', '#ef914f': '#cebb99' },
  water: { '#71ddee': '#53c2db', '#a3c5c3': '#a8e6f0', '#54a0bf': '#4191a8', '#79b8ce': '#53c2db' },
  sea: { '#71ddee': '#4191a8', '#a3c5c3': '#53c2db', '#54a0bf': '#36779b', '#79b8ce': '#4191a8' },
  // Wall trees and bushes sit darker than the grass so the boundary reads at a glance.
  foliage: {
    ...INK,
    '#adbc3a': '#61aa81',
    '#74a334': '#3a6757',
    '#4a7f4b': '#3c5461',
    '#7a7a3e': '#3a6757',
    '#546626': '#3c5461',
    '#e46d3a': '#956d42',
    '#965746': '#6f4e4c',
    '#a3754e': '#6f4e4c',
    '#965340': '#6f4e4c',
    '#4e484a': '#3c5461',
  },
  flower: { ...INK, '#adbc3a': '#91de89', '#74a334': '#61aa81', '#4a7f4b': '#3a6757', '#277144': '#3a6757' },
  // Gravestones in `rock` grey with an ink outline (art direction › Plots › Graveyard).
  stone: {
    ...INK,
    '#bd7959': '#8d8b96',
    '#d2b37d': '#b3b1bb',
    '#965340': '#62606c',
    '#e46d3a': '#8d8b96',
    '#eecf9b': '#b3b1bb',
    '#5f7160': '#62606c',
    '#8d977f': '#8d8b96',
    '#56634d': '#4e4c57',
    '#b6beb0': '#b3b1bb',
  },
} satisfies Record<string, Record<string, string>>;

export interface FrameSpec {
  name: string;
  src: string;
  /** Tile column and row, or pixel x and y when `px` is true. */
  x: number;
  y: number;
  /** Size in tiles (default 1×1), or pixels when `px` is true. */
  w?: number;
  h?: number;
  px?: boolean;
  /** Mirror left-right, for a variant the sheet doesn't have. */
  flipX?: boolean;
  recolour?: keyof typeof RECOLOUR;
}

const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;

export const FRAMES: FrameSpec[] = [
  // Terrain: plain centre tiles, no autotile edges (the renderer draws one frame per tile).
  { name: 'terrain/grass-1', src: FLOOR, x: 0, y: 12, recolour: 'grass' },
  { name: 'terrain/grass-2', src: FLOOR, x: 3, y: 12, recolour: 'grass' },
  { name: 'terrain/grass-3', src: FLOOR, x: 4, y: 12, recolour: 'grass' },
  // The sheet has one dirt tile with no grass at its edges; the second variant is it mirrored.
  { name: 'terrain/dirt-1', src: FLOOR, x: 1, y: 8, recolour: 'dirt' },
  { name: 'terrain/dirt-2', src: FLOOR, x: 1, y: 8, recolour: 'dirt', flipX: true },
  { name: 'terrain/sand-1', src: FLOOR, x: 0, y: 5, recolour: 'sand' },
  { name: 'terrain/sand-2', src: FLOOR, x: 3, y: 5, recolour: 'sand' },
  { name: 'terrain/path-1', src: FLOOR, x: 0, y: 5, recolour: 'path' },
  { name: 'terrain/path-2', src: FLOOR, x: 2, y: 5, recolour: 'path' },
  { name: 'terrain/water-1', src: WATER, x: 1, y: 1, recolour: 'water' },
  { name: 'terrain/water-2', src: WATER, x: 11, y: 1, recolour: 'water' },

  // Boundary: Island sea (deeper water), Forest wall trees (2×2 tiles, centred on their tile).
  { name: 'boundary/sea-1', src: WATER, x: 1, y: 1, recolour: 'sea' },
  { name: 'boundary/sea-2', src: WATER, x: 11, y: 1, recolour: 'sea' },
  { name: 'boundary/tree-1', src: NATURE, x: 0, y: 0, w: 2, h: 2, recolour: 'foliage' },
  { name: 'boundary/tree-2', src: NATURE, x: 16, y: 0, w: 2, h: 2, recolour: 'foliage' },

  // Deco.
  { name: 'deco/rock-1', src: NATURE, x: 18, y: 9, recolour: 'stone' },
  { name: 'deco/bush-1', src: NATURE, x: 1, y: 10, recolour: 'foliage' },
  { name: 'deco/flower-1', src: NATURE, x: 3, y: 11, recolour: 'flower' },
  { name: 'deco/flower-2', src: NATURE, x: 6, y: 11, recolour: 'flower' },

  // Graveyard stones: tombstone, cross, post. The fourth, a fieldstone, is drawn (scripts/art/compose.ts).
  { name: 'grave/1', src: ELEMENT, x: 4, y: 2, recolour: 'stone' },
  { name: 'grave/2', src: ELEMENT, x: 3, y: 2, recolour: 'stone' },
  { name: 'grave/3', src: ELEMENT, x: 5, y: 2, recolour: 'stone' },

  // Player (Villager4, chosen by C): Walk.png has a column per direction and a row per frame.
  ...DIRECTIONS.flatMap((facing, col) =>
    [0, 1, 2, 3].map((frame): FrameSpec => ({ name: `player/walk-${facing}-${frame}`, src: PLAYER_WALK, x: col, y: frame })),
  ),
];
