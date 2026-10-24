import { bfsDistance, type Grid } from './grid';
import { fbm } from './noise';
import type { WorldgenOptions } from './options';
import { WorldgenError } from './options';
import type { Point } from './types';

/**
 * Which tiles are inside the boundary (1) or part of it (0): a rounded rectangle the size of the
 * map, inset by a noisy `boundaryDepth`. Anything inside that isn't connected to spawn is folded
 * into the boundary, so the farmable area is always one piece.
 */
export function buildMask(seed: number, o: WorldgenOptions, spawn: Point): Uint8Array {
  const { width: w, height: h } = o;
  const jitter = fbm(seed, 'boundary', { frequency: 0.18, octaves: 2 });
  const { min, max } = o.boundaryDepth;
  const r = Math.min(o.cornerRadius, w / 2, h / 2);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;

  const raw = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Signed distance to the rounded-rect map edge; tiles on the outermost row sit at 0.5.
      const qx = Math.abs(x - cx) - (w / 2 - r);
      const qy = Math.abs(y - cy) - (h / 2 - r);
      const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      // Threshold in [min, max + 0.5) gives a boundary min..max tiles thick.
      const depth = min + jitter(x, y) * (max - min + 0.5);
      if (-sdf > depth) raw[y * w + x] = 1;
    }
  }

  const s = spawn.y * w + spawn.x;
  if (!raw[s]) throw new WorldgenError(`spawn (${spawn.x}, ${spawn.y}) is outside the boundary`);
  const reach = bfsDistance({ width: w, height: h }, [s], (i) => raw[i] === 1);
  return raw.map((_, i) => (reach[i]! >= 0 ? 1 : 0));
}

/** Steps from each tile to the nearest boundary tile (0 on the boundary itself). */
export function edgeDistance(g: Grid, inside: Uint8Array): Int32Array {
  const sources: number[] = [];
  inside.forEach((v, i) => {
    if (!v) sources.push(i);
  });
  return bfsDistance(g, sources, () => true);
}
