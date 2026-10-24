// Code-drawn placeholder art, used until C's atlas exists (`09`). Colours are the art-direction
// palette (docs/art/art-direction.md). Every frame carries its final name from inheritance-assets
// (`terrain/grass-1`, `field/ripe`, `store/half`, `player/walk-down-0`, …), so the real atlas drops
// in by name. Missing names fall back to a loud magenta `missing` frame.
import type { Biome, FurnitureKind, PlotKind } from '../worldgen';
import { TILE } from './constants';

/** Art-direction palette tokens. */
export const P = {
  grassLight: '#a4ed93',
  grass: '#91de89',
  grassShade: '#61aa81',
  tree: '#3a6757',
  shadow: 'rgba(60,84,97,0.4)',
  path: '#e7d7a1',
  pathShade: '#cebb99',
  dirt: '#bea479',
  ledge: '#956d42',
  rock: '#62606c',
  stone: '#8d8b96',
  stoneLight: '#b3b1bb',
  cloud: '#fefadb',
  peachLight: '#fccca7',
  peach: '#ffc19d',
  rose: '#ecaa8e',
  clay: '#b48471',
  bark: '#6f4e4c',
  plum: '#404363',
  sea: '#53c2db',
  seaDeep: '#4191a8',
  ink: '#1f2027',
  muted: '#87786b',
  food: '#d95763',
  stamina: '#f2b84b',
  sand: '#f0dfa8',
  sandShade: '#dcc68a',
  wornLeaf: '#c9c06a',
} as const;

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaintedAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, FrameRect>;
}

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, w: number, h: number) => void;

/** Every visual stage per plot kind (ids.md). `lectern` and `graveyard` look the same always. */
export const PLOT_STAGES: Record<PlotKind, string[]> = {
  field: ['empty', 'sown', 'growing', 'ripe', 'rotten'],
  orchard: ['empty', 'sapling', 'young', 'fruiting', 'worn', 'dead'],
  reservoir: ['cracked', 'low', 'full'],
  well: ['none', 'clear', 'stagnant'],
  wild: ['many', 'few', 'none'],
  lectern: ['default'],
  graveyard: ['default'],
};
export const STORE_STAGES = ['full', 'half', 'empty', 'rotting'] as const;

/** Deterministic per-pixel hash in [0, 1), so placeholders look the same every load. */
function noise(x: number, y: number, salt: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function px(ctx: Ctx, x: number, y: number, colour: string, w = 1, h = 1): void {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Filled rectangle with a 1 px ink outline. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, outline: string = P.ink): void {
  px(ctx, x, y, outline, w, h);
  px(ctx, x + 1, y + 1, fill, w - 2, h - 2);
}

function speckle(ctx: Ctx, x0: number, y0: number, w: number, h: number, base: string, dots: [string, number][], salt: number): void {
  px(ctx, x0, y0, base, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = noise(x, y, salt);
      let acc = 0;
      for (const [colour, p] of dots) {
        acc += p;
        if (r < acc) {
          px(ctx, x0 + x, y0 + y, colour);
          break;
        }
      }
    }
  }
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, colour: string): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px(ctx, x, y, colour);
    }
  }
}

/** Disc with a 1 px ink outline. */
function ball(ctx: Ctx, cx: number, cy: number, r: number, fill: string): void {
  disc(ctx, cx, cy, r + 1, P.ink);
  disc(ctx, cx, cy, r, fill);
}

function shadow(ctx: Ctx, x: number, y: number, w: number): void {
  px(ctx, x + 1, y, P.shadow, w, 2);
}

// --- Terrain, boundary, deco ---------------------------------------------------------------

