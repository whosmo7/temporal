import { useEffect, useRef } from 'react';
import { palette } from '../theme/palette';

/**
 * The landing's floating island living through a generation (app-shell brief, "One generation a
 * minute"). A static composite of the world atlas on a 2D canvas, standing in until the `04`
 * renderer can draw a read-only sample world. Over a 60 s loop the light goes morning → dusk →
 * night → morning, and at each nightfall one more stone rises in the graveyard.
 *
 * The light is a multiply layer over the sky and the island; the landing's text sits above it.
 */

const TILE = 16;
const COLS = 16;
const ROWS = 9;
const W = COLS * TILE;
const TOP = ROWS * TILE;
/** Deepest point of the cliff under the island, in art px. */
const CLIFF = 44;
const H = TOP + CLIFF;
/** Art px to CSS px. */
const SCALE = 2;

const CYCLE_SECONDS = 60;
/** Where in the loop night falls and the stone starts rising (0..1). */
const NIGHTFALL = 0.58;
const RISE_SECONDS = 1.8;
/** Reduced motion holds the scene here: dusk. */
const DUSK = 0.45;

// g = grass, p = path, . = sky
const SHAPE = [
  '...gggggggggg...',
  '.gggggggggggggg.',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggggpppppppggg',
  'gggggggggggggggg',
  '.gggggggggggggg.',
  '...gggggggggg...',
];

/** Frames placed by top-left corner, in draw order (back to front). */
const PROPS: [frame: string, x: number, y: number][] = [
  ['graveyard/default', 182, 2],
  ['field/ripe', 128, 18],
  ['house/exterior', 10, 4],
  ['deco/flower-1', 112, 40],
  ['deco/flower-2', 24, 116],
  ['deco/bush-1', 2, 52],
  ['boundary/tree-1', 52, 102],
  ['boundary/tree-2', 214, 70],
  ['orchard/young', 138, 104],
  ['reservoir/full', 180, 100],
  ['deco/flower-1', 228, 40],
  ['deco/rock-1', 116, 126],
];

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

function tileHash(x: number, y: number) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

/** Bottom grass row per pixel column, and the cliff's depth there. */
function cliffProfile() {
  const out: { top: number; depth: number }[] = [];
  for (let x = 0; x < W; x++) {
    const col = Math.floor(x / TILE);
    let last = -1;
    SHAPE.forEach((row, y) => row[col] !== '.' && (last = y));
    const top = (last + 1) * TILE;
    const t = (x - W / 2) / (W / 2);
    const jag = (tileHash(Math.floor(x / 4), 7) % 5) - 2;
    out.push({ top, depth: Math.max(4, Math.round((CLIFF - 6) * (1 - t * t)) + jag + 6 - (top < TOP ? 10 : 0)) });
  }
  return out;
}

function drawIsland(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, frames: Frames, stones: number, rise: number) {
  const blit = (name: string, dx: number, dy: number, clipBottom?: number) => {
    const f = frames[name];
    if (!f) return;
    const h = clipBottom === undefined ? f.h : Math.max(0, Math.min(f.h, clipBottom - dy));
    if (h > 0) ctx.drawImage(sheet, f.x, f.y, f.w, h, dx, dy, f.w, h);
  };

  ctx.clearRect(0, 0, W, H);

  // Cliff underside: a ledge lip, clay, then bark, with an ink edge at the bottom.
  cliffProfile().forEach(({ top, depth }, x) => {
    ctx.fillStyle = palette.ledge;
    ctx.fillRect(x, top, 1, 3);
    ctx.fillStyle = palette.clay;
    ctx.fillRect(x, top + 3, 1, Math.round(depth * 0.4));
    ctx.fillStyle = palette.bark;
    ctx.fillRect(x, top + 3 + Math.round(depth * 0.4), 1, depth - 3 - Math.round(depth * 0.4));
    ctx.fillStyle = palette.ink;
    ctx.fillRect(x, top + depth, 1, 1);
  });

  // Ground.
  SHAPE.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const base = ch === 'p' ? 'terrain/path' : 'terrain/grass';
      const n = ch === 'p' ? 2 : 3;
      blit(`${base}-${1 + (tileHash(x, y) % n)}`, x * TILE, y * TILE);
    }),
  );

  for (const [name, x, y] of PROPS) {
    blit(name, x, y);
    if (name !== 'graveyard/default') continue;
    SLOTS.slice(0, stones).forEach(([sx, sy], i) => {
      const grave = `grave/${1 + (tileHash(i, 3) % 4)}`;
      const bottom = y + sy;
      const risingOne = i === stones - 1 && rise < 1;
      const lift = risingOne ? Math.round(TILE * (1 - rise)) : 0;
      blit(grave, x + sx - TILE / 2, bottom - TILE + lift, risingOne ? bottom : undefined);
    });
  }
}

export function IslandScene({ lightRef }: { lightRef: React.RefObject<HTMLDivElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = import.meta.env.BASE_URL;
    let raf = 0;
    let disposed = false;

    const sheet = new Image();
    sheet.src = `${base}assets/atlas/world.png`;
    const frames = fetch(`${base}assets/atlas/world.json`)
      .then((r) => r.json() as Promise<{ frames: Record<string, { frame: Frames[string] }> }>)
      .then((d) => Object.fromEntries(Object.entries(d.frames).map(([k, v]) => [k, v.frame])) as Frames);

    void Promise.all([frames, sheet.decode()])
      .then(([f]) => {
        if (disposed) return;
        const setLight = (p: number) => {
          if (lightRef.current) lightRef.current.style.backgroundColor = lightAt(p);
        };
        if (reduced) {
          setLight(DUSK);
          drawIsland(ctx, sheet, f, FIRST_STONES + 1, 1);
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
          const rise = p >= NIGHTFALL ? Math.min(1, ((p - NIGHTFALL) * CYCLE_SECONDS) / RISE_SECONDS) : 1;
          const key = `${stones}:${rise}`;
          if (key !== drawn) {
            drawIsland(ctx, sheet, f, stones, rise);
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
  }, [lightRef]);

  return (
    <div className="island" aria-hidden>
      <canvas ref={canvas} className="island__canvas" width={W} height={H} style={{ width: W * SCALE, height: H * SCALE }} />
    </div>
  );
}
