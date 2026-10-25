// The land's condition for the HUD and the cost summary (13, decision 023): world health as a 0..1
// fraction for a bar (never a number on screen) and the level as its name.
// Until A adds `health` and `level` to the engine's state and view, `landOf` returns null and
// nothing is shown.

import { LEVEL_NAMES } from './copy';

export interface Land {
  /** 0..1, for the bar's width only. */
  health: number;
  level: number;
  name: string;
}

export const HEALTH_MAX = 100;

/** Reads `health` and `level` from a view or world state, if the engine provides them yet. */
export function landOf(source: object | null | undefined): Land | null {
  if (!source || !('health' in source) || !('level' in source)) return null;
  const { health, level } = source as { health: unknown; level: unknown };
  if (typeof health !== 'number' || typeof level !== 'number') return null;
  return { health: Math.max(0, Math.min(1, health / HEALTH_MAX)), level, name: levelName(level) };
}

/** The land's name for a level. Levels past the last name keep the last one. */
export function levelName(level: number): string {
  const i = Math.max(0, Math.min(LEVEL_NAMES.length - 1, Math.floor(level)));
  return LEVEL_NAMES[i];
}