const grass = (salt: number): Painter => (ctx, w, h) => {
  speckle(ctx, 0, 0, w, h, P.grass, [[P.grassLight, 0.1], [P.grassShade, 0.05]], salt);
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(noise(i, salt, 7) * 11);
    const y = 4 + Math.floor(noise(salt, i, 9) * 9);
    px(ctx, x, y, P.grassShade);
    px(ctx, x + 1, y - 1, P.grassShade);
    px(ctx, x + 2, y, P.grassShade);
  }
};
const dirt = (salt: number): Painter => (ctx, w, h) => speckle(ctx, 0, 0, w, h, P.dirt, [[P.ledge, 0.08], [P.pathShade, 0.08]], salt);
const sand = (salt: number): Painter => (ctx, w, h) => speckle(ctx, 0, 0, w, h, P.sand, [[P.sandShade, 0.12], [P.cloud, 0.05]], salt);
const path = (salt: number): Painter => (ctx, w, h) => {
  speckle(ctx, 0, 0, w, h, P.path, [[P.pathShade, 0.12]], salt);
  for (let i = 0; i < 2; i++) px(ctx, 1 + Math.floor(noise(i, salt, 3) * 13), 1 + Math.floor(noise(salt, i, 5) * 13), P.pathShade, 2, 1);
};
const water = (base: string, crest: string, salt: number): Painter => (ctx, w, h) => {
  px(ctx, 0, 0, base, w, h);
  for (let i = 0; i < 3; i++) px(ctx, Math.floor(noise(i, salt, 11) * 12), 2 + Math.floor(noise(salt, i, 13) * 12), crest, 3, 1);
};

/** 16×32: the canopy overhangs the tile above, the trunk sits on the tile. Anchor at the bottom. */
const tree = (salt: number): Painter => (ctx) => {
  shadow(ctx, 3, 29, 11);
  box(ctx, 6, 22, 4, 9, P.bark);
  ball(ctx, 8, 13, 7.5, P.tree);
  disc(ctx, 6.5, 10.5, 4.5, salt === 1 ? '#4d8068' : '#47796a');
  px(ctx, 5, 8, '#6c9c84', 2, 1);
};
const rock: Painter = (ctx) => {
  shadow(ctx, 3, 14, 11);
  ball(ctx, 8, 10, 4.5, P.stone);
  px(ctx, 6, 7, P.stoneLight, 3, 1);
};
const bush: Painter = (ctx) => {
  shadow(ctx, 3, 14, 11);
  ball(ctx, 8, 9.5, 5, P.grassShade);
  disc(ctx, 7, 8.5, 2.5, P.grass);
  px(ctx, 10, 9, P.food);
};
const flower = (petal: string): Painter => (ctx) => {
  for (const [x, y] of [
    [4, 6],
    [10, 10],
    [6, 12],
  ] as const) {
    px(ctx, x, y + 1, P.grassShade);
    px(ctx, x - 1, y, petal);
    px(ctx, x + 1, y, petal);
    px(ctx, x, y - 1, petal);
    px(ctx, x, y, P.stamina);
  }
};
/** Drought: cracked earth laid over grass and dirt. */
const cracks: Painter = (ctx) => {
  for (let i = 0; i < 2; i++) {
    let x = 2 + Math.floor(noise(i, 3, 41) * 10);
    let y = 2 + Math.floor(noise(i, 4, 41) * 6);
    for (let s = 0; s < 7; s++) {
      px(ctx, x, y, 'rgba(111,78,76,0.55)');
      x += noise(i, s, 43) < 0.5 ? 1 : 0;
      y += 1;
    }
  }
};

/** 16×24 villager, 1 px ink outline. Frames 0–3 alternate the legs; frame 0 doubles as idle. */
const player = (facing: 'down' | 'up' | 'left' | 'right', frame: number): Painter => (ctx) => {
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  shadow(ctx, 3, 22, 10);
  box(ctx, 4, 17, 4, 6 + Math.max(0, -step), P.plum);
  box(ctx, 8, 17, 4, 6 + Math.max(0, step), P.plum);
  box(ctx, 3, 10, 10, 9, P.food);
  px(ctx, 4, 11, '#e8808a', 8, 2);
  box(ctx, 4, 3, 8, 8, P.peachLight);
  px(ctx, 4, 2, P.ink, 8, 1);
  px(ctx, 4, 3, P.bark, 8, 3);
  if (facing === 'up') px(ctx, 5, 4, P.bark, 6, 6);
  if (facing === 'down') {
    px(ctx, 6, 7, P.ink);
    px(ctx, 9, 7, P.ink);
  }
  if (facing === 'left') {
    px(ctx, 5, 7, P.ink);
    px(ctx, 9, 4, P.bark, 2, 4);
  }
  if (facing === 'right') {
    px(ctx, 10, 7, P.ink);
    px(ctx, 5, 4, P.bark, 2, 4);
  }
};

