import { rectTiles } from './grid';
import type { WorldgenOptions } from './options';
import type { Site } from './plots';
import type { Rng } from './rng';
import type { DecoTile, Plot } from './types';

const DECO_KINDS: DecoTile[] = ['rock', 'bush', 'flower'];

/**
 * Scatters rocks, bushes and flowers on free ground. Keeps clear of paths, of a one-tile ring
 * around every plot (so each stays approachable from all sides) and of the area around spawn.
 */
export function scatterDeco(site: Site, plots: Plot[], path: Uint8Array, o: WorldgenOptions, rng: Rng) {
  const deco: (DecoTile | null)[] = new Array(site.width * site.height).fill(null);
  const total = DECO_KINDS.reduce((sum, k) => sum + o.decoWeights[k], 0);
  if (total === 0 || o.decoDensity === 0) return deco;

  const keepClear = new Uint8Array(deco.length);
  for (const p of plots) {
    const ring = { x: p.x - 1, y: p.y - 1, w: p.w + 2, h: p.h + 2 };
    for (const i of rectTiles(site, clip(site, ring))) keepClear[i] = 1;
  }

  for (let i = 0; i < deco.length; i++) {
    if (!site.ground[i] || path[i] || keepClear[i]) continue;
    const x = i % site.width;
    const y = (i - x) / site.width;
    if (Math.max(Math.abs(x - site.spawn.x), Math.abs(y - site.spawn.y)) <= o.spawnClearance) continue;
    if (!rng.chance(o.decoDensity)) continue;
    let roll = rng.next() * total;
    for (const kind of DECO_KINDS) {
      roll -= o.decoWeights[kind];
      if (roll < 0) {
        deco[i] = kind;
        break;
      }
    }
  }
  return deco;
}

function clip(site: Site, r: { x: number; y: number; w: number; h: number }) {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  return { x, y, w: Math.min(site.width, r.x + r.w) - x, h: Math.min(site.height, r.y + r.h) - y };
}
