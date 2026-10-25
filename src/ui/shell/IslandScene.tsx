import { useEffect, useRef } from 'react';
import {
  RAMP,
  ShadowLayer,
  bush,
  drawUnderside,
  fallenLeaves,
  grade,
  hash,
  inside,
  islandOutline,
  oldFoundation,
  oldTree,
  tilledBorder,
  wornPath,
  type Ctx,
} from './islandArt';

/**
 * The landing's floating island living through a generation (app-shell brief, "One generation a
 * minute"). A composite of the world atlas and hand-drawn terrain on a 2D canvas, standing in until
 * the `04` renderer can draw a read-only sample world. Over a 60 s loop the light goes morning →
 * dusk → night → morning, and at each nightfall one more stone rises in the graveyard and the land
 * moves on a generation: the orchard grows, one field rests while the other is worked again.
 *
 * Layout: the house and its courtyard are the hub; worn paths lead to the fields, up steps to the
 * graveyard terrace, and down to the reservoir. The old tree on the terrace is the landmark, the one
 * shape that breaks the skyline. Older generations stay visible: the foundation of an earlier house,
 * a patched roof, mossy stones beside fresh ones.
 *
 * The light is a multiply layer over the sky and the island; the landing's text sits above it.
 */

const W = 368;
/** Room above the surface for the roof and the old tree's canopy. */
const HEAD = 40;
const SURF = 148;
/** Deepest point of the rock under the island, in art px. */
const UNDER = 66;
const H = HEAD + SURF + UNDER + 26;
/** Art px to CSS px. */
const SCALE = 2;

const CYCLE_SECONDS = 60;
/** Where in the loop night falls and the stone starts rising (0..1). */
const NIGHTFALL = 0.58;
const RISE_SECONDS = 1.8;
/** Reduced motion holds the scene here: dusk. */
const DUSK = 0.45;

const OUTLINE = islandOutline(W, SURF);
const keep = (x: number, y: number) => inside(OUTLINE, x, y);

/** Where things stand, in surface coords (top-left of the frame). */
const AT = {
  house: [22, -22],
  lectern: [110, 46],
  foundation: [16, 98, 44, 26],
  fieldA: [150, 80],
  fieldB: [202, 80],
  graveyard: [240, 0],
  oldTree: [204, 54],
  orchard: [314, 72],
  reservoir: [262, 104],
  treeLeft: [2, 58],
  treeBack: [322, 24],
  treeFront: [84, 110],
} as const;

/** Stone slots in the graveyard, bottom-centre relative to its frame. */
const SLOTS: [x: number, y: number][] = [
  [16, 30],
  [32, 30],
  [48, 30],
  [16, 48],
  [32, 48],
  [48, 48],
];
/** Stones already standing when the page opens (earlier players). */
const FIRST_STONES = 2;

/** What each plot shows, generation by generation (index = stones laid since the page opened). */
const AGES = {
  orchard: ['sapling', 'young', 'young', 'fruiting', 'fruiting'],
  fieldA: ['ripe', 'empty', 'empty', 'sown', 'growing'],
  fieldB: ['rotten', 'sown', 'growing', 'ripe', 'ripe'],
  reservoir: ['full', 'full', 'low', 'low', 'full'],
} as const;

/** Multiply colour for the light at each point of the loop; white leaves the scene as drawn. */
const LIGHT: [at: number, rgb: [number, number, number]][] = [
  [0, [255, 236, 214]], // morning
  [0.2, [255, 255, 255]], // day
  [0.42, [255, 205, 170]], // dusk (peach)
  [0.58, [150, 150, 200]], // night (plum)
  [0.85, [150, 150, 200]],
  [1, [255, 236, 214]],
];

function lightAt(p: number): string {
  for (let i = 1; i < LIGHT.length; i++) {
    const [b, to] = LIGHT[i];
    const [a, from] = LIGHT[i - 1];
    if (p <= b) {
      const k = (p - a) / (b - a);
      const c = from.map((v, j) => Math.round(v + (to[j] - v) * k));
      return `rgb(${c.join(' ')})`;
    }
  }
  return 'rgb(255 255 255)';
}

type Frames = Record<string, { x: number; y: number; w: number; h: number }>;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d')!;
}

