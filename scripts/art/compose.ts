/**
 * Frames built from several pack sprites plus a few drawn pixels (`09` › Map 04 visual states):
 * plot stages, the house, its furniture and food store, the lectern, the graveyard fence and the
 * drought cracks. The packs have none of these as single sprites, so each one is layered here in
 * the art-direction palette. Plot frames are drawn for the default plot sizes (worldgen
 * BASE_OPTIONS); the renderer uses them only for plots of that size and paints the rest.
 *
 * Wild spots differ by biome, so their frames carry it: `wild/<stage>-forest`, `wild/<stage>-island`.
 */
import { SAPLING, SAPLING_INKS } from '../../src/ui/shell/sapling.ts';
import { palette } from '../../src/ui/theme/palette.ts';
import { BASE_OPTIONS } from '../../src/worldgen/options.ts';
import type { PlotKind } from '../../src/worldgen/types.ts';
import { PACK, RECOLOUR } from '../atlas-manifest.ts';
import { crop, Img, INK, noise, TILE } from './image.ts';

/** The palette plus the in-between shades the renderer's placeholders also use. */
const P = { ...palette, stone: '#8d8b96', stoneLight: '#b3b1bb', sand: '#f0dfa8', sandShade: '#dcc68a', wornLeaf: '#c9c06a' };
/** How far the roof reaches above the house footprint; must match ROOF_OVERHANG in src/render. */
const ROOF_OVERHANG = 12;

const TILESETS = `${PACK}/Backgrounds/Tilesets`;
const FIELD = `${TILESETS}/TilesetField.png`;
const DETAIL = `${TILESETS}/TilesetFloorDetail.png`;
const ELEMENT = `${TILESETS}/TilesetElement.png`;
const NATURE = `${TILESETS}/TilesetNature.png`;
const HOUSE = `${TILESETS}/TilesetHouse.png`;
const WATER = `${TILESETS}/TilesetWater.png`;
const BEDS = `${TILESETS}/tileset_bed.png`;
const FLOOR = `${TILESETS}/Interior/TilesetInteriorFloor.png`;
const WALLS = `${TILESETS}/Interior/TilesetWallSimple.png`;
const BOAR = `${PACK}/Actor/Animal/WildBoar/SpriteSheet.png`;

const WATER_LIGHT = '#a8e6f0';
const PACK_INK = { '#141b1b': INK };

// Pack colour → palette, per material.
const SOIL = { ...PACK_INK, '#ffad5d': P.dirt, '#e67c44': P.ledge, '#a16240': P.bark };
const SPROUT = { ...PACK_INK, '#adbc3a': P.grass, '#74a334': P.grassShade, '#4a7f4b': P.tree, '#945d44': P.bark };
const WHEAT = { '#f1c471': P.stamina, '#fce2ca': '#fbe3a2' };
const ROTTEN_WHEAT = { '#f1c471': '#6f5f50', '#fce2ca': P.muted };
const TRUNK = { '#e46d3a': P.ledge, '#e66a3a': P.ledge, '#965746': P.bark, '#965340': P.bark, '#7a7a3e': P.bark, '#4e484a': '#3c5461' };
const ORCHARD_LEAF = { ...PACK_INK, ...TRUNK, '#adbc3a': P.grass, '#74a334': P.grassShade, '#4a7f4b': P.tree };
const WORN_LEAF = { ...PACK_INK, ...TRUNK, '#adbc3a': P.wornLeaf, '#74a334': '#a99a52', '#4a7f4b': '#7d6f45' };
const DEAD_WOOD = { ...PACK_INK, '#965746': P.stone, '#7b473c': P.rock, '#4e484a': '#4e4c57', '#b36f3c': P.stoneLight };
const CRACK = { '#141b1b': P.bark, '#e46d3a': '#d9c08f', '#945d44': P.ledge };
const PICKET = { ...PACK_INK, '#e66a3a': P.clay, '#a3754e': P.ledge, '#965340': P.bark };

export interface Composed {
  name: string;
  img: Img;
}

const MARGIN = 16;

/**
 * A plot frame. `paint` draws in footprint coordinates with the footprint's top at y = 64, so
 * trees and posts can rise above it and canopies can spill 16 px past its sides. The result is
 * trimmed to what was drawn, keeping it centred on the footprint and its bottom on the
 * footprint's bottom edge: the renderer anchors plot art bottom-centre.
 */