const grave = (shape: number): Painter => (ctx) => {
  shadow(ctx, 3, 14, 10);
  if (shape === 1) box(ctx, 4, 4, 8, 11, P.stone);
  if (shape === 2) {
    ball(ctx, 8, 7, 3.5, P.stone);
    box(ctx, 4, 7, 8, 8, P.stone);
    px(ctx, 5, 7, P.stone, 6, 2);
  }
  if (shape === 3) {
    box(ctx, 7, 2, 2, 13, P.stone);
    box(ctx, 4, 5, 8, 3, P.stone);
    px(ctx, 7, 5, P.stone, 2, 3);
  }
  if (shape === 4) box(ctx, 3, 8, 10, 7, P.stone);
  px(ctx, 6, 9, P.rock, 4, 1);
};

// --- House: exterior, interior, furniture (house is a fixed 7×5) ---------------------------

const HOUSE_W = 7 * TILE;
const HOUSE_H = 5 * TILE;
/** How far the roof reaches above the footprint, in art px. */
export const ROOF_OVERHANG = 12;

/** Roof over rows 0–3 and the front wall with its door on row 4. Anchor at the bottom-left. */
const houseExterior: Painter = (ctx) => {
  const top = 0;
  const roofH = ROOF_OVERHANG + 4 * TILE;
  // front wall
  box(ctx, 2, roofH - 2, HOUSE_W - 4, TILE + 2, P.cloud);
  for (const wx of [TILE + 2, 5 * TILE + 2]) {
    box(ctx, wx, roofH + 2, 12, 9, P.sea);
    px(ctx, wx + 6, roofH + 3, P.ink, 1, 7);
  }
  box(ctx, 3 * TILE + 2, roofH, 12, TILE, P.bark);
  px(ctx, 3 * TILE + 11, roofH + 8, P.stamina);
  // roof: rows of shingles in rose/clay, ridge at the top
  box(ctx, 0, top, HOUSE_W, roofH, P.rose);
  for (let y = top + 4; y < roofH - 2; y += 5) {
    px(ctx, 1, y, P.clay, HOUSE_W - 2, 1);
    for (let x = (y / 5) % 2 === 0 ? 3 : 7; x < HOUSE_W - 2; x += 9) px(ctx, x, y - 4, P.clay, 1, 4);
  }
  px(ctx, 1, top + 1, P.peach, HOUSE_W - 2, 2);
  px(ctx, 0, roofH - 3, P.ink, HOUSE_W, 1);
  // chimney
  box(ctx, HOUSE_W - 26, top - 0, 8, 12, P.stone);
};

/** Floor, walls seen from above, back wall with a window. No overhang; anchor top-left. */
const houseInterior: Painter = (ctx) => {
  // floor planks
  for (let y = TILE; y < HOUSE_H - TILE; y += 4) {
    px(ctx, TILE, y, y % 8 === 0 ? P.clay : '#c2917c', 5 * TILE, 4);
    for (let x = TILE + ((y / 4) % 3) * 7; x < 6 * TILE; x += 21) px(ctx, x, y, P.bark, 1, 4);
  }
  // back wall face (row 0): wallpaper + skirting, window in the middle
  px(ctx, 0, 0, P.peachLight, HOUSE_W, TILE);
  for (let x = 4; x < HOUSE_W; x += 8) px(ctx, x, 2, P.peach, 2, TILE - 6);
  px(ctx, 0, TILE - 3, P.bark, HOUSE_W, 3);
  box(ctx, 3 * TILE + 1, 2, 14, 9, '#9fe0ea');
  px(ctx, 3 * TILE + 8, 3, P.ink, 1, 7);
  // side walls and bottom wall from above (full tiles; a lighter top edge facing the room)
  px(ctx, 0, TILE, P.bark, TILE, HOUSE_H - TILE);
  px(ctx, HOUSE_W - TILE, TILE, P.bark, TILE, HOUSE_H - TILE);
  px(ctx, TILE - 3, TILE, P.clay, 3, HOUSE_H - 2 * TILE);
  px(ctx, HOUSE_W - TILE, TILE, P.clay, 3, HOUSE_H - 2 * TILE);
  px(ctx, 0, HOUSE_H - TILE, P.bark, HOUSE_W, TILE);
  px(ctx, 0, HOUSE_H - TILE, P.clay, HOUSE_W, 3);
  // door gap with a mat
  px(ctx, 3 * TILE, HOUSE_H - TILE, P.clay, TILE, TILE);
  px(ctx, 3 * TILE + 2, HOUSE_H - TILE + 4, P.food, TILE - 4, TILE - 8);
  px(ctx, 0, 0, P.ink, HOUSE_W, 1);
};

