// Ghosts in the replay (decision 038): a faint figure of each generation's player going about
// their day. Nothing logs where people walked, only where and when they acted, so a ghost walks
// from the door to each place its player worked, arrives in time for the action to finish when
// the log says it did, and stands there working for as long as the action takes. Ghosts glide
// straight through walls and water. Pure, so it's tested without Pixi.

import type { Replay } from '../../api';
import { CONFIG, mapPlotOf, tileOf, type PlotId } from '../../engine';
import type { TileMap } from '../../worldgen';
import { WALK_SPEED } from '../../render/constants';
import type { Facing } from '../../render/movement';

/** Where the ghost is at one moment of its day, in tile units (feet position, like the player). */
export interface GhostPose {
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  working: boolean;
}

/** One generation's ghost: the length of its day in turn seconds, and where it is at any second of it. */
export interface GhostDay {
  seconds: number;
  poseAt(t: number): GhostPose;
}

interface Stop {
  x: number;
  y: number;
  facing: Facing;
  /** Turn seconds: the ghost works from `arrive` to `leave`. */
  arrive: number;
  leave: number;
}

/** Feet sit near the bottom of a tile, as the walker's do. */
const FEET = 0.9;

/** Where someone stands to work on a plot, a tile or the oven: just below it, facing up. */
function standAt(map: TileMap, plotId: PlotId): { x: number; y: number; facing: Facing } | null {
  const plot = map.plots.find((p) => p.id === mapPlotOf(plotId));
  if (!plot) return null;
  const tile = tileOf(plotId);
  if (tile) return { x: plot.x + tile.x + 0.5, y: plot.y + tile.y + 1 + FEET, facing: 'up' };
  return { x: plot.x + plot.w / 2, y: plot.y + plot.h + FEET, facing: 'up' };
}

function oven(map: TileMap): { x: number; y: number; facing: Facing } | null {
  const f = map.house?.furniture.find((item) => item.kind === 'oven');
  return f ? { x: f.x + f.w / 2, y: f.y + f.h + FEET, facing: 'up' } : null;
}

function facingFor(dx: number, dy: number, fallback: Facing): Facing {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * The ghost of generation `turn` (1-based), or null when nobody played it. Actions with no place
 * to stand (filling the can at a pond, a Fast Track on an effect with no plot) are worked where
 * the ghost already is.
 */
export function ghostDay(replay: Replay, map: TileMap, turn: number): GhostDay | null {
  const state = replay.snapshots[turn - 1];
  if (!state) return null;

  // Fast Track names an effect, not a plot: find the plot through the effect's id (as plotHistory does).
  const effectPlot = new Map<string, PlotId | undefined>();
  for (const s of replay.snapshots) for (const e of s.pending) effectPlot.set(e.id, e.plotId);

  const start = { x: map.spawn.x + 0.5, y: map.spawn.y + FEET, facing: 'down' as Facing };
  const stops: Stop[] = [];
  let here = start;
  // In time order: a log's `seq` is the order actions were logged, which a scripted or hurried log
  // needn't keep in step with the clock.
  const when = (a: Replay['actions'][number]) => a.committedAt.t ?? 0;
  const acts = replay.actions
    .filter((a) => a.committedAt.turn === turn)
    .sort((a, b) => when(a) - when(b) || a.seq - b.seq);
  for (const a of acts) {
    const plotId = a.type === 'fastTrack' && a.targetEffectId ? effectPlot.get(a.targetEffectId) : a.plotId;
    const spot = (a.type === 'eat' ? oven(map) : null) ?? (plotId ? standAt(map, plotId) : null) ?? here;
    const leave = when(a);
    // Never start before the last job ended, and never end before starting.
    const arrive = Math.min(leave, Math.max(stops.at(-1)?.leave ?? 0, leave - CONFIG.actionSeconds[a.type]));
    stops.push({ ...spot, arrive, leave });
    here = spot;
  }

  return {
    seconds: state.turnSeconds,
    poseAt(t: number): GhostPose {
      let from = { ...start, leave: 0 };
      for (const stop of stops) {
        if (t < stop.arrive) {
          // On the way: idle at the last stop, then walk at the player's pace to arrive on time.
          const dx = stop.x - from.x;
          const dy = stop.y - from.y;
          const walk = Math.hypot(dx, dy) / WALK_SPEED;
          const depart = Math.max(from.leave, stop.arrive - walk);
          if (t < depart) return { x: from.x, y: from.y, facing: from.facing, moving: false, working: false };
          const k = stop.arrive > depart ? (t - depart) / (stop.arrive - depart) : 1;
          return { x: from.x + dx * k, y: from.y + dy * k, facing: facingFor(dx, dy, from.facing), moving: true, working: false };
        }
        if (t <= stop.leave) return { x: stop.x, y: stop.y, facing: stop.facing, moving: false, working: true };
        from = stop;
      }
      return { x: from.x, y: from.y, facing: from.facing, moving: false, working: false };
    },
  };
}