function plot(kind: PlotKind, paint: (img: Img, w: number, h: number) => void): Img {
  const s = BASE_OPTIONS.plotSizes[kind];
  const [w, h] = [s.w * TILE, s.h * TILE];
  const canvas = new Img(w + 2 * MARGIN, h + 64);
  canvas.origin = { x: MARGIN, y: 0 };
  paint(canvas, w, h);
  canvas.origin = { x: 0, y: 0 };
  let side = 0;
  let top = 64;
  for (let y = 0; y < canvas.h; y++) {
    for (let x = 0; x < canvas.w; x++) {
      if (!canvas.alphaAt(x, y)) continue;
      side = Math.max(side, MARGIN - x, x - (MARGIN + w - 1));
      top = Math.min(top, y);
    }
  }
  const out = new Img(w + 2 * side, canvas.h - top);
  return out.draw(canvas, 0, 0, MARGIN - side, top, out.w, out.h);
}

/** Draws a 3×3-tile source as a nine-slice across `w × h` px (multiples of 16). */
function nine(img: Img, src: Img, x0: number, y0: number, w: number, h: number): void {
  const cols = w / TILE;
  const rows = h / TILE;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sc = c === 0 ? 0 : c === cols - 1 ? 2 : 1;
      const sr = r === 0 ? 0 : r === rows - 1 ? 2 : 1;
      img.draw(src, x0 + c * TILE, y0 + r * TILE, sc * TILE, sr * TILE, TILE, TILE);
    }
  }
}

// --- Field: a raised bed with one plant per tile ---------------------------------------------

const bed = () => crop(FIELD, 0, 0, 3, 3).recolour(SOIL);

function field(stage: string): Img {
  return plot('field', (img, w, h) => {
    const top = 64;
    nine(img, bed(), 0, top, w, h);
    // Furrows: a darker line along each row of tiles.
    for (let y = top + 9; y < top + h - 4; y += TILE) img.px(4, y, P.ledge, w - 8, 1).px(4, y + 1, '#a98a5e', w - 8, 1);
    const plant: Img | null =
      stage === 'sown'
        ? null
        : stage === 'growing'
          ? crop(DETAIL, 6, 2).recolour(SPROUT)
          : stage === 'ripe'
            ? crop(ELEMENT, 12, 4).recolour(WHEAT)
            : stage === 'rotten'
              ? crop(ELEMENT, 12, 4).recolour(ROTTEN_WHEAT)
              : null;
    for (let ty = 0; ty < h / TILE; ty++) {
      for (let tx = 0; tx < w / TILE; tx++) {
        const x = tx * TILE;
        const y = top + ty * TILE;
        if (stage === 'sown') {
          // Little mounds of turned soil, one per seed.
          for (const [dx, dy] of [
            [3, 6],
            [9, 6],
            [5, 12],
            [11, 12],
          ] as const) img.px(x + dx, y + dy, P.bark, 3, 1).px(x + dx, y + dy - 1, '#d9c08f', 2, 1);
        }
        if (plant) {
          if (stage === 'ripe' || stage === 'rotten') img.shadow(x + 4, y + 13, 9, 1);
          // Rotten stalks slump: drawn 2 px lower and with a gap at the top.
          img.draw(plant, x, y - (stage === 'ripe' ? 3 : stage === 'rotten' ? -1 : 1));
        }
      }
    }
    if (stage === 'rotten') {
      for (let i = 0; i < 7; i++) {
        const fx = 3 + Math.floor(noise(i, 1, 61) * (w - 6));
        const fy = top + 2 + Math.floor(noise(i, 2, 61) * (h - 8));
        img.px(fx, fy, INK).px(fx - 1, fy - 1, P.stoneLight, 1, 1, 160).px(fx + 1, fy - 1, P.stoneLight, 1, 1, 160);
      }
      for (let i = 0; i < 6; i++) img.px(4 + noise(i, 5, 62) * (w - 8), top + 4 + noise(i, 6, 62) * (h - 8), '#5b4a3c', 2, 1);
    }
  });
}

// --- Orchard ------------------------------------------------------------------------------

function patch(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = -ry - 1; y <= ry + 1; y++) {
    for (let x = -rx - 1; x <= rx + 1; x++) {
      const d = (x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2;
      if (d > 1) continue;
      const edge = d > 0.7;
      const n = noise(x + 40, y + 40, 22);
      img.px(cx + x, cy + y, edge ? (n < 0.5 ? P.ledge : '#a98a5e') : n < 0.08 ? P.ledge : n < 0.14 ? '#d9c08f' : P.dirt);
    }
  }
}

function stake(img: Img, x: number, yBottom: number, h: number): void {
  img.shadow(x + 1, yBottom - 1, 3, 1);
  img.box(x, yBottom - h, 3, h, P.clay);
  img.px(x + 1, yBottom - h + 1, '#d6a58e', 1, h - 3);
}