const FURNITURE_SIZE: Record<Exclude<FurnitureKind, 'cabinet'>, [number, number]> = {
  oven: [TILE, 24],
  bed: [TILE, 2 * TILE + 4],
  table: [TILE, 20],
  shelf: [TILE, 24],
  plant: [TILE, 24],
  rug: [TILE, TILE],
};

const furniture: Record<Exclude<FurnitureKind, 'cabinet'>, Painter> = {
  oven: (ctx) => {
    box(ctx, 1, 6, 14, 17, P.rock);
    px(ctx, 2, 7, P.stone, 12, 3);
    ball(ctx, 5, 8, 1.2, P.ink);
    ball(ctx, 11, 8, 1.2, P.ink);
    box(ctx, 3, 12, 10, 8, P.ink, P.ink);
    px(ctx, 4, 13, '#f08c4a', 8, 6);
    px(ctx, 5, 15, P.stamina, 6, 2);
    box(ctx, 10, 0, 4, 7, P.stone); // flue
  },
  bed: (ctx) => {
    box(ctx, 1, 2, 14, 34, P.bark);
    box(ctx, 2, 3, 12, 8, P.cloud);
    box(ctx, 2, 10, 12, 24, P.seaDeep);
    px(ctx, 3, 11, P.sea, 10, 2);
  },
  table: (ctx) => {
    shadow(ctx, 2, 18, 12);
    box(ctx, 1, 4, 14, 8, P.clay);
    px(ctx, 2, 5, P.peach, 12, 2);
    box(ctx, 2, 11, 2, 8, P.bark);
    box(ctx, 12, 11, 2, 8, P.bark);
    ball(ctx, 8, 6, 1.5, P.food);
  },
  shelf: (ctx) => {
    box(ctx, 1, 1, 14, 22, P.bark);
    for (const [y, c] of [
      [3, P.seaDeep],
      [10, P.food],
      [17, P.grassShade],
    ] as const) {
      px(ctx, 2, y + 5, P.clay, 12, 1);
      px(ctx, 3, y, c, 2, 5);
      px(ctx, 6, y + 1, P.stamina, 2, 4);
      px(ctx, 9, y, P.plum, 3, 5);
    }
  },
  plant: (ctx) => {
    box(ctx, 4, 16, 8, 7, P.clay);
    ball(ctx, 8, 10, 5, P.grassShade);
    disc(ctx, 6, 8, 2.5, P.grass);
    box(ctx, 7, 2, 2, 6, P.grassShade);
  },
  rug: (ctx) => {
    box(ctx, 1, 3, 14, 10, P.food);
    px(ctx, 3, 5, P.peach, 10, 1);
    px(ctx, 3, 10, P.peach, 10, 1);
  },
};

