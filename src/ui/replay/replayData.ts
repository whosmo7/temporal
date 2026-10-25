// What the replay viewer (06) shows of a finished world, generation by generation: how it looked
// at the end of each one, what changed, and each plot's story. Pure, so it's tested without Pixi.

import type { Gravestone, Replay } from '../../api';
import {
  createWorld,
  visibleView,
  type ActionType,
  type GenerationScore,
  type PlotId,
  type VisibleWorld,
} from '../../engine';
import { generateMap, type TileMap } from '../../worldgen';

/** The replay's map: worldgen from the world's seed, biome and preset. */
export function replayMap(replay: Replay): TileMap {
  return generateMap(replay.seed, replay.biome, replay.preset ?? 'default');
}

/**
 * What the world looked like at the end of generation `turn` (1-based): its snapshot's visible
 * view. Turn 0 is the founder world, before anyone lived there.
 */
export function viewAt(replay: Replay, turn: number): VisibleWorld {
  if (turn <= 0) {
    const founder = createWorld(replay.seed, {
      worldId: replay.worldId,
      biome: replay.biome,
      preset: replay.preset ?? 'default',
      generationCount: replay.snapshots[0]?.generationCount,
    }).state;
    return visibleView(founder, 0);
  }
  const state = replay.snapshots[turn - 1];
  if (!state) throw new Error(`No snapshot for generation ${turn}`);
  return visibleView(state, 0);
}

/** Field and orchard tiles and whole plots whose visible stage changed in generation `turn`. */
export function changedPlots(replay: Replay, turn: number): PlotId[] {
  const before = viewAt(replay, turn - 1).plots;
  const after = viewAt(replay, turn).plots;
  return Object.keys(after).filter((id) => after[id]?.stage !== before[id]?.stage);
}

/** Who played generation `turn`: the author of its journal page. */
export function playerOf(replay: Replay, turn: number): string {
  return replay.journal.find((p) => p.turn === turn)?.authorUsername ?? `Generation ${turn}`;
}

/** The graveyard at the end of generation `turn`: one stone per generation so far. */
export function stonesAt(replay: Replay, turn: number): Gravestone[] {
  return replay.journal.filter((p) => p.turn <= turn).map((p) => ({ turn: p.turn, username: p.authorUsername }));
}

export interface PlotGeneration {
  turn: number;
  /** The visible stage at the end of that generation ('' for plots with none, like the lectern). */
  stage: string;
  /** What that generation's player did to it, in order. Hurrying it counts. */
  acts: { actor: string; type: ActionType }[];
}

/** One plot's or tile's story, generation by generation. */
export function plotHistory(replay: Replay, plotId: PlotId): PlotGeneration[] {
  // Fast Track names an effect, not a plot: find the plot through the effect's id.
  const effectPlot = new Map<string, PlotId | undefined>();
  for (const state of replay.snapshots) for (const e of state.pending) effectPlot.set(e.id, e.plotId);
  const onPlot = (a: Replay['actions'][number]) =>
    a.plotId === plotId || (a.type === 'fastTrack' && !!a.targetEffectId && effectPlot.get(a.targetEffectId) === plotId);

  return replay.snapshots.map((_, i) => {
    const turn = i + 1;
    const acts = replay.actions
      .filter((a) => a.committedAt.turn === turn && onPlot(a))
      .sort((a, b) => a.seq - b.seq)
      .map((a) => ({ actor: playerOf(replay, turn), type: a.type }));
    return { turn, stage: viewAt(replay, turn).plots[plotId]?.stage ?? '', acts };
  });
}

export interface Standing extends GenerationScore {
  name: string;
  /** 1 for the highest total; generations with the same total share a place. */
  place: number;
}

/**
 * Each generation's locked score (decision 033), highest first, named by who played it. Scores were
 * locked as each generation ended, so they come from the last snapshot. Empty for worlds finished
 * before scoring existed.
 */
export function standings(replay: Replay): Standing[] {
  const scores = replay.snapshots.at(-1)?.scores ?? [];
  const sorted = scores
    .map((s) => ({ ...s, name: playerOf(replay, s.turn), place: 0 }))
    .sort((a, b) => b.total - a.total || a.turn - b.turn);
  sorted.forEach((s, i) => (s.place = i > 0 && s.total === sorted[i - 1]!.total ? sorted[i - 1]!.place : i + 1));
  return sorted;
}