/** Paints fruit on leafy pixels of a canopy: food-red with a light glint. */
function fruit(img: Img, tree: Img, ox: number, oy: number, count: number, salt: number): void {
  const leaf = new Set([P.grass, P.grassShade, P.wornLeaf, '#a99a52'].map((h) => h.toLowerCase()));
  const spots: [number, number][] = [];
  for (let y = 3; y < tree.h - 18; y++) {
    for (let x = 3; x < tree.w - 3; x++) {
      const i = (y * tree.w + x) * 4;
      const hex = `#${[0, 1, 2].map((k) => tree.data[i + k]!.toString(16).padStart(2, '0')).join('')}`;
      // Fruit sits well inside the canopy: every pixel of its outline must be leaf too.
      let ok = leaf.has(hex);
      for (const [dx, dy] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ] as const)
        ok &&= tree.alphaAt(x + dx, y + dy) === 255;
      if (ok) spots.push([x, y]);
    }
  }
  const placed: [number, number][] = [];
  for (let k = 0; placed.length < count && k < 400; k++) {
    const [x, y] = spots[Math.floor(noise(k, salt, 52) * spots.length)]!;
    if (placed.some(([px, py]) => Math.abs(px - x) < 6 && Math.abs(py - y) < 5)) continue;
    placed.push([x, y]);
    img.ball(ox + x, oy + y, 1.2, P.food).px(ox + x - 1, oy + y - 1, '#f4a0a8');
  }
}

function orchard(stage: string): Img {
  return plot('orchard', (img, w, h) => {
    const top = 64;
    const cx = w / 2;
    const base = top + h - 7; // where a trunk meets the ground
    if (stage === 'empty' || stage === 'sapling' || stage === 'dead') patch(img, cx, base - 2, 11, 6);
    if (stage === 'empty') stake(img, cx - 1, base, 12);
    if (stage === 'sapling') {
      stake(img, cx + 3, base, 14);
      img.px(cx, base - 9, P.bark, 1, 9).px(cx + 1, base - 7, P.bark, 2, 1); // stem, tied to the stake
      const sprout = crop(DETAIL, 6, 2).recolour(SPROUT);
      img.draw(sprout, cx - 8, base - 20);
    }
    if (stage === 'young') {
      const tree = crop(NATURE, 6, 8, 2, 2).recolour(ORCHARD_LEAF);
      img.shadow(cx - 7, base, 14);
      img.draw(tree, cx - tree.w / 2, base + 3 - tree.h);
    }
    if (stage === 'fruiting' || stage === 'worn') {
      const tree = crop(NATURE, 3, 18, 3, 3).recolour(stage === 'worn' ? WORN_LEAF : ORCHARD_LEAF);
      const [ox, oy] = [cx - tree.w / 2, base + 6 - tree.h];
      img.shadow(cx - 10, base, 20);
      img.draw(tree, ox, oy);
      fruit(img, tree, ox, oy, stage === 'fruiting' ? 7 : 2, stage === 'worn' ? 9 : 3);
      if (stage === 'worn') {
        // A few dropped leaves.
        for (let i = 0; i < 5; i++) img.px(3 + noise(i, 1, 81) * (w - 6), base + 1 + noise(i, 2, 81) * 5, P.wornLeaf, 2, 1);
      }
    }
    if (stage === 'dead') {
      img.shadow(cx - 9, base, 18);
      img.draw(crop(NATURE, 0, 8, 2, 2).recolour(DEAD_WOOD), 0, base - 26);
    }
  });
}

// --- Reservoir: a stone basin --------------------------------------------------------------

