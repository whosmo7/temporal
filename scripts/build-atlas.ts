/**
 * Packs the world atlas from the asset packs in art/source/ (`09`):
 *   npm run atlas
 * Writes public/assets/atlas/world.png + world.json (Pixi spritesheet format). The raw packs are
 * git-ignored, so only whoever has them downloaded needs to run this; the output is committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import { FRAMES, RECOLOUR, type FrameSpec } from './atlas-manifest.ts';

const OUT_PNG = 'public/assets/atlas/world.png';
const OUT_JSON = 'public/assets/atlas/world.json';
const TILE = 16;
const PAD = 2;
const MAX = 2048;

const sources = new Map<string, PNG>();
function source(path: string): PNG {
  let png = sources.get(path);
  if (!png) {
    try {
      png = PNG.sync.read(readFileSync(path));
    } catch {
      throw new Error(`Can't read ${path}. Download the packs into art/source/ first (see ASSETS.md).`);
    }
    sources.set(path, png);
  }
  return png;
}

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

interface Cropped {
  spec: FrameSpec;
  w: number;
  h: number;
  data: Buffer;
}

function crop(spec: FrameSpec): Cropped {
  const png = source(spec.src);
  const unit = spec.px ? 1 : TILE;
  const sx = spec.x * unit;
  const sy = spec.y * unit;
  const w = (spec.w ?? 1) * unit;
  const h = (spec.h ?? 1) * unit;
  if (sx + w > png.width || sy + h > png.height) {
    throw new Error(`${spec.name}: crop ${sx},${sy} ${w}×${h} is outside ${spec.src} (${png.width}×${png.height})`);
  }
  const map = spec.recolour ? RECOLOUR[spec.recolour] : undefined;
  const lut = map && new Map(Object.entries(map).map(([from, to]) => [from, parseHex(to)]));
  const data = Buffer.alloc(w * h * 4);
  let blank = true;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = spec.flipX ? w - 1 - x : x;
      const si = ((sy + y) * png.width + (sx + fx)) * 4;
      const di = (y * w + x) * 4;
      let r = png.data[si];
      let g = png.data[si + 1];
      let b = png.data[si + 2];
      const a = png.data[si + 3];
      if (a) blank = false;
      const to = lut?.get(hex(r, g, b));
      if (to) [r, g, b] = to;
      data[di] = r;
      data[di + 1] = g;
      data[di + 2] = b;
      data[di + 3] = a;
    }
  }
  if (blank) throw new Error(`${spec.name}: crop is fully transparent; check its coordinates`);
  return { spec, w, h, data };
}

// Shelf packing, tallest first, into a power-of-two square that grows until everything fits.
function pack(items: Cropped[]) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  for (let size = 64; size <= MAX; size *= 2) {
    const placed = new Map<string, { x: number; y: number }>();
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    let fits = true;
    for (const it of sorted) {
      if (x + it.w + PAD > size) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      if (y + it.h + PAD > size) {
        fits = false;
        break;
      }
      placed.set(it.spec.name, { x, y });
      x += it.w + PAD;
      rowH = Math.max(rowH, it.h);
    }
    if (fits) return { size, placed };
  }
  throw new Error(`Frames don't fit in ${MAX}×${MAX}`);
}

const names = new Set<string>();
for (const f of FRAMES) {
  if (names.has(f.name)) throw new Error(`Duplicate frame name ${f.name}`);
  names.add(f.name);
}

const items = FRAMES.map(crop);
const { size, placed } = pack(items);
const out = new PNG({ width: size, height: size });
const frames: Record<string, unknown> = {};
for (const it of items) {
  const { x, y } = placed.get(it.spec.name)!;
  for (let row = 0; row < it.h; row++) {
    it.data.copy(out.data, ((y + row) * size + x) * 4, row * it.w * 4, (row + 1) * it.w * 4);
  }
  frames[it.spec.name] = {
    frame: { x, y, w: it.w, h: it.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h },
    sourceSize: { w: it.w, h: it.h },
  };
}

mkdirSync(dirname(OUT_PNG), { recursive: true });
writeFileSync(OUT_PNG, PNG.sync.write(out));
writeFileSync(
  OUT_JSON,
  `${JSON.stringify({ frames, meta: { image: 'world.png', format: 'RGBA8888', size: { w: size, h: size }, scale: 1 } }, null, 1)}\n`,
);
console.log(`Packed ${items.length} frames into ${OUT_PNG} (${size}×${size})`);
