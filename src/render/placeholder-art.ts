// Code-drawn placeholder art, used until C's atlas exists (`09`). Every frame carries its final
// name from inheritance-assets (`terrain/grass-1`, `boundary/tree-1`, `player/walk-down-0`, …), so
// the real atlas drops in by name. Missing names fall back to a loud magenta `missing` frame.
import type { Biome, PlotKind } from '../worldgen';
import { TILE } from './constants';

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

/** Deterministic per-pixel hash in [0, 1), so placeholders look the same every load. */
function noise(x: number, y: number, salt: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function px(ctx: Ctx, x: number, y: number, colour: string, w = 1, h = 1): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function speckle(ctx: Ctx, w: number, h: number, base: string, dots: [string, number][], salt: number): void {
  px(ctx, 0, 0, base, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = noise(x, y, salt);
      let acc = 0;
      for (const [colour, p] of dots) {
        acc += p;
        if (r < acc) {
          px(ctx, x, y, colour);
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

// --- Fixed-size frames -----------------------------------------------------------------------

const grass = (salt: number): Painter => (ctx, w, h) => {
  speckle(ctx, w, h, '#5f9e4c', [['#4f8a3f', 0.12], ['#6fb35a', 0.08]], salt);
  // a couple of grass tufts
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(noise(i, salt, 7) * 11);
    const y = 4 + Math.floor(noise(salt, i, 9) * 9);
    px(ctx, x, y, '#3f7a33');
    px(ctx, x + 1, y - 1, '#3f7a33');
    px(ctx, x + 2, y, '#3f7a33');
  }
};

const dirt = (salt: number): Painter => (ctx, w, h) =>
  speckle(ctx, w, h, '#93673f', [['#7d5534', 0.14], ['#a77a4d', 0.08], ['#6b6b6b', 0.015]], salt);

const sand = (salt: number): Painter => (ctx, w, h) =>
  speckle(ctx, w, h, '#e2cc8c', [['#d4bb78', 0.12], ['#efdca5', 0.08]], salt);

const path = (salt: number): Painter => (ctx, w, h) => {
  speckle(ctx, w, h, '#c4b089', [['#b39e77', 0.14], ['#d3c19c', 0.08]], salt);
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(noise(i, salt, 3) * 13);
    const y = 1 + Math.floor(noise(salt, i, 5) * 13);
    px(ctx, x, y, '#9d8a66', 2, 1);
  }
};

const water = (base: string, crest: string, salt: number): Painter => (ctx, w, h) => {
  px(ctx, 0, 0, base, w, h);
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(noise(i, salt, 11) * 12);
    const y = 2 + Math.floor(noise(salt, i, 13) * 12);
    px(ctx, x, y, crest, 3, 1);
  }
};

/** 16×32: canopy overhangs the tile above, trunk sits on the tile. Anchor at the bottom. */
const tree = (salt: number): Painter => (ctx) => {
  px(ctx, 6, 24, '#5a3b22', 4, 8);
  px(ctx, 6, 24, '#6e4a2b', 1, 8);
  const dark = salt === 1 ? '#1f4a22' : '#24532a';
  disc(ctx, 8, 14, 8, dark);
  disc(ctx, 7, 12, 6, salt === 1 ? '#2f6a32' : '#2c6331');
  disc(ctx, 6, 10, 3, '#3d7f3c');
  px(ctx, 4, 21, dark, 8, 2);
};

const rock: Painter = (ctx) => {
  disc(ctx, 8, 11, 5, '#6f6f73');
  disc(ctx, 7, 10, 4, '#8a8a8f');
  px(ctx, 5, 8, '#a3a3a8', 2, 1);
  px(ctx, 3, 15, 'rgba(0,0,0,0.25)', 10, 1);
};

const bush: Painter = (ctx) => {
  disc(ctx, 8, 10, 6, '#2e6b2a');
  disc(ctx, 7, 9, 4, '#3d8536');
  px(ctx, 5, 7, '#56a04a');
  px(ctx, 10, 9, '#d94f4f');
  px(ctx, 4, 15, 'rgba(0,0,0,0.25)', 9, 1);
};

const flower = (petal: string): Painter => (ctx, w, h) => {
  px(ctx, 0, 0, 'rgba(0,0,0,0)', w, h);
  for (const [x, y] of [
    [4, 6],
    [10, 10],
    [6, 12],
  ] as const) {
    px(ctx, x, y + 1, '#3f7a33');
    px(ctx, x - 1, y, petal);
    px(ctx, x + 1, y, petal);
    px(ctx, x, y - 1, petal);
    px(ctx, x, y, '#f7e26b');
  }
};

/** 16×24 villager. Frames 0–3 alternate the legs; frame 0 doubles as idle. */
const player = (facing: 'down' | 'up' | 'left' | 'right', frame: number): Painter => (ctx) => {
  const step = frame % 2 === 1 ? (frame === 1 ? 1 : -1) : 0;
  px(ctx, 4, 22, 'rgba(0,0,0,0.3)', 8, 2); // shadow
  // legs
  px(ctx, 5, 18, '#3b3355', 2, 4 + Math.max(0, -step));
  px(ctx, 9, 18, '#3b3355', 2, 4 + Math.max(0, step));
  // body
  px(ctx, 4, 11, '#b5523b', 8, 8);
  px(ctx, 4, 11, '#c96a4f', 8, 2);
  // arms
  px(ctx, 3, 12 + (step > 0 ? 1 : 0), '#e8b48a', 1, 5);
  px(ctx, 12, 12 + (step < 0 ? 1 : 0), '#e8b48a', 1, 5);
  // head + hair
  px(ctx, 5, 4, '#e8b48a', 6, 7);
  px(ctx, 4, 3, '#5a3a22', 8, 3);
  if (facing === 'up') px(ctx, 5, 4, '#5a3a22', 6, 6);
  if (facing === 'down') {
    px(ctx, 6, 7, '#1d1d1d');
    px(ctx, 9, 7, '#1d1d1d');
  }
  if (facing === 'left') {
    px(ctx, 5, 7, '#1d1d1d');
    px(ctx, 9, 4, '#5a3a22', 2, 4);
  }
  if (facing === 'right') {
    px(ctx, 10, 7, '#1d1d1d');
    px(ctx, 5, 4, '#5a3a22', 2, 4);
  }
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
  ['terrain/water-1', TILE, TILE, water('#3f86c6', '#7fb6e3', 1)],
  ['terrain/water-2', TILE, TILE, water('#3f86c6', '#7fb6e3', 2)],
  ['boundary/sea-1', TILE, TILE, water('#22629a', '#4f8fc4', 3)],
  ['boundary/sea-2', TILE, TILE, water('#22629a', '#4f8fc4', 4)],
  ['boundary/tree-1', TILE, TILE * 2, tree(1)],
  ['boundary/tree-2', TILE, TILE * 2, tree(2)],
  ['deco/rock-1', TILE, TILE, rock],
  ['deco/bush-1', TILE, TILE, bush],
  ['deco/flower-1', TILE, TILE, flower('#f07ab0')],
  ['deco/flower-2', TILE, TILE, flower('#f5f5f5')],
  ...(['down', 'up', 'left', 'right'] as const).flatMap((facing) =>
    [0, 1, 2, 3].map(
      (frame): [string, number, number, Painter] => [`player/walk-${facing}-${frame}`, TILE, 24, player(facing, frame)],
    ),
  ),
];

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
  const width = 256;
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

/** Extra art pixels a plot sprite reaches above its footprint (posts, roofs, lectern). */
export const PLOT_OVERHANG: Partial<Record<PlotKind, number>> = { orchard: 6, well: 8, lectern: 10, graveyard: 6 };

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
  const painter = PLOT_PAINTERS[`${kind}/${stage}`] ?? ((c: Ctx) => missing(c, w, h));
  painter(ctx, w, h, biome, over);
  return canvas;
}

type PlotPainter = (ctx: Ctx, w: number, h: number, biome: Biome, over: number) => void;

function fencePosts(ctx: Ctx, w: number, h: number, colour: string, rail: string, postH: number): void {
  for (let x = 1; x < w; x += 7) {
    px(ctx, x, -postH + 2, colour, 2, postH);
    px(ctx, x, h - postH, colour, 2, postH);
  }
  for (let y = 4; y < h - 4; y += 7) {
    px(ctx, 0, y, colour, 2, postH);
    px(ctx, w - 2, y, colour, 2, postH);
  }
  px(ctx, 0, -postH + 4, rail, w, 1);
  px(ctx, 0, h - postH + 2, rail, w, 1);
}

const PLOT_PAINTERS: Record<string, PlotPainter> = {
  'field/empty': (ctx, w, h) => {
    speckle(ctx, w, h, '#6e4a2c', [['#5c3d24', 0.1], ['#7d5534', 0.08]], 21);
    for (let y = 3; y < h - 1; y += 4) px(ctx, 2, y, '#4f3420', w - 4, 1);
    px(ctx, 0, 0, '#5a3b23', w, 1);
    px(ctx, 0, h - 1, '#5a3b23', w, 1);
  },
  'orchard/empty': (ctx, w, h) => {
    speckle(ctx, w, h, '#6f9a45', [['#7f5a36', 0.25], ['#5f8a3c', 0.1]], 22);
    fencePosts(ctx, w, h, '#8a6038', '#a7774a', 6);
    px(ctx, w / 2 - 1, h / 2 - 3, '#8a6038', 2, 6); // a stake where a tree could go
  },
  'reservoir/cracked': (ctx, w, h) => {
    px(ctx, 0, 0, '#7b7d80', w, h);
    px(ctx, 2, 2, '#8a6a48', w - 4, h - 4);
    px(ctx, 0, 0, '#9a9ca0', w, 2);
    for (let i = 0; i < 6; i++) {
      let x = 4 + Math.floor(noise(i, 1, 31) * (w - 8));
      let y = 4 + Math.floor(noise(i, 2, 31) * (h - 8));
      for (let s = 0; s < 6; s++) {
        px(ctx, x, y, '#5e4630');
        x += noise(i, s, 33) < 0.5 ? 1 : -1;
        y += 1;
      }
    }
    px(ctx, w / 2 - 3, h - 8, '#4d7fa8', 6, 2); // a last puddle
    px(ctx, w - 6, 2, '#5e6063', 2, h - 4); // crack in the wall
  },
  'well/none': (ctx, w, h) => {
    speckle(ctx, w, h, '#93673f', [['#7d5534', 0.15]], 23);
    for (const [x, y] of [
      [1, 1],
      [w - 3, 1],
      [1, h - 3],
      [w - 3, h - 3],
    ] as const) {
      px(ctx, x, y - 8, '#8a6038', 2, 10);
    }
    px(ctx, 2, -6, '#d9c9a0', w - 4, 1);
    px(ctx, 2, h - 9, '#d9c9a0', w - 4, 1);
  },
  'wild/many': (ctx, w, h, biome) => {
    if (biome === 'island') {
      px(ctx, 0, 0, '#3f86c6', w, h);
      for (let y = 1; y < h; y += 4) px(ctx, 2, y, '#a7774a', w - 4, 3);
      px(ctx, 2, 0, '#7b5530', 2, h);
      px(ctx, w - 4, 0, '#7b5530', 2, h);
      for (const [x, y] of [
        [3, h - 3],
        [w - 7, 2],
      ] as const) {
        px(ctx, x, y, '#cfe8f7', 4, 1);
      }
      return;
    }
    speckle(ctx, w, h, '#4f8a3f', [['#3a6f2f', 0.25], ['#6fb35a', 0.08]], 24);
    for (let x = 1; x < w; x += 3) px(ctx, x, 2 + (x % 5), '#2f5f27', 1, 4);
    // two deer
    for (const [x, y] of [
      [4, h - 9],
      [w - 12, 5],
    ] as const) {
      px(ctx, x, y, '#8b5a2b', 7, 4);
      px(ctx, x + 6, y - 3, '#8b5a2b', 2, 4);
      px(ctx, x, y + 4, '#5a3a1a', 1, 3);
      px(ctx, x + 5, y + 4, '#5a3a1a', 1, 3);
    }
  },
  'lectern/default': (ctx, w, h, _b, over) => {
    px(ctx, 3, h - 2, 'rgba(0,0,0,0.3)', w - 6, 2);
    px(ctx, w / 2 - 1, 2 - over + 6, '#6e4a2b', 3, h + over - 8);
    px(ctx, 2, 2 - over, '#8a6038', w - 4, 5);
    px(ctx, 3, 1 - over, '#f2ead2', w - 6, 4);
    px(ctx, w / 2, 1 - over, '#b8ac8c', 1, 4);
  },
  'graveyard/default': (ctx, w, h) => {
    speckle(ctx, w, h, '#557f45', [['#4a7040', 0.15], ['#6a8f55', 0.05]], 25);
    const stone = '#8d8f93';
    px(ctx, 0, -4, stone, w, 4);
    px(ctx, 0, h - 4, stone, w / 2 - 6, 4);
    px(ctx, w / 2 + 6, h - 4, stone, w / 2 - 6, 4);
    px(ctx, 0, -4, stone, 3, h + 4);
    px(ctx, w - 3, -4, stone, 3, h + 4);
    px(ctx, 0, -4, '#a5a7ab', w, 1);
  },
};