function basin(stage: string): Img {
  return plot('reservoir', (img, w, h) => {
    const top = 64;
    img.box(0, top, w, h, P.stone);
    // Coping stones: light top, seams every 8 px, staggered per course.
    img.px(1, top + 1, P.stoneLight, w - 2, 2);
    for (let y = top + 1; y < top + h - 1; y += 4) {
      for (let x = (y / 4) % 2 ? 4 : 8; x < w - 1; x += 8) img.px(x, y, P.rock, 1, 3);
      img.px(1, y + 3, P.rock, w - 2, 1);
    }
    img.px(1, top + h - 2, P.rock, w - 2, 1);
    const ix = 4;
    const iy = top + 5;
    const iw = w - 8;
    const ih = h - 9;
    img.px(ix - 1, iy - 1, INK, iw + 2, ih + 2);
    const inner = new Img(iw, ih);
    if (stage === 'full') {
      const water = crop(WATER, 1, 1).recolour(RECOLOUR.water);
      for (let y = 0; y < ih; y += TILE) for (let x = 0; x < iw; x += TILE) inner.draw(water, x, y);
      inner.px(0, 0, P.seaDeep, iw, 1);
      inner.px(3, 3, WATER_LIGHT, 7, 1).px(iw - 12, ih - 4, WATER_LIGHT, 6, 1).px(iw / 2, 6, WATER_LIGHT, 4, 1);
    } else {
      inner.px(0, 0, stage === 'low' ? '#a98a5e' : P.dirt, iw, ih);
      for (let i = 0; i < iw * ih * 0.06; i++) inner.px(noise(i, 1, 91) * iw, noise(i, 2, 91) * ih, P.ledge);
      inner.px(0, 0, P.ledge, iw, 2); // the inner wall's shadow
      if (stage === 'low') {
        inner.px(0, ih - 6, P.ledge, iw, 1); // tide mark
        inner.px(0, ih - 5, P.sea, iw, 5).px(0, ih - 5, P.seaDeep, iw, 1).px(3, ih - 3, WATER_LIGHT, 5, 1);
      } else {
        const cracks = [crop(DETAIL, 5, 0), crop(DETAIL, 7, 0), crop(DETAIL, 6, 0)].map((c) => c.recolour(CRACK));
        for (let x = -2, k = 0; x < iw; x += 13, k++) inner.draw(cracks[k % 3]!, x, k % 2 ? -3 : 1);
      }
    }
    img.draw(inner, ix, iy);
  });
}

// --- Well -----------------------------------------------------------------------------------

function well(stage: string): Img {
  return plot('well', (img, w, h) => {
    const top = 64;
    const cx = w / 2;
    if (stage === 'none') {
      patch(img, cx, top + h / 2, 6, 5);
      for (const [x, y] of [
        [1, top + 3],
        [w - 4, top + 3],
        [1, top + h - 2],
        [w - 4, top + h - 2],
      ] as const)
        stake(img, x, y, 6);
      img.px(3, top - 2, '#e8dcc0', w - 6, 1).px(3, top + h - 7, '#e8dcc0', w - 6, 1); // string between stakes
      return;
    }
    // Stone ring seen from the ¾ view: a wall face below an elliptical rim.
    const rimY = top + 3;
    img.shadow(1, top + h - 2, w - 2);
    img.box(1, rimY + 2, w - 2, h - 5, P.stone);
    for (let y = rimY + 5; y < top + h - 2; y += 3) {
      img.px(2, y, P.rock, w - 4, 1);
      for (let x = (y / 3) % 2 ? 4 : 7; x < w - 2; x += 6) img.px(x, y - 2, P.rock, 1, 2);
    }
    for (let y = -4; y <= 4; y++) {
      for (let x = -8; x <= 8; x++) {
        const d = (x / 7.5) ** 2 + (y / 4.5) ** 2;
        if (d <= 1) img.px(cx + x - 0.5, rimY + y, d > 0.72 ? INK : d > 0.32 ? P.stoneLight : INK);
      }
    }
    const water = stage === 'clear' ? P.sea : P.grassShade;
    for (let y = -1; y <= 1; y++) for (let x = -3; x <= 3; x++) if ((x / 3.5) ** 2 + (y / 1.6) ** 2 <= 1) img.px(cx + x - 0.5, rimY + y + 1, water);
    if (stage === 'clear') img.px(cx - 2, rimY, WATER_LIGHT, 2, 1);
    else {
      img.px(cx, rimY + 1, P.tree, 2, 1).px(cx - 3, rimY + 2, P.tree);
      img.px(cx + 3, rimY - 7, INK).px(cx - 4, rimY - 9, INK); // flies
    }
  });
}

// --- Wild spot: game in tall grass (Forest), fish in a shallow pool (Island) -------------------