/** The cabinet is the food store; its stage shows how much food the world holds. 16×28. */
const cabinet = (stage: (typeof STORE_STAGES)[number]): Painter => (ctx) => {
  box(ctx, 0, 1, 16, 26, P.bark);
  px(ctx, 1, 2, P.clay, 14, 2);
  box(ctx, 2, 5, 12, 9, '#4b3a39');
  box(ctx, 2, 15, 12, 10, '#4b3a39');
  const shelfFood = stage === 'full' ? 6 : stage === 'half' ? 3 : stage === 'rotting' ? 4 : 0;
  for (let i = 0; i < shelfFood; i++) {
    const row = i < 3 ? 6 : 16;
    const x = 3 + (i % 3) * 4;
    const rotten = stage === 'rotting' && i % 2 === 0;
    ball(ctx, x + 1.5, row + 3.5, 1.5, rotten ? P.muted : i % 2 ? P.stamina : P.food);
  }
  if (stage === 'rotting') {
    px(ctx, 4, 0, P.ink);
    px(ctx, 11, 1, P.ink);
    px(ctx, 9, 4, P.ink);
  }
  px(ctx, 7, 14, P.stamina, 2, 1); // handle
};

const missing: Painter = (ctx, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(ctx, x, y, (x >> 2) % 2 === (y >> 2) % 2 ? '#ff00ff' : '#000');
};

const FRAMES: [name: string, w: number, h: number, paint: Painter][] = [
  ['missing', TILE, TILE, missing],
  ['terrain/grass-1', TILE, TILE, grass(1)],
  ['terrain/grass-2', TILE, TILE, grass(2)],
  ['terrain/grass-3', TILE, TILE, grass(3)],
  ['terrain/dirt-1', TILE, TILE, dirt(1)],
  ['terrain/dirt-2', TILE, TILE, dirt(2)],
  ['terrain/sand-1', TILE, TILE, sand(1)],
  ['terrain/sand-2', TILE, TILE, sand(2)],
  ['terrain/path-1', TILE, TILE, path(1)],
  ['terrain/path-2', TILE, TILE, path(2)],
  ['terrain/water-1', TILE, TILE, water(P.sea, '#a8e6f0', 1)],
  ['terrain/water-2', TILE, TILE, water(P.sea, '#a8e6f0', 2)],
  ['terrain/cracks-1', TILE, TILE, cracks],
  ['boundary/sea-1', TILE, TILE, water(P.seaDeep, P.sea, 3)],
  ['boundary/sea-2', TILE, TILE, water(P.seaDeep, P.sea, 4)],
  ['boundary/tree-1', TILE, TILE * 2, tree(1)],
  ['boundary/tree-2', TILE, TILE * 2, tree(2)],
  ['deco/rock-1', TILE, TILE, rock],
  ['deco/bush-1', TILE, TILE, bush],
  ['deco/flower-1', TILE, TILE, flower(P.food)],
  ['deco/flower-2', TILE, TILE, flower(P.cloud)],
  ['grave/1', TILE, TILE, grave(1)],
  ['grave/2', TILE, TILE, grave(2)],
  ['grave/3', TILE, TILE, grave(3)],
  ['grave/4', TILE, TILE, grave(4)],
  ['house/exterior', HOUSE_W, HOUSE_H + ROOF_OVERHANG, houseExterior],
  ['house/interior', HOUSE_W, HOUSE_H, houseInterior],
  ...STORE_STAGES.map((s): [string, number, number, Painter] => [`store/${s}`, TILE, 28, cabinet(s)]),
  ...(Object.keys(furniture) as (keyof typeof furniture)[]).map((k): [string, number, number, Painter] => [
    `furniture/${k}`,
    FURNITURE_SIZE[k][0],
    FURNITURE_SIZE[k][1],
    furniture[k],
  ]),
  ...(['down', 'up', 'left', 'right'] as const).flatMap((facing) =>
    [0, 1, 2, 3].map((frame): [string, number, number, Painter] => [`player/walk-${facing}-${frame}`, TILE, 24, player(facing, frame)]),
  ),
];

/** Every fixed frame name, for the dev sprite sheet. */
export const FRAME_NAMES = FRAMES.map(([name]) => name);

/** How many numbered variants each base frame has, for picking one per tile. */
export const VARIANTS: Record<string, number> = {
  'terrain/grass': 3,
  'terrain/dirt': 2,
  'terrain/sand': 2,
  'terrain/path': 2,
  'terrain/water': 2,
  'boundary/sea': 2,
  'boundary/tree': 2,
  'deco/rock': 1,
  'deco/bush': 1,
  'deco/flower': 2,
};

