/**
 * Hand-built drawing for the landing island and its sky: the irregular island outline, the faceted
 * rock underside, the old tree, worn paths, contact shadows, distant islands and the late-afternoon
 * grade that puts every sprite under the same light. Art px throughout; callers scale by integers.
 *
 * Light comes from the upper left, so lit faces lean left and shadows fall down and to the right.
 * Everything is seeded by position (no randomness), so the island looks the same on every visit.
 */

export type Ctx = CanvasRenderingContext2D;

export function hash(x: number, y: number, s = 0) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Shared ramps, darkest first. Each material steps through related hues, not just lighter and darker. */
export const RAMP = {
  leaf: ['#1f3a3c', '#2b5246', '#3f7250', '#699d55', '#a3c766'],
  bark: ['#2a2130', '#47333a', '#6b4b47', '#8f6a55'],
  stone: ['#2a2236', '#45364b', '#654b55', '#8a6862', '#ad8873', '#cba68a'],
  earth: ['#36262e', '#573c3a', '#795443', '#9b7152'],
  grassLip: '#c4e58c',
  grassEdge: '#4e8b63',
  path: '#e3cf9a',
  pathShade: '#c7ab82',
  worn: '#b99a72',
  shadow: '#3a2b4c',
  moss: '#6f9a4e',
  mossLight: '#9cbf5f',
  outline: '#26202e',
} as const;

function rect(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/* Outline ---------------------------------------------------------------------------------------- */

/** The top surface, per column: first and last grass row (surface coords), or null outside it. */
export type Outline = ({ top: number; bot: number } | null)[];

/**
 * A rounded blob with ledges and recesses: short runs step in or out by a pixel or two, and longer
 * runs by a few more, so the rim never reads as a tile staircase.
 */
export function islandOutline(w: number, h: number): Outline {
  const out: Outline = [];
  for (let x = 0; x < w; x++) {
    const t = (x + 0.5 - w / 2) / (w / 2);
    const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 1 / 2.6);
    if (e < 0.22) {
      out.push(null);
      continue;
    }
    const half = (h / 2) * e;
    const fine = (hash(Math.floor(x / 5), 1) % 4) - 1.5;
    const coarse = (hash(Math.floor((x + 9) / 21), 2) % 7) - 3;
    const fineB = (hash(Math.floor((x + 2) / 6), 3) % 4) - 1.5;
    const coarseB = (hash(Math.floor((x + 4) / 17), 4) % 5) - 2;
    const top = Math.round(h / 2 - half * 0.94 + fine + coarse * 0.8);
    const bot = Math.round(h / 2 + half + fineB + coarseB);
    out.push(bot - top > 6 ? { top, bot } : null);
  }
  return out;
}

export function inside(outline: Outline, x: number, y: number) {
  const c = outline[x];
  return !!c && y >= c.top && y <= c.bot;
}

/* Underside -------------------------------------------------------------------------------------- */

/**
 * The rock under the island, drawn per pixel: a grass lip, a band of soil, then slanted rock facets
 * that converge on a tip left of centre. Facets facing the light are lighter, those turned away are
 * cooler and darker, and everything darkens towards the bottom.
 */