function wild(stage: string, biome: 'forest' | 'island'): Img {
  const count = stage === 'many' ? 3 : stage === 'few' ? 1 : 0;
  return plot('wild', (img, w, h) => {
    const top = 64;
    if (biome === 'forest') {
      const tufts = [crop(DETAIL, 0, 2), crop(DETAIL, 1, 2), crop(DETAIL, 2, 2)].map((t) =>
        t.recolour({ ...PACK_INK, '#adbc3a': P.grassShade, '#74a334': P.tree, '#4a7f4b': '#3c5461' }),
      );
      const grass = new Img(w, h);
      for (let y = 0; y < h + 8; y += 8) for (let x = -4; x < w; x += 10) grass.draw(tufts[(((x + y) % 3) + 3) % 3]!, x + ((y / 8) % 2) * 5, y - 8);
      img.draw(grass, 0, top);
      const boar = crop(BOAR, 0, 0, 16, 16, true);
      const spots: [number, number][] = [
        [0, h - 17],
        [w - 16, 1],
        [w - 15, h - 15],
      ];
      for (let i = 0; i < count; i++) {
        const [x, y] = spots[i]!;
        img.shadow(x + 3, top + y + 14, 10, 1);
        img.draw(i === 1 ? boar.flipX() : boar, x, top + y);
      }
      if (count === 0) {
        // Only tracks left: pairs of hoof prints across the grass.
        for (let i = 0; i < 4; i++) img.px(5 + i * 6, top + h - 6 - i * 5, P.bark, 1, 2).px(7 + i * 6, top + h - 6 - i * 5, P.bark, 1, 2);
      }
      return;
    }
    // Island: a rock-edged pool of sea water.
    const water = crop(WATER, 1, 1).recolour(RECOLOUR.sea);
    img.box(0, top, w, h, P.sand, P.sandShade);
    const inner = new Img(w - 6, h - 6);
    for (let y = 0; y < inner.h; y += TILE) for (let x = 0; x < inner.w; x += TILE) inner.draw(water, x, y);
    img.px(2, top + 2, INK, w - 4, h - 4).draw(inner, 3, top + 3);
    img.px(3, top + 3, '#36779b', w - 6, 1);
    for (const [x, y] of [
      [0, 0],
      [w - 5, 1],
      [1, h - 5],
      [w - 6, h - 4],
      [w / 2 - 2, -1],
    ] as const)
      img.box(x, top + y, 5, 4, P.stone).px(x + 1, top + y + 1, P.stoneLight, 3, 1);
    const fishSpots: [number, number][] = [
      [6, 8],
      [w - 15, h - 11],
      [w / 2 - 3, h / 2 + 1],
    ];
    for (let i = 0; i < count; i++) {
      const [x, y] = fishSpots[i]!;
      // A fish just under the surface: dark body, light ripple above it.
      img.px(x, top + y, '#2a5f7f', 6, 2).px(x + 6, top + y - 1, '#2a5f7f', 2, 4);
      img.px(x - 1, top + y - 2, WATER_LIGHT, 4, 1).px(x + 3, top + y + 3, WATER_LIGHT, 3, 1);
    }
    if (count === 0) img.px(w / 2 - 6, top + h / 2, WATER_LIGHT, 3, 1).px(w / 2 + 3, top + h / 2 + 4, WATER_LIGHT, 2, 1);
  });
}

// --- Lectern, graveyard fence ---------------------------------------------------------------

function lectern(): Img {
  return plot('lectern', (img, w, h) => {
    const top = 64;
    const stand = crop(ELEMENT, 6, 3, 1, 2).recolour({ ...PACK_INK, '#d14b34': P.clay, '#965340': P.bark, '#ef914f': '#d6a58e' });
    img.shadow(3, top + h - 2, w - 6);
    img.draw(stand, 0, top + h - stand.h + 1);
  });
}

function graveyard(): Img {
  return plot('graveyard', (img, w, h) => {
    const top = 64;
    const pickets = crop(HOUSE, 11, 5).recolour(PICKET);
    // Back and front rows of pickets; the front has a gap in the middle as a gate.
    for (let x = 0; x < w; x += TILE) {
      img.draw(pickets, x, top - 13);
      const gate = x === Math.floor(w / TILE / 2) * TILE - TILE || x === Math.floor(w / TILE / 2) * TILE;
      if (!gate) img.draw(pickets, x, top + h - 13);
    }
    // Sides: a rail with a post every 10 px, in the pickets' colours.
    for (const x of [1, w - 4]) {
      img.px(x + 1, top - 2, INK, 1, h - 8).px(x, top - 2, P.ledge, 1, h - 8);
      for (let y = top; y < top + h - 12; y += 10) img.box(x - 1, y, 4, 7, P.clay).px(x, y + 1, '#d6a58e', 1, 4);
    }
  });
}

/** The fourth gravestone shape: a low, rounded fieldstone (the pack's rocks are too big). */
function fieldstone(): Img {
  const img = new Img(TILE, TILE);
  img.shadow(3, 14, 11);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      const d = ((x - 5.5) / 6) ** 2 + ((y - 4.5) / 4.5) ** 2;
      if (d <= 1) img.px(2 + x, 7 + y, d > 0.7 ? INK : y < 3 ? P.stoneLight : P.stone);
    }
  }
  img.px(5, 10, P.rock, 4, 1).px(6, 12, P.rock, 3, 1);
  return img;
}