/** Paints every fixed-size frame into one atlas canvas (2 px padding, shelf-packed). */
export function paintAtlas(): PaintedAtlas {
  const width = 512;
  const pad = 2;
  const frames: Record<string, FrameRect> = {};
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const [name, w, h] of FRAMES) {
    if (x + w + pad > width) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    frames[name] = { x, y, w, h };
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = y + rowH + pad;
  const ctx = canvas.getContext('2d')!;
  for (const [name, w, h, paint] of FRAMES) {
    const f = frames[name]!;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    paint(ctx, w, h);
    ctx.restore();
  }
  return { canvas, frames };
}

// --- Plot frames, painted at the plot's size (presets can change plot sizes) ---------------------

/** Extra art pixels a plot sprite reaches above its footprint (trees, posts, rings, the lectern). */
export const PLOT_OVERHANG: Partial<Record<PlotKind, number>> = { orchard: 16, well: 6, lectern: 10, graveyard: 6 };

/**
 * Paints `<kind>/<stage>` for a plot of `wTiles × hTiles`. The canvas is the footprint plus
 * `PLOT_OVERHANG` on top; anchor it at its bottom-left.
 */
export function paintPlot(kind: PlotKind, stage: string, wTiles: number, hTiles: number, biome: Biome): HTMLCanvasElement {
  const over = PLOT_OVERHANG[kind] ?? 0;
  const w = wTiles * TILE;
  const h = hTiles * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + over;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(0, over);
  const painter = PLOT_PAINTERS[kind]?.[stage];
  if (painter) painter(ctx, w, h, biome);
  else missing(ctx, w, h);
  return canvas;
}

type PlotPainter = (ctx: Ctx, w: number, h: number, biome: Biome) => void;

function tilled(ctx: Ctx, w: number, h: number): void {
  speckle(ctx, 0, 0, w, h, P.dirt, [[P.ledge, 0.06]], 21);
  for (let y = 3; y < h - 1; y += 5) px(ctx, 2, y, P.ledge, w - 4, 2);
  px(ctx, 0, 0, P.ledge, w, 1);
  px(ctx, 0, h - 1, P.ledge, w, 1);
}

/** Calls `fn` at each planting spot of a field (one per 5 px furrow, every 5 px along). */
function rows(w: number, h: number, fn: (x: number, y: number, i: number) => void): void {
  let i = 0;
  for (let y = 3; y < h - 1; y += 5) for (let x = 4; x < w - 3; x += 5) fn(x, y, i++);
}

function fence(ctx: Ctx, w: number, h: number): void {
  for (let x = 1; x < w; x += 6) {
    box(ctx, x, -5, 3, 7, P.clay);
    box(ctx, x, h - 6, 3, 7, P.clay);
  }
  px(ctx, 0, -3, P.bark, w, 1);
  px(ctx, 0, h - 4, P.bark, w, 1);
}

function basin(ctx: Ctx, w: number, h: number, inner: (x: number, y: number, iw: number, ih: number) => void): void {
  box(ctx, 0, 0, w, h, P.stone);
  px(ctx, 1, 1, P.stoneLight, w - 2, 2);
  px(ctx, 3, 4, P.ink, w - 6, h - 7);
  inner(4, 5, w - 8, h - 9);
}

function tree2(ctx: Ctx, w: number, h: number, leaf: string, fruit: number, fruitColour: string): void {
  const cx = w / 2;
  shadow(ctx, cx - 9, h - 3, 18);
  box(ctx, cx - 3, h - 14, 6, 12, P.bark);
  ball(ctx, cx, h - 22, Math.min(w / 2 - 2, 13), leaf);
  disc(ctx, cx - 4, h - 26, 5, leaf === P.tree ? '#4d8068' : '#ddd585');
  for (let i = 0; i < fruit; i++) ball(ctx, cx - 8 + noise(i, 1, 51) * 16, h - 30 + noise(i, 2, 51) * 14, 1.5, fruitColour);
}

function deer(ctx: Ctx, x: number, y: number): void {
  box(ctx, x, y, 9, 5, P.ledge);
  box(ctx, x + 7, y - 4, 3, 5, P.ledge);
  px(ctx, x + 1, y + 5, P.ink, 1, 3);
  px(ctx, x + 7, y + 5, P.ink, 1, 3);
}