export function drawUnderside(ctx: Ctx, outline: Outline, oy: number, maxDepth: number) {
  const cols = outline.map((c, x) => (c ? x : -1)).filter((x) => x >= 0);
  const x0 = cols[0];
  const x1 = cols[cols.length - 1];
  const tip = Math.round(x0 + (x1 - x0) * 0.46);
  const span = (x1 - x0) / 2;

  // Facet boundaries across the face, at uneven widths.
  const bounds: number[] = [];
  for (let b = x0 - 40, i = 0; b < x1 + 40; i++) {
    bounds.push(b);
    b += 20 + (hash(i, 5) % 22);
  }
  const facetOf = (xf: number) => {
    let i = 0;
    while (i < bounds.length - 1 && bounds[i + 1] <= xf) i++;
    return i;
  };

  // Hanging masses: the main taper plus two smaller drips.
  const drips = [
    { at: x0 + (x1 - x0) * 0.22, w: 26, d: 0.42 },
    { at: x0 + (x1 - x0) * 0.71, w: 22, d: 0.52 },
  ];
  const depthAt = (x: number) => {
    const u = (x - tip) / (span * (x < tip ? 0.95 : 1.1));
    let d = maxDepth * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 1.25)), 1.1);
    for (const dp of drips) {
      const k = 1 - Math.abs(x - dp.at) / dp.w;
      if (k > 0) d = Math.max(d, maxDepth * dp.d * Math.pow(k, 0.8));
    }
    d += (hash(Math.floor(x / 3), 6) % 3) - 1 + ((hash(Math.floor(x / 9), 7) % 5) - 2);
    return Math.max(7, Math.round(d));
  };

  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const put = (x: number, y: number, hex: string) => {
    if (y < 0 || y >= img.height) return;
    const i = (y * img.width + x) * 4;
    img.data[i] = parseInt(hex.slice(1, 3), 16);
    img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };

  const depths: number[] = [];
  for (let x = x0; x <= x1; x++) {
    const c = outline[x];
    if (!c) continue;
    const top = oy + c.bot + 1;
    const depth = depthAt(x);
    depths[x] = depth;
    const soil = 4 + (hash(Math.floor(x / 4), 8) % 3);
    for (let d = 0; d <= depth; d++) {
      const y = top + d;
      if (d === depth) {
        put(x, y, RAMP.outline);
        continue;
      }
      if (d < 2) {
        put(x, y, d === 0 ? RAMP.grassEdge : RAMP.earth[3]);
        continue;
      }
      if (d < soil) {
        const root = hash(x, y, 9) % 11 === 0;
        put(x, y, root ? RAMP.bark[3] : d === soil - 1 ? RAMP.earth[1] : RAMP.earth[2]);
        continue;
      }
      // Lines slant towards the tip, so the mass reads as tapering.
      const xf = x + ((d * (x - tip)) / span) * 0.55;
      const f = facetOf(xf);
      const centre = (bounds[f] + (bounds[f + 1] ?? bounds[f] + 20)) / 2;
      const side = (centre - tip) / span; // -1 left (lit) .. 1 right (shade)
      let tone = 3 - Math.round(side * 1.4) + ((hash(f, 10) % 3) - 1) * (f % 2 ? 1 : 0);
      const fromEdge = xf - bounds[f];
      // Seams run part of the way down, then break off; the bevel beside them catches the light.
      const seam = hash(f, Math.floor(d / 9), 12) % 3 !== 0;
      if (fromEdge < 1 && seam) tone = 1;
      else if (fromEdge < 3 && seam && side < 0.6) tone += 1;
      const k = d / depth;
      if (k > 0.55) tone -= 1;
      if (k > 0.82) tone -= 1;
      // Strata: short dark dashes, staggered per facet.
      if (hash(Math.floor(xf / 4), Math.floor((d + f * 3) / 6), 11) % 7 === 0 && (d + f) % 6 === 0)
        tone -= 1;
      put(x, y, RAMP.stone[Math.max(1, Math.min(5, tone))]);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Cracks: short random walks down the face.
  for (let i = 0; i < 9; i++) {
    let x = x0 + 12 + (hash(i, 12) % (x1 - x0 - 24));
    const c = outline[x];
    if (!c || !depths[x]) continue;
    let y = oy + c.bot + 7 + (hash(i, 13) % 6);
    const len = 6 + (hash(i, 14) % Math.max(1, Math.floor(depths[x] * 0.5)));
    for (let s = 0; s < len; s++) {
      if (!depths[x] || y >= oy + (outline[x]?.bot ?? 0) + depths[x] - 2) break;
      rect(ctx, RAMP.stone[1], x, y);
      rect(ctx, RAMP.stone[4], x - 1, y);
      y += 1;
      if (hash(i, s, 15) % 3 === 0) x += hash(i, s, 16) % 2 ? 1 : -1;
    }
  }

  // Protruding stones: lit top-left, shaded bottom-right, ink under.
  for (let i = 0; i < 7; i++) {
    const x = x0 + 16 + (hash(i, 17) % (x1 - x0 - 32));
    const c = outline[x];
    if (!c || !depths[x] || depths[x] < 22) continue;
    const y = oy + c.bot + 9 + (hash(i, 18) % Math.floor(depths[x] * 0.5));
    const w = 4 + (hash(i, 19) % 4);
    rect(ctx, RAMP.stone[4], x, y, w, 2);
    rect(ctx, RAMP.stone[5], x, y, 2, 1);
    rect(ctx, RAMP.stone[3], x, y + 2, w, 1);
    rect(ctx, RAMP.stone[1], x + 1, y + 3, w, 1);
  }

  // Roots hanging out of the soil band, longest under the trees at the front.
  for (let i = 0; i < 14; i++) {
    let x = x0 + 6 + (hash(i, 20) % (x1 - x0 - 12));
    const c = outline[x];
    if (!c || !depths[x]) continue;
    let y = oy + c.bot + 3;
    const len = 5 + (hash(i, 21) % 13);
    for (let s = 0; s < len && y < oy + c.bot + depths[x] - 1; s++) {
      rect(ctx, s < 2 ? RAMP.bark[2] : RAMP.bark[1], x, y);
      y += 1;
      if (hash(i, s, 22) % 4 === 0) x += hash(i, s, 23) % 2 ? 1 : -1;
    }
  }

  // Grass hanging over the lip, in tufts.
  for (let x = x0; x <= x1; x++) {
    const c = outline[x];
    if (!c || hash(Math.floor(x / 3), 24) % 3) continue;
    const len = 1 + (hash(x, 25) % 3);
    rect(ctx, RAMP.grassEdge, x, oy + c.bot + 1, 1, len);
  }

  // A few chunks that broke away and float below.
  const chunks: [number, number, number][] = [
    [tip - 46, 14, 7],
    [tip + 38, 22, 5],
    [tip - 8, 30, 4],
  ];
  for (const [cx, below, r] of chunks) {
    const base = oy + (outline[Math.round(tip)]?.bot ?? 0) + maxDepth * 0.55 + below;
    rock(ctx, cx, base, r);
  }
  return { tip, x0, x1 };
}

/** A small floating rock, faceted like the underside. */
function rock(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let dy = 0; dy <= r * 1.6; dy++) {
    const k = dy / (r * 1.6);
    const half = Math.round(r * (dy < 2 ? 0.8 + dy * 0.1 : 1 - k * 0.85));
    for (let dx = -half; dx <= half; dx++) {
      const tone = dy === 0 ? 2 : dx < -half / 3 ? 4 : dx < half / 3 ? 3 : 2;
      rect(ctx, RAMP.stone[k > 0.6 ? tone - 1 : tone], cx + dx, cy + dy);
    }
  }
  rect(ctx, RAMP.grassEdge, cx - Math.round(r * 0.8), cy - 1, Math.round(r * 1.6), 1);
  rect(ctx, RAMP.outline, cx - 1, cy + Math.round(r * 1.6) + 1, 2, 1);
}