// --- House: exterior, interior, furniture, store --------------------------------------------

const HOUSE_W = 7 * TILE;
const HOUSE_H = 5 * TILE;
const ROOF = { ...PACK_INK, '#e66a3a': P.rose, '#ffad5d': P.peach, '#965340': P.clay, '#bd7959': '#9a6a5c', '#d2b37d': P.path, '#eecf9b': P.cloud, '#f2eaf1': P.cloud };

function houseExterior(): Img {
  const src = crop(HOUSE, 0, 0, 4, 3);
  const roofH = ROOF_OVERHANG + 4 * TILE; // roof covers rows 0–3 plus the overhang
  const img = new Img(HOUSE_W, roofH + TILE);
  // Front wall: left edge, window, plain, door, plain, window, right edge (door on column 3).
  const wallY = roofH;
  const wallCols = [0, 2, -1, 1, -1, 2, 3];
  wallCols.forEach((c, i) => {
    if (c >= 0) img.draw(src, i * TILE, wallY, c * TILE, 2 * TILE, TILE, TILE);
    else {
      // Plain wall: the strip between the two windows of the source, repeated.
      for (let x = 0; x < TILE; x += 4) img.draw(src, i * TILE + x, wallY, 2 * TILE + 12, 2 * TILE, 4, TILE);
    }
  });
  // Roof: the ridge band, the plain body stretched to height, then the eave.
  const bands: [srcY: number, h: number, body: boolean][] = [[0, 14, false]];
  for (let y = 14; y < roofH - 14; y += 8) bands.push([18, Math.min(8, roofH - 14 - y), true]);
  bands.push([18, 14, false]);
  let dy = 0;
  for (const [sy, sh, body] of bands) {
    for (let i = 0; i < 7; i++) {
      const sc = i === 0 ? 0 : i === 6 ? 3 : body || i % 2 ? 1 : 2;
      img.draw(src, i * TILE, dy, sc * TILE, sy, TILE, sh);
    }
    dy += sh;
  }
  // Shingle courses across the body, so the big roof isn't one flat colour.
  for (let y = 20; y < roofH - 14; y += 7) {
    img.px(6, y, '#bd7959', HOUSE_W - 12, 1);
    for (let x = 10 + ((y / 7) % 2) * 6; x < HOUSE_W - 10; x += 12) img.px(x, y - 3, '#bd7959', 1, 3);
  }
  // A few loose shingles, like the source's, scattered rather than in columns.
  const shingle = new Img(8, 3).px(1, 0, '#ffad5d', 6, 1).px(0, 1, '#965340', 8, 1).px(1, 2, '#965340', 6, 1);
  for (let k = 0; k < 9; k++) img.draw(shingle, 20 + Math.floor(noise(k, 1, 41) * (HOUSE_W - 48)), 18 + Math.floor(noise(k, 2, 41) * (roofH - 36)));
  return img.recolour(ROOF);
}

function houseInterior(): Img {
  const img = new Img(HOUSE_W, HOUSE_H);
  const floor = crop(FLOOR, 12, 1).recolour({ '#eecf9b': '#d9b08f', '#d2b37d': P.clay, '#c8966b': '#a0705e' });
  for (let y = TILE; y < HOUSE_H - TILE; y += TILE) for (let x = TILE; x < HOUSE_W - TILE; x += TILE) img.draw(floor, x, y);
  // Walls from above: the pack's peach wall frame as a nine-slice (corners 0/4, edges 1).
  const walls = crop(WALLS, 0, 0, 5, 5);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      if (r > 0 && r < 4 && c > 0 && c < 6) continue;
      const sc = c === 0 ? 0 : c === 6 ? 4 : 1;
      const sr = r === 0 ? 0 : r === 4 ? 4 : 1;
      img.draw(walls, c * TILE, r * TILE, sc * TILE, sr * TILE, TILE, TILE);
    }
  }
  // Door gap with a mat.
  img.px(3 * TILE, HOUSE_H - TILE, '#a0705e', TILE, TILE).draw(floor, 3 * TILE, HOUSE_H - TILE, 0, 0, TILE, TILE);
  img.box(3 * TILE + 2, HOUSE_H - TILE + 4, TILE - 4, TILE - 7, P.food, '#8e3a44');
  // Back-wall window.
  img.box(3 * TILE + 1, 3, 14, 9, '#9fe0ea').px(3 * TILE + 8, 4, INK, 1, 7).px(3 * TILE + 2, 4, '#e6f8fb', 3, 1);
  return img;
}

