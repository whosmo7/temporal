// A world's final generation drawn as a small floating island for the gallery (06, art direction ›
// gallery). The playable area is the island's top, drawn from the world atlas like the `04`
// renderer draws it; the boundary (forest edge or sea) is left out, so the edge of the map is the
// edge of the island, and a cliff hangs underneath.

import type { Gravestone } from '../../api';
import { visibleView, type WorldState } from '../../engine';
import { layoutStones } from '../../render/graveyard';
import { FOUNDER_STAGE, generateMap, type Plot, type TileMap } from '../../worldgen';
import type { PresetName } from '../../worldgen/presets';
import { palette } from '../theme/palette';

const TILE = 16;
/** Room above the top row for canopies and roofs. */
const HEADROOM = 2 * TILE;
/** Deepest point of the cliff, in art px. */
const CLIFF = 56;
const FLAT = new Set<Plot['kind']>(['field', 'wild']);

export type Frames = Record<string, { x: number; y: number; w: number; h: number }>;

export interface IslandInput {
  seed: number;
  biome: TileMap['biome'];
  preset?: PresetName;
  /** State after the last generation; plots show their stage in it. Founder stages without it. */
  state?: WorldState | null;
  stones: Gravestone[];
}

/** The canvas size `drawIslandMap` needs, in art px. */
export function islandSize(map: TileMap): { w: number; h: number; box: Box } {
  const box = inside(map);
  return { w: box.w * TILE, h: HEADROOM + box.h * TILE + CLIFF, box };
}

export function islandMap(input: IslandInput): TileMap {
  return generateMap(input.seed, input.biome, input.preset ?? 'default');
}

export function drawIslandMap(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource, frames: Frames, map: TileMap, input: IslandInput): void {
  const { w, h, box } = islandSize(map);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-box.x * TILE, HEADROOM - box.y * TILE);

  const blit = (name: string | undefined, dx: number, dy: number, scale = 1) => {
    const f = name ? frames[name] : undefined;
    if (!f) return;
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, Math.round(dx), Math.round(dy), f.w * scale, f.h * scale);
  };
  const variant = (base: string, x: number, y: number) => {
    let n = 0;
    while (frames[`${base}-${n + 1}`]) n++;
    return n === 0 ? base : `${base}-${1 + (hash(x, y) % n)}`;
  };
  /** Bottom-centre anchored, the way the renderer places tall things. */
  const stand = (name: string | undefined, cx: number, bottom: number, scale = 1) => {
    const f = name ? frames[name] : undefined;
    if (f) blit(name, cx - (f.w * scale) / 2, bottom - f.h * scale, scale);
  };

  const { terrain, boundary, deco } = map.layers;
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !boundary[y * map.width + x];

  drawCliff(ctx, box, isLand);

  // Ground and flowers.
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (!isLand(x, y)) continue;
      const i = y * map.width + x;
      blit(variant(`terrain/${terrain[i]}`, x, y), x * TILE, y * TILE);
      if (deco[i] === 'flower') blit(variant('deco/flower', x, y), x * TILE, y * TILE);
    }
  }

  const stages = input.state ? visibleView(input.state, input.state.turnSeconds).plots : {};
  const plotFrame = (p: Plot) => {
    const stage = stages[p.id]?.stage ?? FOUNDER_STAGE[p.kind] ?? (p.kind === 'wild' ? 'many' : 'default');
    return frames[`${p.kind}/${stage}-${map.biome}`] ? `${p.kind}/${stage}-${map.biome}` : `${p.kind}/${stage}`;
  };

  // Flat plots, then everything tall sorted by its bottom edge.
  for (const p of map.plots) if (FLAT.has(p.kind)) stand(plotFrame(p), (p.x + p.w / 2) * TILE, (p.y + p.h) * TILE);

  const tall: { bottom: number; draw: () => void }[] = [];
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const d = deco[y * map.width + x];
      if (!isLand(x, y) || !d || d === 'flower') continue;
      tall.push({ bottom: (y + 1) * TILE, draw: () => stand(variant(`deco/${d}`, x, y), (x + 0.5) * TILE, (y + 1) * TILE) });
    }
  }
  for (const p of map.plots) {
    if (FLAT.has(p.kind)) continue;
    const bottom = (p.y + p.h) * TILE;
    tall.push({ bottom: bottom - 0.5, draw: () => stand(plotFrame(p), (p.x + p.w / 2) * TILE, bottom) });
    if (p.kind === 'graveyard') {
      for (const spot of layoutStones(p, input.stones)) {
        tall.push({ bottom: bottom - 0.4, draw: () => stand(spot.frame, p.x * TILE + spot.x, p.y * TILE + spot.y, spot.scale) });
      }
    }
  }
  const house = map.house;
  if (house) tall.push({ bottom: (house.y + house.h) * TILE - 0.25, draw: () => blit('house/exterior', house.x * TILE, (house.y + house.h) * TILE - (frames['house/exterior']?.h ?? 0)) });
  tall.sort((a, b) => a.bottom - b.bottom).forEach((t) => t.draw());

  ctx.restore();
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The smallest box round every tile inside the boundary. */
function inside(map: TileMap): Box {
  let x0 = map.width;
  let y0 = map.height;
  let x1 = -1;
  let y1 = -1;
  map.layers.boundary.forEach((b, i) => {
    if (b) return;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  });
  return x1 < 0 ? { x: 0, y: 0, w: map.width, h: map.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The underside: a ledge lip, clay, then bark, with an ink edge, deepest in the middle. */
function drawCliff(ctx: CanvasRenderingContext2D, box: Box, isLand: (x: number, y: number) => boolean): void {
  const left = box.x * TILE;
  const width = box.w * TILE;
  for (let px = 0; px < width; px++) {
    const tx = box.x + Math.floor(px / TILE);
    let last = -1;
    for (let y = box.y; y < box.y + box.h; y++) if (isLand(tx, y)) last = y;
    if (last < 0) continue;
    const top = (last + 1) * TILE;
    const t = (px - width / 2) / (width / 2);
    const jag = (hash(Math.floor(px / 4), 7) % 5) - 2;
    const depth = Math.max(4, Math.round((CLIFF - 6) * (1 - t * t)) + jag);
    const x = left + px;
    const clay = Math.round(depth * 0.4);
    ctx.fillStyle = palette.ledge;
    ctx.fillRect(x, top, 1, 3);
    ctx.fillStyle = palette.clay;
    ctx.fillRect(x, top + 3, 1, clay);
    ctx.fillStyle = palette.bark;
    ctx.fillRect(x, top + 3 + clay, 1, Math.max(0, depth - 3 - clay));
    ctx.fillStyle = palette.ink;
    ctx.fillRect(x, top + depth, 1, 1);
  }
}

function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}