const PLOT_PAINTERS: Partial<Record<PlotKind, Record<string, PlotPainter>>> = {
  field: {
    empty: (ctx, w, h) => tilled(ctx, w, h),
    sown: (ctx, w, h) => {
      tilled(ctx, w, h);
      rows(w, h, (x, y) => px(ctx, x, y, P.bark, 2, 1));
    },
    growing: (ctx, w, h) => {
      tilled(ctx, w, h);
      rows(w, h, (x, y) => {
        px(ctx, x, y - 2, P.grassShade, 1, 3);
        px(ctx, x + 1, y - 3, P.grass, 1, 2);
      });
    },
    ripe: (ctx, w, h) => {
      tilled(ctx, w, h);
      rows(w, h, (x, y, i) => {
        px(ctx, x, y - 4, P.grassShade, 1, 5);
        px(ctx, x - 1, y - 2, P.grass, 3, 1);
        ball(ctx, x + 0.5, y - 5, 1.3, i % 2 ? P.stamina : P.food);
      });
    },
    rotten: (ctx, w, h) => {
      tilled(ctx, w, h);
      rows(w, h, (x, y) => {
        px(ctx, x - 1, y - 1, P.muted, 3, 2);
        px(ctx, x + 1, y - 2, P.bark, 1, 1);
      });
      for (let i = 0; i < 4; i++) px(ctx, 4 + noise(i, 3, 61) * (w - 8), 2 + noise(i, 4, 61) * (h - 6), P.ink);
    },
  },
  orchard: {
    empty: (ctx, w, h) => {
      speckle(ctx, 2, 2, w - 4, h - 4, P.dirt, [[P.ledge, 0.08]], 22);
      box(ctx, w / 2 - 1, h / 2 - 6, 3, 9, P.clay);
    },
    sapling: (ctx, w, h) => {
      speckle(ctx, 2, 2, w - 4, h - 4, P.dirt, [[P.ledge, 0.08]], 22);
      box(ctx, w / 2 - 1, h / 2 - 8, 3, 12, P.bark);
      ball(ctx, w / 2 - 3, h / 2 - 8, 2, P.grass);
      ball(ctx, w / 2 + 3, h / 2 - 10, 2, P.grass);
    },
    young: (ctx, w, h) => {
      speckle(ctx, 2, 2, w - 4, h - 4, P.dirt, [[P.ledge, 0.08]], 22);
      shadow(ctx, w / 2 - 6, h - 6, 12);
      box(ctx, w / 2 - 2, h - 16, 4, 10, P.bark);
      ball(ctx, w / 2, h - 20, 7, P.tree);
      disc(ctx, w / 2 - 2, h - 23, 3, '#4d8068');
    },
    fruiting: (ctx, w, h) => tree2(ctx, w, h, P.tree, 7, P.food),
    worn: (ctx, w, h) => tree2(ctx, w, h, P.wornLeaf, 2, P.food),
    dead: (ctx, w, h) => {
      speckle(ctx, 2, 2, w - 4, h - 4, P.dirt, [[P.ledge, 0.08]], 22);
      shadow(ctx, w / 2 - 6, h - 6, 12);
      box(ctx, w / 2 - 4, h - 12, 8, 8, P.muted);
      px(ctx, w / 2 - 3, h - 11, P.stoneLight, 6, 1);
      box(ctx, w / 2 + 3, h - 18, 2, 7, P.muted);
    },
  },
  reservoir: {
    cracked: (ctx, w, h) =>
      basin(ctx, w, h, (x, y, iw, ih) => {
        px(ctx, x, y, P.dirt, iw, ih);
        for (let i = 0; i < 4; i++) {
          let cx = x + 2 + Math.floor(noise(i, 1, 31) * (iw - 4));
          let cy = y + 1;
          for (let s = 0; s < ih - 2; s++) {
            px(ctx, cx, cy, P.bark);
            cx += noise(i, s, 33) < 0.5 ? 1 : -1;
            cy += 1;
          }
        }
      }),
    low: (ctx, w, h) =>
      basin(ctx, w, h, (x, y, iw, ih) => {
        px(ctx, x, y, P.dirt, iw, ih);
        px(ctx, x, y + ih - 5, P.sea, iw, 5);
        px(ctx, x + 2, y + ih - 5, '#a8e6f0', 4, 1);
      }),
    full: (ctx, w, h) =>
      basin(ctx, w, h, (x, y, iw, ih) => {
        px(ctx, x, y, P.sea, iw, ih);
        px(ctx, x + 2, y + 2, '#a8e6f0', 6, 1);
        px(ctx, x + iw - 10, y + ih - 4, '#a8e6f0', 5, 1);
      }),
  },
  well: {
    none: (ctx, w, h) => {
      speckle(ctx, 1, 1, w - 2, h - 2, P.dirt, [[P.ledge, 0.12]], 23);
      for (const [x, y] of [
        [1, -3],
        [w - 3, -3],
        [1, h - 7],
        [w - 3, h - 7],
      ] as const) {
        box(ctx, x, y, 2, 6, P.clay, P.bark);
      }
    },
    clear: (ctx, w, h) => {
      ball(ctx, w / 2, h / 2 - 1, 7, P.stone);
      disc(ctx, w / 2, h / 2 - 1, 4, P.ink);
      disc(ctx, w / 2, h / 2 - 1, 3, P.sea);
      px(ctx, w / 2 - 2, h / 2 - 3, '#a8e6f0', 2, 1);
    },
    stagnant: (ctx, w, h) => {
      ball(ctx, w / 2, h / 2 - 1, 7, P.stone);
      disc(ctx, w / 2, h / 2 - 1, 4, P.ink);
      disc(ctx, w / 2, h / 2 - 1, 3, P.grassShade);
      px(ctx, w / 2 - 1, h / 2 - 2, P.tree, 2, 1);
      px(ctx, w / 2 + 2, h / 2 - 6, P.ink);
    },
  },
  wild: Object.fromEntries(
    (['many', 'few', 'none'] as const).map((stage) => [
      stage,
      (ctx: Ctx, w: number, h: number, biome: Biome) => {
        const count = stage === 'many' ? 3 : stage === 'few' ? 1 : 0;
        if (biome === 'island') {
          px(ctx, 0, 0, P.sea, w, h);
          for (let y = 1; y < h; y += 4) box(ctx, 3, y, w - 6, 4, P.clay, P.bark);
          for (let i = 0; i < count; i++) {
            const fx = 1 + Math.floor(noise(i, 5, 71) * (w - 8));
            const fy = 2 + Math.floor(noise(i, 6, 71) * (h - 5));
            px(ctx, fx, fy, P.cloud, 5, 1);
            px(ctx, fx + 1, fy + 1, P.seaDeep, 3, 1);
          }
          return;
        }
        speckle(ctx, 0, 0, w, h, P.grassShade, [[P.tree, 0.2], [P.grass, 0.08]], 24);
        for (let x = 1; x < w; x += 3) px(ctx, x, 1 + (x % 4), P.tree, 1, 4);
        if (count === 0) for (let i = 0; i < 3; i++) px(ctx, 6 + i * 7, h - 6 - i * 4, P.bark, 2, 1); // only tracks left
        const spots: [number, number][] = [
          [3, h - 10],
          [w - 13, 6],
          [w / 2 - 4, h / 2],
        ];
        for (let i = 0; i < count; i++) deer(ctx, spots[i]![0], spots[i]![1]);
      },
    ]),
  ),
  lectern: {
    default: (ctx, w, h) => {
      shadow(ctx, 3, h - 2, w - 6);
      box(ctx, w / 2 - 2, -4, 4, h + 2, P.bark);
      box(ctx, 1, -10, w - 2, 7, P.clay);
      px(ctx, 2, -11, P.cloud, w - 4, 4);
      px(ctx, w / 2, -11, P.pathShade, 1, 4);
    },
  },
  graveyard: {
    default: (ctx, w, h) => {
      speckle(ctx, 0, 0, w, h, P.grassShade, [[P.tree, 0.06], [P.grass, 0.1]], 25);
      fence(ctx, w, h);
    },
  },
};