/** Trims fully transparent rows top and bottom, so furniture stands on its bottom edge. */
function trim(img: Img): Img {
  const empty = (y: number) => [...Array(img.w).keys()].every((x) => img.alphaAt(x, y) === 0);
  let top = 0;
  let bottom = img.h;
  while (top < bottom - 1 && empty(top)) top++;
  while (bottom > top + 1 && empty(bottom - 1)) bottom--;
  return new Img(img.w, bottom - top).draw(img, 0, 0, 0, top, img.w, bottom - top);
}

function furniture(): Composed[] {
  return [
    { name: 'furniture/bed', img: trim(crop(BEDS, 12, 3, 1, 3)) },
    { name: 'furniture/oven', img: trim(crop(ELEMENT, 4, 1)) },
    { name: 'furniture/table', img: trim(crop(ELEMENT, 3, 9)) },
    { name: 'furniture/shelf', img: trim(crop(ELEMENT, 3, 7, 1, 2)) },
    { name: 'furniture/plant', img: trim(crop(ELEMENT, 0, 7, 1, 2)) },
    { name: 'furniture/rug', img: crop(ELEMENT, 6, 10) },
  ];
}

/** The open shelf of the food store, emptied, then stocked per stage. */
function store(stage: string): Img {
  const img = trim(crop(ELEMENT, 4, 7, 1, 2));
  // The shelf's three compartments (rows, after trimming), each 10 px wide from x = 3.
  const bays: [number, number][] = [
    [9, 14],
    [17, 21],
    [23, 26],
  ];
  for (const [y0, y1] of bays) img.px(3, y0, '#2b2326', 10, y1 - y0);
  const items = stage === 'full' ? 3 : stage === 'half' ? 2 : stage === 'rotting' ? 3 : 0;
  bays.forEach(([, y1], b) => {
    const n = stage === 'half' ? (b === bays.length - 1 ? 0 : b === 0 ? 2 : 1) : items;
    for (let k = 0; k < n; k++) {
      const x = 4 + k * 3;
      const rot = stage === 'rotting' && (k + b) % 2 === 0;
      if (b % 2 === 0) img.px(x, y1 - 2, rot ? P.muted : P.food, 2, 2).px(x, y1 - 2, rot ? '#a89a86' : '#f4a0a8');
      else img.px(x, y1 - 3, INK, 3, 3).px(x, y1 - 3, rot ? '#6b6b4a' : P.stamina, 3, 2).px(x, y1 - 3, rot ? '#6b6b4a' : '#fbe3a2', 1, 1);
    }
  });
  if (stage === 'rotting') {
    img.px(2, 1, INK).px(12, 3, INK).px(9, 0, INK);
    img.px(5, bays[0]?.[1] ?? 6, '#5b4a3c', 4, 1);
  }
  if (stage === 'empty') img.px(5, (bays[1]?.[1] ?? 12) - 1, '#5b4a3c', 3, 1); // a few crumbs
  return img;
}

/** The drought overlay for grass and dirt tiles: a few dry cracks, mostly transparent. */
function cracks(): Img {
  return crop(DETAIL, 6, 0).recolour({ '#141b1b': P.bark, '#e46d3a': '#d9c08f', '#945d44': P.ledge });
}

export function composedFrames(): Composed[] {
  const frames: Composed[] = [];
  for (const s of ['empty', 'sown', 'growing', 'ripe', 'rotten']) frames.push({ name: `field/${s}`, img: field(s) });
  for (const s of ['empty', 'sapling', 'young', 'fruiting', 'worn', 'dead']) frames.push({ name: `orchard/${s}`, img: orchard(s) });
  for (const s of ['cracked', 'low', 'full']) frames.push({ name: `reservoir/${s}`, img: basin(s) });
  for (const s of ['none', 'clear', 'stagnant']) frames.push({ name: `well/${s}`, img: well(s) });
  for (const biome of ['forest', 'island'] as const) {
    for (const s of ['many', 'few', 'none']) frames.push({ name: `wild/${s}-${biome}`, img: wild(s, biome) });
  }
  frames.push({ name: 'lectern/default', img: lectern() });
  frames.push({ name: 'graveyard/default', img: graveyard() });
  frames.push({ name: 'grave/4', img: fieldstone() });
  frames.push({ name: 'house/exterior', img: houseExterior() });
  frames.push({ name: 'house/interior', img: houseInterior() });
  frames.push(...furniture());
  for (const s of ['full', 'half', 'empty', 'rotting']) frames.push({ name: `store/${s}`, img: store(s) });
  frames.push({ name: 'terrain/cracks-1', img: cracks() });
  return frames;
}


