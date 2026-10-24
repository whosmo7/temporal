import { pointRectDistance, rectGap, rectTiles, type Grid } from './grid';
import { plotSlots, WorldgenError, type WorldgenOptions } from './options';
import type { Rng } from './rng';
import type { Plot, PlotId, PlotKind, Point } from './types';

/** Precomputed ground facts the placement, path and deco stages share. */
export interface Site extends Grid {
  spawn: Point;
  /** Inside the boundary and not a pond. */
  ground: Uint8Array;
  /** `ground` tiles reachable from spawn: the only tiles plots and paths may use. */
  open: Uint8Array;
  /** Steps to the nearest boundary tile. */
  edgeDist: Int32Array;
  /** Steps to the nearest pond (or sea on Island), -1 if the map has no water. */
  waterDist: Int32Array;
  elevation: Float64Array;
}

/** Seeded plots are placed in this order: most constrained first. */
const PLACEMENT_ORDER: PlotKind[] = ['lectern', 'reservoir', 'wild', 'graveyard', 'orchard', 'well', 'field'];

/** Pinned plots must sit on open ground, clear of spawn and of each other. Throws if not. */
export function pinnedPlots(site: Site, o: WorldgenOptions): Plot[] {
  const plots: Plot[] = [];
  for (const slot of plotSlots(o)) {
    const at = o.pin[slot.id];
    if (!at) continue;
    const plot = { ...slot, ...at, ...o.plotSizes[slot.kind] };
    const where = `pinned ${slot.id} at (${at.x}, ${at.y})`;
    if (plot.x + plot.w > site.width || plot.y + plot.h > site.height) throw new WorldgenError(`${where} runs off the map`);
    if (!rectTiles(site, plot).every((i) => site.open[i])) {
      throw new WorldgenError(`${where} overlaps the boundary, a pond or unreachable ground`);
    }
    if (pointRectDistance(site.spawn, plot) < 2) throw new WorldgenError(`${where} is on or next to spawn`);
    const clash = plots.find((p) => rectGap(p, plot) < 0);
    if (clash) throw new WorldgenError(`${where} overlaps pinned ${clash.id}`);
    plots.push(plot);
  }
  return plots;
}

/**
 * Seeds every unpinned plot onto open ground, `plotSpacing` apart. Returns null when some plot
 * has nowhere left to go, so the caller can re-roll with the next draws from `rng`.
 */
export function placePlots(site: Site, o: WorldgenOptions, pinned: Plot[], rng: Rng): Plot[] | null {
  const placed = [...pinned];
  const slots = plotSlots(o).filter((s) => !o.pin[s.id]);
  slots.sort((a, b) => PLACEMENT_ORDER.indexOf(a.kind) - PLACEMENT_ORDER.indexOf(b.kind));

  for (const slot of slots) {
    const { w, h } = o.plotSizes[slot.kind];
    const candidates: Plot[] = [];
    for (let y = 0; y + h <= site.height; y++) {
      for (let x = 0; x + w <= site.width; x++) {
        const plot = { id: slot.id, kind: slot.kind, x, y, w, h };
        if (fits(site, o, plot, placed)) candidates.push(plot);
      }
    }
    if (candidates.length === 0) return null;
    placed.push(slot.kind === 'reservoir' ? pickReservoir(site, candidates, rng) : rng.pick(candidates));
  }

  const order = new Map<PlotId, number>(plotSlots(o).map((s, i) => [s.id, i]));
  return placed.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

function fits(site: Site, o: WorldgenOptions, plot: Plot, placed: Plot[]): boolean {
  const near = pointRectDistance(site.spawn, plot);
  if (near < 2) return false; // keep spawn and the ring around it open
  if (plot.kind === 'lectern' && near > o.lecternRange) return false;
  if (placed.some((p) => rectGap(p, plot) < o.plotSpacing)) return false;
  const tiles = rectTiles(site, plot);
  if (!tiles.every((i) => site.open[i])) return false;
  // Wild spot sits on the tree edge (Forest) or the shoreline (Island).
  if (plot.kind === 'wild' && !tiles.some((i) => site.edgeDist[i] === 1)) return false;
  return true;
}

/** Reservoir goes near water and on low ground: pick among the best-scoring 5% of spots. */
function pickReservoir(site: Site, candidates: Plot[], rng: Rng): Plot {
  const scored = candidates.map((plot) => {
    const tiles = rectTiles(site, plot);
    const toWater = Math.max(0, Math.min(...tiles.map((i) => site.waterDist[i]!)));
    const elevation = tiles.reduce((sum, i) => sum + site.elevation[i]!, 0) / tiles.length;
    return { plot, score: toWater + elevation * 10 };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.05)));
  return rng.pick(best).plot;
}