/* Foliage ---------------------------------------------------------------------------------------- */

/**
 * One leaf mass: per pixel, the angle to the light picks the step on the ramp, with a 2 px dither
 * so the steps break up into leaf clumps instead of smooth bands. The rim is ragged.
 */
export function leafMass(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  ramp: readonly string[],
  shift = 0,
  seed = 0,
) {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const dist = Math.hypot(dx, dy * 1.1);
      if (dist > r + 0.5) continue;
      const rim = r - dist;
      if (rim < 1.2 && hash(cx + dx, cy + dy, seed) % 3 === 0) continue;
      const lit = (-dx * 0.62 - dy * 0.78) / r; // -1 .. 1
      const n =
        ((hash(Math.floor((cx + dx) / 2), Math.floor((cy + dy) / 2), seed + 1) % 100) / 100 - 0.5) *
        0.5;
      const v = lit + n;
      let tone = v > 0.55 ? 4 : v > 0.1 ? 3 : v > -0.35 ? 2 : 1;
      if (rim < 1.2) tone = Math.min(tone, 1);
      tone = Math.max(0, Math.min(ramp.length - 1, tone + shift));
      rect(ctx, ramp[tone], cx + dx, cy + dy);
    }
  }
}

/**
 * The island's oldest tree, on the graveyard terrace: a broad trunk with roots gripping the ground,
 * and a canopy built from overlapping leaf masses, darker at the back.
 */
