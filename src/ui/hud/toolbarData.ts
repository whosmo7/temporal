// What the toolbar shows (13): which tool is held, the seed count and how full the can is.
// The held tool lives in B's store; the seed count and the can come from the engine's view once
// A adds them (`seeds` resource, `can` state). Until then `toolbarOf` returns nulls and the
// toolbar shows the tools without counts.

import type { Tool } from './copy';

export interface CanFill {
  pours: number;
  capacity: number;
}

export interface ToolbarData {
  seeds: number | null;
  can: CanFill | null;
}

/** Reads the seed count and the can from a view, if the engine provides them yet. */
export function toolbarOf(view: object | null | undefined): ToolbarData {
  if (!view) return { seeds: null, can: null };
  const v = view as { resources?: Record<string, unknown>; can?: unknown };
  const seeds = typeof v.resources?.seeds === 'number' ? v.resources.seeds : null;
  const c = v.can as { pours?: unknown; capacity?: unknown } | undefined;
  const can =
    c && typeof c.pours === 'number' && typeof c.capacity === 'number'
      ? { pours: c.pours, capacity: c.capacity }
      : null;
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
