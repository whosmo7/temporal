import type { Plot, Point } from './types';

export interface Grid {
  width: number;
  height: number;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Calls `fn` with the index of each in-bounds 4-neighbour of tile `i`. */
export function forEachNeighbour(g: Grid, i: number, fn: (j: number) => void): void {
  const x = i % g.width;
  const y = (i - x) / g.width;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < g.width && ny < g.height) fn(ny * g.width + nx);
  }
}

/** Multi-source BFS. Returns steps to the nearest source per tile, or -1 if unreachable. */
export function bfsDistance(g: Grid, sources: Iterable<number>, passable: (i: number) => boolean): Int32Array {
  const dist = new Int32Array(g.width * g.height).fill(-1);
  const queue: number[] = [];
  for (const s of sources) {
    if (dist[s] === -1) {
      dist[s] = 0;
      queue.push(s);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    forEachNeighbour(g, i, (j) => {
      if (dist[j] === -1 && passable(j)) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    });
  }
  return dist;
}

export function rectTiles(g: Grid, r: Pick<Plot, 'x' | 'y' | 'w' | 'h'>): number[] {
  const out: number[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push(y * g.width + x);
  return out;
}

/** In-bounds tiles 4-adjacent to the rectangle, outside it. */
export function rectBorder(g: Grid, r: Pick<Plot, 'x' | 'y' | 'w' | 'h'>): number[] {
  const out: number[] = [];
  const push = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < g.width && y < g.height) out.push(y * g.width + x);
  };
  for (let x = r.x; x < r.x + r.w; x++) {
    push(x, r.y - 1);
    push(x, r.y + r.h);
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    push(r.x - 1, y);
    push(r.x + r.w, y);
  }
  return out;
}

/** Free tiles between two rectangles along the more separated axis. Negative = overlapping. */
export function rectGap(a: Pick<Plot, 'x' | 'y' | 'w' | 'h'>, b: Pick<Plot, 'x' | 'y' | 'w' | 'h'>): number {
  return Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
}

/** Chebyshev distance from a point to the nearest tile of a rectangle (0 if inside). */
export function pointRectDistance(p: Point, r: Pick<Plot, 'x' | 'y' | 'w' | 'h'>): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w - 1));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h - 1));
  return Math.max(dx, dy);
}

/** Binary min-heap of tile indices keyed by cost, for Dijkstra. */
export class MinHeap {
  private items: { cost: number; i: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(cost: number, i: number): void {
    const items = this.items;
    items.push({ cost, i });
    let c = items.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!less(items[c]!, items[p]!)) break;
      [items[c], items[p]] = [items[p]!, items[c]!];
      c = p;
    }
  }

  pop(): { cost: number; i: number } | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1;
        const r = l + 1;
        let m = p;
        if (l < items.length && less(items[l]!, items[m]!)) m = l;
        if (r < items.length && less(items[r]!, items[m]!)) m = r;
        if (m === p) break;
        [items[m], items[p]] = [items[p]!, items[m]!];
        p = m;
      }
    }
    return top;
  }
}

/** Ties break on tile index, so the search order (and the carved path) is deterministic. */
function less(a: { cost: number; i: number }, b: { cost: number; i: number }): boolean {
  return a.cost < b.cost || (a.cost === b.cost && a.i < b.i);
}
