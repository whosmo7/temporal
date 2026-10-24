import { forEachNeighbour, MinHeap, pointRectDistance, rectBorder, rectTiles } from './grid';
import { fbm } from './noise';
import type { WorldgenOptions } from './options';
import type { Site } from './plots';
import type { Plot } from './types';

/**
 * Carves a path network from the entrance to a tile next to every plot (Dijkstra). Each new path
 * branches off the nearest point of the network so far, and noise-weighted step costs make them
 * wander a little. Returns a 1/0 path mask, or null if some plot can't be reached.
 */
export function carvePaths(seed: number, site: Site, plots: Plot[], o: WorldgenOptions): Uint8Array | null {
  const size = site.width * site.height;
  const blocked = new Uint8Array(size);
  for (const p of plots) for (const i of rectTiles(site, p)) blocked[i] = 1;
  const passable = (i: number) => site.open[i] === 1 && blocked[i] === 0;

  const wiggle = fbm(seed, 'path', { frequency: 0.25, octaves: 2 });
  const stepCost = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    stepCost[i] = 1 + o.pathWiggle * wiggle(i % site.width, Math.floor(i / site.width));
  }

  const path = new Uint8Array(size);
  path[site.entrance.y * site.width + site.entrance.x] = 1;

  const byDistance = [...plots].sort(
    (a, b) => pointRectDistance(site.entrance, a) - pointRectDistance(site.entrance, b) || (a.id < b.id ? -1 : 1),
  );
  for (const plot of byDistance) {
    const targets = new Set(rectBorder(site, plot).filter(passable));
    if ([...targets].some((i) => path[i])) continue;

    const cost = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const heap = new MinHeap();
    for (let i = 0; i < size; i++) {
      if (path[i]) {
        cost[i] = 0;
        heap.push(0, i);
      }
    }
    let reached = -1;
    while (heap.size > 0) {
      const { cost: c, i } = heap.pop()!;
      if (c > cost[i]!) continue;
      if (targets.has(i)) {
        reached = i;
        break;
      }
      forEachNeighbour(site, i, (j) => {
        if (!passable(j)) return;
        const next = c + stepCost[j]!;
        if (next < cost[j]!) {
          cost[j] = next;
          prev[j] = i;
          heap.push(next, j);
        }
      });
    }
    if (reached === -1) return null;
    for (let i = reached; i !== -1 && !path[i]; i = prev[i]!) path[i] = 1;
  }
  return path;
}