/** The ground: grass tiles clipped to the outline, the terrace, the routes and the worked soil. */
function drawGround(g: Ctx, sheet: HTMLImageElement, frames: Frames, gen: number) {
  const tile = (name: string, x: number, y: number) => {
    const f = frames[name];
    if (f) g.drawImage(sheet, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
  };
  g.setTransform(1, 0, 0, 1, 0, HEAD);
  for (let ty = 0; ty < SURF + 16; ty += 16) {
    for (let tx = 0; tx < W; tx += 16) tile(`terrain/grass-${1 + (hash(tx, ty) % 3)}`, tx, ty);
  }
  const mask = canvas(W, H);
  mask.fillStyle = '#000';
  OUTLINE.forEach((c, x) => c && mask.fillRect(x, HEAD + c.top, 1, c.bot - c.top + 1));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask.canvas, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.setTransform(1, 0, 0, 1, 0, HEAD);

  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };

  // The rim: a sunlit lip along the back edge, darker grass along the front.
  OUTLINE.forEach((c, x) => {
    if (!c) return;
    px(RAMP.grassLip, x, c.top);
    if (hash(Math.floor(x / 2), 5) % 3) px(RAMP.grassLip, x, c.top + 1);
    px(RAMP.grassEdge, x, c.bot);
  });

  // Courtyard: the most-trodden ground, in front of the door.
  for (let y = -8; y <= 8; y++) {
    for (let x = -18; x <= 18; x++) {
      const d = (x * x) / 324 + (y * y) / 64;
      if (d > 1 || (d > 0.6 && hash(x, y, 7) % 2)) continue;
      px(d > 0.75 ? RAMP.pathShade : RAMP.path, 78 + x, 82 + y);
    }
  }

  // Routes: east to the fields and up to the graveyard, south to the reservoir.
  wornPath(
    g,
    [
      [86, 80],
      [118, 72],
      [170, 71],
      [230, 70],
      [270, 70],
      [300, 74],
    ],
    7,
    keep,
  );
  wornPath(
    g,
    [
      [271, 60],
      [271, 54],
    ],
    5,
    keep,
  );
  wornPath(
    g,
    [
      [80, 88],
      [98, 112],
      [130, 132],
      [190, 136],
      [258, 124],
    ],
    6,
    keep,
  );
  wornPath(
    g,
    [
      [34, 92],
      [52, 86],
      [66, 84],
    ],
    4,
    keep,
  );

  // Terrace: the graveyard and the old tree stand a step up, with a short face and steps.
  const terraceY = (x: number) => 63 + ((hash(Math.floor(x / 7), 33) % 3) - 1);
  for (let x = 160; x < W; x++) {
    const y = terraceY(x) - (x < 170 ? 170 - x : 0);
    const steps = x >= 265 && x <= 277;
    for (let d = 0; d < 6; d++) {
      if (!keep(x, y + d)) continue;
      if (steps) px(d % 2 ? RAMP.pathShade : RAMP.path, x, y + d);
      else
        px(
          d === 0
            ? RAMP.grassLip
            : d === 1
              ? RAMP.earth[3]
              : d < 4
                ? RAMP.stone[3]
                : d < 5
                  ? RAMP.stone[2]
                  : RAMP.stone[1],
          x,
          y + d,
        );
    }
  }

  // Worked soil around both beds; the resting one is rougher.
  tilledBorder(g, AT.fieldA[0], AT.fieldA[1], 48, 48, 1);
  tilledBorder(g, AT.fieldB[0], AT.fieldB[1], 48, 48, 2);

  oldFoundation(g, ...AT.foundation);

  // Leaves under the trees, more of them under the old one.
  fallenLeaves(g, AT.oldTree[0] + 4, AT.oldTree[1] + 3, 34, 8, 1, keep);
  fallenLeaves(g, AT.treeFront[0] + 18, AT.treeFront[1] + 31, 14, 4, 2, keep);
  fallenLeaves(g, AT.treeLeft[0] + 18, AT.treeLeft[1] + 31, 12, 4, 3, keep);

  // Old water marks: dark ground round the reservoir where it once brimmed over.
  if (AGES.reservoir[gen] === 'low') {
    for (let x = -2; x < 50; x++)
      if (hash(x, 9) % 3) px(RAMP.earth[2], AT.reservoir[0] + x, AT.reservoir[1] + 32);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function drawShadows(ctx: Ctx, ground: Ctx) {
  const s = new ShadowLayer(W, H);
  s.ctx.setTransform(1, 0, 0, 1, 0, HEAD);
  const [hx, hy] = AT.house;
  s.box(hx + 10, hy + 88, 104, 5);
  s.box(hx + 108, hy + 40, 6, 52);
  s.ellipse(AT.oldTree[0] + 12, AT.oldTree[1] + 2, 34, 7);
  s.box(AT.graveyard[0] + 4, AT.graveyard[1] + 58, 62, 3);
  s.box(AT.reservoir[0] + 3, AT.reservoir[1] + 31, 48, 3);
  s.box(AT.reservoir[0] + 47, AT.reservoir[1] + 3, 3, 30);
  s.ellipse(AT.treeLeft[0] + 19, AT.treeLeft[1] + 31, 10, 3);
  s.ellipse(AT.treeBack[0] + 19, AT.treeBack[1] + 31, 10, 3);
  s.ellipse(AT.treeFront[0] + 19, AT.treeFront[1] + 31, 11, 3);
  s.ellipse(AT.orchard[0] + 18, AT.orchard[1] + 31, 9, 2);
  s.ellipse(AT.lectern[0] + 10, AT.lectern[1] + 30, 6, 2);
  s.ellipse(207, 143, 5, 2);
  s.ellipse(52, 132, 8, 3);
  s.apply(ctx, 0.32, ground.canvas);
}

function drawIsland(
  ctx: Ctx,
  sheet: HTMLImageElement,
  frames: Frames,
  stones: number,
  lift: number,
) {
  const gen = Math.max(0, Math.min(AGES.orchard.length - 1, stones - FIRST_STONES));
  const blit = (name: string, dx: number, dy: number, clipBottom?: number) => {
    const f = frames[name];
    if (!f) return;
    const h = clipBottom === undefined ? f.h : Math.max(0, Math.min(f.h, clipBottom - dy));
    if (h > 0) ctx.drawImage(sheet, f.x, f.y, f.w, h, dx, dy, f.w, h);
  };
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawUnderside(ctx, OUTLINE, HEAD, UNDER);

  const ground = canvas(W, H);
  drawGround(ground, sheet, frames, gen);
  ctx.drawImage(ground.canvas, 0, 0);
  // A dark line where the back rim meets the sky.
  OUTLINE.forEach((c, x) => c && px(RAMP.outline, x, HEAD + c.top - 1));
  drawShadows(ctx, ground);

  ctx.setTransform(1, 0, 0, 1, 0, HEAD);

  // Back row: the house, the graveyard and the old tree.
  const [hx, hy] = AT.house;
  blit('house/exterior', hx, hy);
  // A repair in different tiles: slate patched into the terracotta.
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 4; x++) {
      const tx = hx + 70 + x * 4 - (y % 2) * 2;
      const ty = hy + 24 + y * 4;
      px('#7d7480', tx, ty, 4, 3);
      px('#9a91a0', tx, ty, 3, 1);
      px('#4f4757', tx, ty + 3, 4, 1);
    }
  }
  blit('lectern/default', ...AT.lectern);
  blit('boundary/tree-2', ...AT.treeBack);

  const [gx, gy] = AT.graveyard;
  blit('graveyard/default', gx, gy);
  SLOTS.slice(0, stones).forEach(([sx, sy], i) => {
    const grave = `grave/${1 + (hash(i, 3) % 4)}`;
    const bottom = gy + sy;
    const rising = i === stones - 1 && lift > 0;
    const x = gx + sx - 8;
    // The newest stone has a mound of fresh earth in front of it.
    if (i === stones - 1) {
      px(RAMP.earth[2], x + 3, bottom - 1, 10, 2);
      px(RAMP.earth[3], x + 4, bottom - 1, 7, 1);
    }
    blit(grave, x, bottom - 16 + lift, rising ? bottom : undefined);
    // The oldest are weathered: moss on the stone, grass grown up round the foot.
    const age = stones - 1 - i;
    if (age >= 2) {
      for (let m = 0; m < 3 + age; m++) {
        const mx = x + 4 + (hash(i, m, 4) % 8);
        px(
          m % 2 ? RAMP.moss : RAMP.mossLight,
          mx,
          bottom - 2 - (hash(i, m, 5) % (age > 3 ? 7 : 3)),
        );
      }
      px(RAMP.grassEdge, x + 3, bottom - 2, 2, 2);
      px(RAMP.grassEdge, x + 11, bottom - 3, 1, 3);
    }
  });
  oldTree(ctx, ...AT.oldTree);

  // Middle: the beds, with tools left beside them, and the orchard.
  blit(`field/${AGES.fieldA[gen]}`, ...AT.fieldA);
  blit(`field/${AGES.fieldB[gen]}`, ...AT.fieldB);
  // A hoe leaning on the bed's edge, and a basket.
  for (let s = 0; s < 12; s++) px(RAMP.bark[s < 2 ? 3 : 2], 140 + Math.floor(s / 3), 86 + s);
  px(RAMP.stone[4], 143, 97, 4, 2);
  px(RAMP.bark[3], 136, 118, 8, 1);
  px(RAMP.bark[2], 136, 119, 8, 4);
  px(RAMP.bark[1], 137, 123, 7, 1);
  px('#d9a441', 138, 117, 4, 1);
  blit(`orchard/${AGES.orchard[gen]}`, ...AT.orchard);

  // Front: the reservoir with a bucket, the trees, small things.
  blit(`reservoir/${AGES.reservoir[gen]}`, ...AT.reservoir);
  const [rx, ry] = AT.reservoir;
  px(RAMP.stone[2], rx + 52, ry + 20, 6, 1);
  px(RAMP.stone[4], rx + 52, ry + 21, 6, 6);
  px(RAMP.stone[5], rx + 52, ry + 21, 2, 5);
  px(RAMP.stone[1], rx + 52, ry + 27, 6, 1);
  px('#5fa8b8', rx + 53, ry + 20, 4, 1);

  blit('boundary/tree-1', ...AT.treeLeft);
  blit('boundary/tree-2', ...AT.treeFront);
  blit('deco/rock-1', 200, 130);
  blit('deco/rock-1', 44, 122);
  blit('deco/flower-1', 118, 98);
  blit('deco/flower-2', 30, 74);
  blit('deco/flower-1', 300, 136);
  bush(ctx, 150, 40, 6, 7);
  bush(ctx, 352, 112, 6, 9);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grade(ctx);
}

