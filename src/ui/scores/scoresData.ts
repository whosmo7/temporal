// The scores page (decision 039): every locked generation score from finished worlds, named by who
// played it. Only finished worlds are listed, so nothing about a world still being played shows.

import type { CompletedWorld } from '../../api';
import type { GenerationScore } from '../../engine';

export interface ScoreRow extends GenerationScore {
  worldId: string;
  worldName: string;
  username: string;
}

/** One row per scored generation. `players` is in generation order, so turn n was players[n - 1]. */
export function scoreRows(worlds: CompletedWorld[]): ScoreRow[] {
  return worlds.flatMap((w) =>
    (w.finalState?.scores ?? []).map((s) => ({
      ...s,
      worldId: w.worldId,
      worldName: w.name,
      username: w.players[s.turn - 1] ?? `Generation ${s.turn}`,
    })),
  );
}

/** Highest total first; ties keep the earlier generation first. */
export function byTotal(rows: ScoreRow[]): ScoreRow[] {
  return [...rows].sort((a, b) => b.total - a.total || a.turn - b.turn || a.worldName.localeCompare(b.worldName));
}

/** A player's own generations, highest first. */
export function rowsOf(rows: ScoreRow[], username: string): ScoreRow[] {
  return byTotal(rows.filter((r) => r.username === username));
}
