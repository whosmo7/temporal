/**
 * A tiny RGBA image for composing atlas frames at build time (`09`): crop pack sprites, recolour
 * them, layer them and draw the few pixels the packs don't have. Nothing here runs in the game.
 */
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export const TILE = 16;

export type Rgb = [number, number, number];

export function parseHex(h: string): Rgb {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export class Img {
  readonly data: Buffer;
  /** Where (0, 0) sits in the buffer, so painters can draw past the left and top edges. */
  origin = { x: 0, y: 0 };
  constructor(
    readonly w: number,
    readonly h: number,
    data?: Buffer,
  ) {
    this.data = data ?? Buffer.alloc(w * h * 4);
  }

  /** `alpha` 0–255. Off-canvas pixels are ignored, so callers can draw past the edges. */
  px(x: number, y: number, colour: string, w = 1, h = 1, alpha = 255): this {
    const [r, g, b] = parseHex(colour);
    for (let yy = Math.round(y); yy < Math.round(y) + h; yy++) {
      for (let xx = Math.round(x); xx < Math.round(x) + w; xx++) this.set(xx, yy, r, g, b, alpha);
    }
    return this;
  }

  /** Source-over blend of one pixel. */
  set(x: number, y: number, r: number, g: number, b: number, a: number): void {
    x += this.origin.x;
    y += this.origin.y;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a === 0) return;
    const i = (y * this.w + x) * 4;
    if (a === 255 || this.data[i + 3] === 0) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
      return;
    }
    const sa = a / 255;
    const da = this.data[i + 3]! / 255;
    const oa = sa + da * (1 - sa);
    this.data[i] = Math.round((r * sa + this.data[i]! * da * (1 - sa)) / oa);
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1]! * da * (1 - sa)) / oa);
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2]! * da * (1 - sa)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }

  alphaAt(x: number, y: number): number {
    x += this.origin.x;
    y += this.origin.y;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3]!;
  }

  /** Draws `src` (or a rectangle of it) at dx, dy. */
  draw(src: Img, dx: number, dy: number, sx = 0, sy = 0, sw = src.w, sh = src.h): this {
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = ((sy + y) * src.w + sx + x) * 4;
        this.set(dx + x, dy + y, src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!);
      }
    }
    return this;
  }

  /** Filled rectangle with a 1 px outline (art direction: objects have ink outlines). */
  box(x: number, y: number, w: number, h: number, fill: string, outline = INK): this {
    return this.px(x, y, outline, w, h).px(x + 1, y + 1, fill, w - 2, h - 2);
  }

  disc(cx: number, cy: number, r: number, colour: string): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.px(x, y, colour);
      }
    }
    return this;
  }

  /** A disc with a 1 px ink outline. */
  ball(cx: number, cy: number, r: number, fill: string): this {
    return this.disc(cx, cy, r + 1, INK).disc(cx, cy, r, fill);
  }

  /** Flat down-right shadow (art direction › Light from the top-left). */
  shadow(x: number, y: number, w: number, h = 2): this {
    return this.px(x + 1, y, SHADOW, w, h, 102);
  }

  /** Swaps colours; anything not in the map stays. */
  recolour(map: Record<string, string>): this {
    const lut = new Map(Object.entries(map).map(([from, to]) => [from, parseHex(to)]));
    for (let i = 0; i < this.data.length; i += 4) {
      if (!this.data[i + 3]) continue;
      const to = lut.get(toHex(this.data[i]!, this.data[i + 1]!, this.data[i + 2]!));
      if (to) [this.data[i], this.data[i + 1], this.data[i + 2]] = to;
    }
    return this;
  }

  flipX(): Img {
    const out = new Img(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) this.data.copy(out.data, (y * this.w + this.w - 1 - x) * 4, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
    }
    return out;
  }

  isBlank(): boolean {
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i]) return false;
    return true;
  }
}

export const INK = '#1f2027';
const SHADOW = '#3c5461';

const sheets = new Map<string, PNG>();
function sheet(path: string): PNG {
  let png = sheets.get(path);
  if (!png) {
    let file: Buffer;
    try {
      file = readFileSync(path);
    } catch {
      throw new Error(`Can't read ${path}. Download the packs into art/source/ first (see ASSETS.md).`);
    }
    // Some exported PNGs (the Kyrise icons) carry stray bytes after IEND, which pngjs rejects.
    const end = file.indexOf('IEND');
    png = PNG.sync.read(end > 0 ? file.subarray(0, end + 8) : file);
    sheets.set(path, png);
  }
  return png;
}

/** Crops `w × h` from a sheet. Units are 16 px tiles unless `px` is set. */
export function crop(path: string, x: number, y: number, w = 1, h = 1, px = false): Img {
  const png = sheet(path);
  const unit = px ? 1 : TILE;
  const [sx, sy, sw, sh] = [x * unit, y * unit, w * unit, h * unit];
  if (sx + sw > png.width || sy + sh > png.height) {
    throw new Error(`crop ${sx},${sy} ${sw}×${sh} is outside ${path} (${png.width}×${png.height})`);
  }
  const out = new Img(sw, sh);
  for (let row = 0; row < sh; row++) png.data.copy(out.data, row * sw * 4, ((sy + row) * png.width + sx) * 4, ((sy + row) * png.width + sx + sw) * 4);
  return out;
}

/** A whole image file. */
export function load(path: string): Img {
  const png = sheet(path);
  return new Img(png.width, png.height, Buffer.from(png.data));
}

/** Deterministic per-pixel hash in [0, 1), so composed art is the same every build. */
export function noise(x: number, y: number, salt: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