// --- Journal book: a 9-slice leather cover and a tileable paper grain (DOM images, not atlas) ---

/** 24×24, slice 8: leather with a dark rim, a clay inner line, cream stitching, brass corners. */
function bookCover(): Img {
  const S = 24;
  const img = new Img(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = noise(x, y, 97);
      img.px(x, y, n < 0.12 ? '#5e4140' : n > 0.9 ? '#7d5a57' : P.bark);
    }
  }
  img.px(0, 0, P.panelEdge, S, 1).px(0, S - 1, P.panelEdge, S, 1).px(0, 0, P.panelEdge, 1, S).px(S - 1, 0, P.panelEdge, 1, S);
  img.px(1, 1, P.clay, S - 2, 1).px(1, 1, P.clay, 1, S - 2).px(1, S - 2, '#5e4140', S - 2, 1).px(S - 2, 1, '#5e4140', 1, S - 2);
  // Stitching 4 px in from the edge, dashes of two on the 8 px border.
  for (let i = 4; i < S - 4; i += 3) {
    img.px(i, 4, P.peachLight, 2, 1).px(i, S - 5, P.peachLight, 2, 1);
    img.px(4, i, P.peachLight, 1, 2).px(S - 5, i, P.peachLight, 1, 2);
  }
  // Brass corner caps.
  const cap = (cx: number, cy: number, fx: number, fy: number) => {
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6 - y; x++) {
        const px = cx + fx * x;
        const py = cy + fy * y;
        img.px(px, py, x + y === 5 - 0 || x === 0 || y === 0 ? P.ledge : x + y < 3 ? '#fbe3a2' : P.stamina);
      }
    }
  };
  cap(0, 0, 1, 1);
  cap(S - 1, 0, -1, 1);
  cap(0, S - 1, 1, -1);
  cap(S - 1, S - 1, -1, -1);
  return img;
}

/** 32×32 tile of faint flecks over transparent, laid over the paper colour. */
function paperGrain(): Img {
  const img = new Img(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = noise(x, y, 131);
      if (n < 0.018) img.px(x, y, P.clay, 1, 1, 34);
      else if (n < 0.04) img.px(x, y, P.peachLight, 1, 1, 70);
      else if (n > 0.99) img.px(x, y, '#ffffff', 1, 1, 120);
    }
  }
  return img;
}

/** The favicon: the logo's sapling on a mound of soil, on a notched square of sky. */
function favicon(): Img {
  const img = new Img(16, 16);
  img.px(1, 0, P.sky, 14, 16).px(0, 1, P.sky, 16, 14);
  img.px(1, 1, '#7fd0d6', 14, 1); // a lighter band at the top, like the landing sky
  for (let y = 0; y < 4; y++) img.px(3 - y, 12 + y, P.ledge, 10 + 2 * y, 1).px(4 - y, 12 + y, P.dirt, 8 + 2 * y, 1);
  for (const x of [0, 15]) img.data.fill(0, (15 * 16 + x) * 4, (15 * 16 + x) * 4 + 4); // keep the bottom notches
  SAPLING.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '.') img.px(2 + x, 4 + y, SAPLING_INKS[c]!);
    }),
  );
  return img;
}

function scaled(src: Img, k: number, pad = 0): Img {
  const out = new Img(src.w * k + 2 * pad, src.h * k + 2 * pad);
  out.px(0, 0, P.sky, out.w, out.h);
  for (let y = 0; y < src.h * k; y++) {
    for (let x = 0; x < src.w * k; x++) {
      const i = ((Math.floor(y / k) * src.w + Math.floor(x / k)) * 4) as number;
      out.set(pad + x, pad + y, src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!);
    }
  }
  return out;
}

/** Images the DOM uses directly: path under public/ → image. */
export function domImages(): Record<string, Img> {
  const icon = favicon();
  const twice = new Img(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = ((y >> 1) * 16 + (x >> 1)) * 4;
    twice.set(x, y, icon.data[i]!, icon.data[i + 1]!, icon.data[i + 2]!, icon.data[i + 3]!);
  }
  return {
    'assets/journal/cover.png': bookCover(),
    'assets/journal/paper.png': paperGrain(),
    'favicon-16.png': icon,
    'favicon-32.png': twice,
    // iOS rounds the corners itself and wants no transparency: full sky, 10× with a margin.
    'apple-touch-icon.png': scaled(icon, 10, 10),
  };
}