/** The light at dusk, for a still island (the replay's ending card). */
export const DUSK_LIGHT = DUSK;
/** How many stones the island's graveyard can show. */
export const STONE_SLOTS = SLOTS.length;

export function IslandScene({
  lightRef,
  hold,
}: {
  lightRef: React.RefObject<HTMLDivElement | null>;
  /** Hold still at this point of the loop with this many stones, instead of living through it. */
  hold?: { light: number; stones: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const holdLight = hold?.light;
  const holdStones = hold?.stones;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = import.meta.env.BASE_URL;
    let raf = 0;
    let disposed = false;

    const sheet = new Image();
    sheet.src = `${base}assets/atlas/world.png`;
    const frames = fetch(`${base}assets/atlas/world.json`)
      .then((r) => r.json() as Promise<{ frames: Record<string, { frame: Frames[string] }> }>)
      .then(
        (d) => Object.fromEntries(Object.entries(d.frames).map(([k, v]) => [k, v.frame])) as Frames,
      );

    void Promise.all([frames, sheet.decode()])
      .then(([f]) => {
        if (disposed) return;
        const setLight = (p: number) => {
          if (lightRef.current) lightRef.current.style.backgroundColor = lightAt(p);
        };
        if (holdLight !== undefined) {
          setLight(holdLight);
          drawIsland(ctx, sheet, f, Math.min(SLOTS.length, holdStones ?? 0), 0);
          return;
        }
        if (reduced) {
          setLight(DUSK);
          drawIsland(ctx, sheet, f, FIRST_STONES + 1, 0);
          return;
        }
        const start = performance.now();
        let drawn = '';
        const tick = (now: number) => {
          const elapsed = (now - start) / 1000;
          const loop = Math.floor(elapsed / CYCLE_SECONDS);
          const p = (elapsed / CYCLE_SECONDS) % 1;
          // One more stone each night, until the graveyard is full; then the island starts over.
          const nights = (loop % (SLOTS.length - FIRST_STONES)) + (p >= NIGHTFALL ? 1 : 0);
          const stones = FIRST_STONES + nights;
          const rise =
            p >= NIGHTFALL ? Math.min(1, ((p - NIGHTFALL) * CYCLE_SECONDS) / RISE_SECONDS) : 1;
          // Whole pixels only, so the scene redraws once per pixel the stone climbs.
          const lift = Math.round(16 * (1 - rise));
          const key = `${stones}:${lift}`;
          if (key !== drawn) {
            drawIsland(ctx, sheet, f, stones, lift);
            drawn = key;
          }
          setLight(p);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((err: unknown) => console.warn('Landing island art unavailable.', err));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [lightRef, holdLight, holdStones]);

  return (
    <div className="island" aria-hidden>
      <canvas
        ref={ref}
        className="island__canvas"
        width={W}
        height={H}
        style={{ width: W * SCALE, height: H * SCALE }}
      />
    </div>
  );
}
