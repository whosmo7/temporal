import type { WorldgenPreset } from './options';

/**
 * Named map presets. Each one overrides any subset of `WorldgenOptions` on top of the biome
 * defaults, so `{}` means "standard map". To make one, add an entry here and preview it with
 * `npm run worldgen -- --preset <name> --seed 123 --biome island`.
 *
 * Pin plots by top-left tile when a layout must be exact (e.g. the demo world):
 *   pin: { reservoir: { x: 20, y: 9 }, 'orchard-1': { x: 8, y: 8 } }
 */
export const PRESETS = {
  default: {},
  /** Tight map, one field: short walks, sharper choices. */
  small: { width: 24, height: 24, fields: 1, cornerRadius: 4 },
  /** Roomier map with three fields. */
  large: { width: 40, height: 40, fields: 3 },
  /** Landscape map that fits a 16:9 screen better. */
  wide: { width: 44, height: 28 },
  /** No ponds or decoration: the plain layout, useful when checking plot placement. */
  bare: { pondCoverage: 0, decoDensity: 0, dirtLevel: 1 },
} satisfies Record<string, WorldgenPreset>;

export type PresetName = keyof typeof PRESETS;

export function isPresetName(name: string): name is PresetName {
  return Object.hasOwn(PRESETS, name);
}
