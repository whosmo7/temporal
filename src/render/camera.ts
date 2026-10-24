import { TILE, VIEW_TILES } from './constants';

/**
 * World scale in CSS pixels per art pixel. It's an integer number of *device* pixels per art
 * pixel, so pixel art stays crisp on fractional devicePixelRatio screens too.
 */
export function pickZoom(viewW: number, viewH: number, dpr: number): number {
  const devicePerArt = Math.max(1, Math.floor(Math.min((viewW * dpr) / (VIEW_TILES.x * TILE), (viewH * dpr) / (VIEW_TILES.y * TILE))));
  return devicePerArt / dpr;
}

/**
 * Top-left offset (CSS px) for the world container so `focus` (in art px) sits mid-screen,
 * clamped so the camera never shows past the map edge. A map smaller than the view is centred.
 * Rounded to whole device pixels to avoid shimmer.
 */
export function cameraOffset(
  focus: { x: number; y: number },
  view: { w: number; h: number },
  world: { w: number; h: number },
  zoom: number,
  dpr: number,
): { x: number; y: number } {
  const axis = (f: number, v: number, w: number) => {
    const size = w * zoom;
    const offset = size <= v ? (v - size) / 2 : clamp(v / 2 - f * zoom, v - size, 0);
    return Math.round(offset * dpr) / dpr;
  };
  return { x: axis(focus.x, view.w, world.w), y: axis(focus.y, view.h, world.h) };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