export function oldTree(ctx: Ctx, bx: number, by: number) {
  // Roots spreading over the ground.
  const roots: [number, number][] = [
    [-9, 2],
    [-6, 3],
    [7, 2],
    [10, 1],
  ];
  for (const [dx, len] of roots) {
    for (let s = 0; s <= Math.abs(dx); s++) {
      const x = bx + Math.sign(dx) * s;
      rect(
        ctx,
        s > Math.abs(dx) - 2 ? RAMP.bark[1] : RAMP.bark[2],
        x,
        by - 1 + Math.floor((s * len) / Math.abs(dx)),
        1,
        2,
      );
    }
  }
  // Trunk: tapers upwards, lit on the left.
  const height = 34;
  for (let y = 0; y < height; y++) {
    const half = Math.round(7 - (y / height) * 3);
    for (let dx = -half; dx <= half; dx++) {
      const tone = dx === -half ? 1 : dx < -half + 3 ? 3 : dx > half - 2 ? 1 : 2;
      const knot = hash(bx + dx, by - y, 30) % 13 === 0 ? -1 : 0;
      rect(ctx, RAMP.bark[Math.max(0, tone + knot)], bx + dx, by - 1 - y);
    }
  }
  // Two limbs reaching into the canopy.
  for (let s = 0; s < 16; s++) {
    rect(ctx, RAMP.bark[2], bx - 3 - s, by - 30 - Math.floor(s * 0.7), 2, 2);
    rect(ctx, RAMP.bark[1], bx + 3 + s, by - 31 - Math.floor(s * 0.6), 2, 2);
  }
  // Canopy, back to front.
  const masses: [dx: number, dy: number, r: number, shift: number][] = [
    [20, -58, 15, -1],
    [-21, -56, 15, -1],
    [0, -76, 16, -1],
    [-31, -40, 12, 0],
    [29, -40, 13, 0],
    [-10, -64, 17, 0],
    [13, -66, 16, 0],
    [-13, -42, 15, 0],
    [12, -45, 15, 0],
    [-1, -54, 13, 1],
  ];
  masses.forEach(([dx, dy, r, shift], i) =>
    leafMass(ctx, bx + dx, by + dy, r, RAMP.leaf, shift, 40 + i),
  );
}

/** A young tree for the orchard's later generations is in the atlas; this is a hand-drawn bush. */
export function bush(ctx: Ctx, cx: number, cy: number, r: number, seed: number) {
  leafMass(ctx, cx - Math.round(r * 0.5), cy, Math.round(r * 0.8), RAMP.leaf, 0, seed);
  leafMass(ctx, cx + Math.round(r * 0.4), cy + 1, Math.round(r * 0.75), RAMP.leaf, 0, seed + 1);
  leafMass(ctx, cx, cy - Math.round(r * 0.4), r, RAMP.leaf, 0, seed + 2);
}

/** Leaves dropped around a tree's base: sparse warm and olive dots. */
export function fallenLeaves(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  keep: (x: number, y: number) => boolean,
) {
  const colors = ['#c99a4a', '#a8823f', '#8aa34e', '#d6b25c'];
  for (let i = 0; i < Math.round(rx * ry * 0.18); i++) {
    const a = (hash(i, seed, 50) % 628) / 100;
    const k = Math.sqrt((hash(i, seed, 51) % 100) / 100);
    const x = Math.round(cx + Math.cos(a) * rx * k);
    const y = Math.round(cy + Math.sin(a) * ry * k);
    if (keep(x, y)) rect(ctx, colors[hash(i, seed, 52) % colors.length], x, y);
  }
}

/* Ground ----------------------------------------------------------------------------------------- */

/**
 * A worn route between points: a variable-width band in `path`, with a darker edge on the shaded
 * side and grass breaking into it, wider where feet gather.
 */
