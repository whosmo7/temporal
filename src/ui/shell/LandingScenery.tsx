import { useEffect, useRef, useState } from 'react';
import { cloudBank, distantIsland, type Ctx } from './islandArt';

/**
 * The landing's depth, in layers around the island (art px, drawn at 2× like the island so the
 * whole scene shares one pixel size): pale islands far off behind it, and a bank of cloud drifting
 * in front of its underside for the words and buttons to sit on.
 */

const SCALE = 2;

function useDrawn(w: number, h: number, draw: (ctx: Ctx) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx);
  }, [draw]);
  return { ref, width: w, height: h, style: { width: w * SCALE, height: h * SCALE } };
}

/** The haze the far islands fade into: the sky around the horizon. */
const HAZE: [number, number, number] = [168, 196, 176];

const FAR: [x: number, y: number, w: number, near: number][] = [
  [92, 150, 62, 0.7],
  [176, 92, 26, 0.15],
  [34, 236, 38, 0.35],
  [548, 128, 74, 0.8],
  [470, 66, 22, 0],
  [612, 214, 36, 0.3],
];

function drawFar(ctx: Ctx) {
  FAR.forEach(([x, y, w, near], i) => distantIsland(ctx, x, y, w, near, i + 1, HAZE));
}

export function DistantIslands() {
  const c = useDrawn(640, 300, drawFar);
  return <canvas className="scenery scenery--far" aria-hidden {...c} />;
}

const BANK_W = 480;
const BANK_H = 96;
/** Where the bank's puffs give way to solid cloud. */
const BANK_BASE = 64;
const BANK = { light: '#fff6dc', mid: '#f0dcbc', shade: '#cdb4ac' };

/** A wide cloud tile, rendered once and repeated across the bottom of the screen. */
export function CloudBank() {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = BANK_W;
    c.height = BANK_H;
    const ctx = c.getContext('2d')!;
    cloudBank(ctx, BANK_W, BANK_H, BANK_BASE, BANK);
    setUrl(c.toDataURL());
  }, []);
  return (
    <div
      className="scenery scenery--bank"
      aria-hidden
      style={
        url
          ? {
              backgroundImage: `url(${url}), linear-gradient(transparent ${BANK_BASE * SCALE}px, ${BANK.mid} ${BANK_BASE * SCALE}px)`,
              backgroundSize: `${BANK_W * SCALE}px ${BANK_H * SCALE}px, 100% 100%`,
            }
          : undefined
      }
    />
  );
}
