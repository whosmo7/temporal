// What the toolbar shows (13): which tool is held, the seed count and how full the can is.
// The held tool lives in B's store. The can's pours are the `can` resource (decision 027), out of
// `canCapacity`; the seed count joins once A adds a `seeds` resource (022). Until then `seeds` is
// null and the toolbar shows no count.

import { CONFIG } from '../../engine';
import type { Tool } from './copy';

export interface CanFill {
  pours: number;
  capacity: number;
}

export interface ToolbarData {
  seeds: number | null;
  can: CanFill | null;
}

/** Reads the seed count and the can's pours from a view's resources, if the engine has them. */
export function toolbarOf(
  view: { resources?: object } | null | undefined,
  capacity: number = CONFIG.canCapacity,
): ToolbarData {
  const r = (view?.resources ?? {}) as Record<string, unknown>;
  const seeds = typeof r.seeds === 'number' ? r.seeds : null;
  const can = typeof r.can === 'number' ? { pours: r.can, capacity } : null;
  return { seeds, can };
}

/** One pip per pour the can holds, filled for each pour left. */
export function canPips(can: CanFill): boolean[] {
  const capacity = Math.max(0, Math.floor(can.capacity));
  const pours = Math.max(0, Math.min(capacity, Math.floor(can.pours)));
  return Array.from({ length: capacity }, (_, i) => i < pours);
}

/** What a screen reader hears for a tool slot. */
export function toolAria(tool: Tool, data: ToolbarData): string {
  if (tool === 'seeds') return data.seeds === null ? 'Seeds' : `Seeds, ${data.seeds}`;
  if (tool === 'can')
    return data.can
      ? `Can, ${Math.min(data.can.pours, data.can.capacity)} of ${data.can.capacity}`
      : 'Can';
  return 'Hands';
}