export function wornPath(
  ctx: Ctx,
  pts: [number, number][],
  width: number,
  keep: (x: number, y: number) => boolean,
) {
  const stamp = (x: number, y: number, r: number, color: string) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy * 1.4 > r * r + 0.5) continue;
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (keep(px, py)) rect(ctx, color, px, py);
      }
    }
  };
  const walk = (fn: (x: number, y: number, i: number) => void) => {
    let i = 0;
    for (let p = 0; p < pts.length - 1; p++) {
      const [ax, ay] = pts[p];
      const [bx, by] = pts[p + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let s = 0; s < steps; s++, i++) {
        const k = s / steps;
        const wob = ((hash(Math.floor(i / 5), 60) % 3) - 1) * 0.6;
        fn(ax + (bx - ax) * k + wob, ay + (by - ay) * k + wob * 0.5, i);
      }
    }
  };
  const r = (i: number) => width / 2 + ((hash(Math.floor(i / 7), 61) % 3) - 1) * 0.6;
  walk((x, y, i) => stamp(x + 1, y + 1, r(i), RAMP.pathShade));
  walk((x, y, i) => stamp(x, y, r(i) - 0.6, RAMP.path));
  // Grass tufts creeping in from the edges, and stones in the dirt.
  walk((x, y, i) => {
    if (hash(i, 62) % 9 === 0) {
      const side = hash(i, 63) % 2 ? 1 : -1;
      const px = Math.round(x + side * (r(i) - 1));
      const py = Math.round(y - side * 1);
      if (keep(px, py)) rect(ctx, RAMP.grassEdge, px, py);
    }
    if (hash(i, 64) % 31 === 0 && keep(Math.round(x), Math.round(y)))
      rect(ctx, RAMP.pathShade, x, y, 2, 1);
  });
}

/** Dug soil around a planting bed: a rough border a few px wider than the bed. */
export function tilledBorder(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  for (let py = y - 3; py < y + h + 3; py++) {
    for (let px = x - 3; px < x + w + 3; px++) {
      const edge = Math.min(px - (x - 3), x + w + 2 - px, py - (y - 3), y + h + 2 - py);
      if (edge < 1 && hash(px, py, seed) % 2) continue;
      const tone =
        edge < 2 ? (hash(px, py, seed + 1) % 3 ? RAMP.earth[3] : RAMP.worn) : RAMP.earth[2];
      rect(ctx, tone, px, py);
    }
  }
}

/** The stone outline of a house that stood here before: broken walls, grass through the floor. */
export function oldFoundation(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const stone = (px: number, py: number) => {
    rect(ctx, RAMP.stone[1], px, py + 3, 4, 1);
    rect(ctx, RAMP.stone[3], px, py, 4, 3);
    rect(ctx, RAMP.stone[5], px, py, 3, 1);
    rect(ctx, RAMP.stone[4], px, py + 1, 1, 2);
  };
  // Floor: worn dirt, half reclaimed by grass.
  for (let py = y + 4; py < y + h - 1; py++) {
    for (let px = x + 4; px < x + w - 4; px++) {
      if (hash(Math.floor(px / 2), Math.floor(py / 2), 70) % 3 === 0) rect(ctx, RAMP.worn, px, py);
    }
  }
  for (let px = x; px < x + w; px += 4) {
    if (hash(px, 71) % 6 !== 0) stone(px, y);
    if (hash(px, 72) % 4 !== 0 && (px < x + w * 0.35 || px > x + w * 0.6)) stone(px, y + h - 3);
  }
  for (let py = y + 4; py < y + h - 3; py += 4) {
    stone(x, py);
    if (hash(py, 74) % 3) stone(x + w - 4, py);
  }
  // A taller corner that has not fallen yet.
  rect(ctx, RAMP.stone[3], x, y - 5, 3, 5);
  rect(ctx, RAMP.stone[5], x, y - 5, 1, 4);
  rect(ctx, RAMP.stone[1], x + 3, y - 3, 1, 3);
}

/* Shadows ---------------------------------------------------------------------------------------- */

/**
 * Contact shadows go on their own layer in one solid colour, then onto the scene at one opacity,
 * so where two shadows overlap they don't double up.
 */
export class ShadowLayer {
  readonly ctx: Ctx;
  constructor(w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    this.ctx = c.getContext('2d')!;
    this.ctx.fillStyle = RAMP.shadow;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }
  box(x: number, y: number, w: number, h: number) {
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  apply(target: Ctx, alpha: number, keep: Ctx['canvas']) {
    // Only where there is ground: shadows never spill into the sky.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(keep, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    target.globalAlpha = alpha;
    target.drawImage(this.ctx.canvas, 0, 0);
    target.restore();
  }
}

/* Grade ------------------------------------------------------------------------------------------ */

/**
 * Late-afternoon grade over everything on the island, so the atlas sprites and the hand-drawn parts
 * share one light: highlights warm towards gold, shadows cool towards violet-brown, the left of the
 * island slightly brighter than the right. Salmon roof tones settle into terracotta.
 */
export function grade(ctx: Ctx) {
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    // Salmon / pink (roof) → terracotta.
    if (r > 180 && r - g > 40 && g - b > -10 && r - b > 50 && g > 100) {
      r *= 0.9;
      g *= 0.74;
      b *= 0.66;
    }
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const x = (i / 4) % w;
    const side = 1.04 - (x / w) * 0.08;
    const k = Math.min(1, Math.max(0, (lum - 0.25) / 0.6));
    // shadow tint → highlight tint
    const tr = 0.84 + (1.07 - 0.84) * k;
    const tg = 0.8 + (1.0 - 0.8) * k;
    const tb = 0.98 + (0.82 - 0.98) * k;
    d[i] = Math.min(255, r * tr * side);
    d[i + 1] = Math.min(255, g * tg * side);
    d[i + 2] = Math.min(255, b * tb * side);
  }
  ctx.putImageData(img, 0, 0);
}

/* Distant islands -------------------------------------------------------------------------------- */

/**
 * Pale, low-contrast islands far off, mixed most of the way into the sky haze. Bigger means nearer:
 * nearer ones keep a little more colour.
 */
export function distantIsland(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  near: number,
  seed: number,
  haze: [number, number, number],
) {
  const mix = (hex: string, k: number) => {
    const c = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16));
    return `rgb(${c.map((v, j) => Math.round(v + (haze[j] - v) * k)).join(' ')})`;
  };
  const fade = 0.78 - near * 0.22;
  const top = mix('#6f9a6a', fade);
  const lip = mix('#93b878', fade);
  const lit = mix('#a07e6c', fade);
  const shade = mix('#5c4a5c', fade);
  const half = w / 2;
  for (let x = -half; x <= half; x++) {
    const t = x / half;
    const e = Math.sqrt(Math.max(0, 1 - t * t));
    const th = Math.max(1, Math.round(w * 0.1 * e));
    const depth =
      Math.round(w * 0.42 * Math.pow(Math.max(0, 1 - Math.abs(t + 0.1)), 1.3)) +
      (hash(Math.floor(x / 3), seed) % 2);
    const px = cx + x;
    rect(ctx, lip, px, cy - th);
    rect(ctx, top, px, cy - th + 1, 1, th);
    rect(ctx, t < 0.05 ? lit : shade, px, cy + 1, 1, depth);
  }
  // A few trees on top.
  const trees = 1 + (hash(seed, 80) % 3);
  for (let i = 0; i < trees; i++) {
    const tx = cx + Math.round(((hash(seed, i, 81) % 100) / 100 - 0.5) * w * 0.6);
    const r = Math.max(2, Math.round(w * 0.06));
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(ctx, mix('#4c7a5a', fade), tx - hw, cy - r - Math.round(w * 0.06) + dy, hw * 2 + 1, 1);
    }
  }
}

/* Clouds ----------------------------------------------------------------------------------------- */

/**
 * A long bank of cloud, built from overlapping round puffs: lit tops, a shaded band underneath.
 * Drawn wide and repeated, it drifts in front of the island's underside.
 */
export function cloudBank(
  ctx: Ctx,
  w: number,
  h: number,
  base: number,
  colors: { light: string; mid: string; shade: string },
) {
  const puffs: [number, number, number][] = [];
  for (let x = -10, i = 0; x < w + 10; i++) {
    // Mostly low puffs, with a big one every few to break the line.
    const big = hash(i, 93) % 4 === 0;
    const r = big ? 24 + (hash(i, 90) % 12) : 10 + (hash(i, 90) % 10);
    puffs.push([x, base - r * (big ? 0.7 : 0.4) - (hash(i, 91) % 6), r]);
    x += r * 0.8 + (hash(i, 92) % 8);
  }
  const fill = (color: string, dy: number, grow: number) => {
    ctx.fillStyle = color;
    for (const [cx, cy, r0] of puffs) {
      const r = r0 + grow;
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(r * r - y * y));
        // Wrap around the tile so the repeat is seamless.
        for (const off of [-w, 0, w])
          ctx.fillRect(Math.round(cx - half + off), Math.round(cy + y + dy), half * 2 + 1, 1);
      }
    }
  };
  fill(colors.shade, 3, 0);
  fill(colors.mid, 1, -1);
  fill(colors.light, -1, -3);
  ctx.fillStyle = colors.mid;
  ctx.fillRect(0, base, w, h - base);
}
