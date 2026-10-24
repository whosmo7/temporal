import type { Biome, DecoTile, PlotId, PlotKind, Point } from './types';

export interface Size {
  w: number;
  h: number;
}

/** Every knob the generator reads. Presets override any subset of these (see presets.ts). */
export interface WorldgenOptions {
  /** Map size in tiles, boundary included. */
  width: number;
  height: number;
  /** Boundary thickness in tiles, varied by noise between min and max. */
  boundaryDepth: { min: number; max: number };
  /** Rounds the corners of the farmable area, in tiles. */
  cornerRadius: number;
  /** Walkable sand between the grass and the boundary. Island uses it, Forest doesn't. */
  beachWidth: number;
  /** Number of `field` plots (`field-1` … `field-N`). */
  fields: number;
  /** Minimum free tiles between any two plots. */
  plotSpacing: number;
  plotSizes: Record<PlotKind, Size>;
  /** Share (0–0.5) of the farmable area that is pond, filled from the lowest ground up. 0 = none. */
  pondCoverage: number;
  /** Ground noise (0–1) above which grass shows as dirt. 1 = no dirt. */
  dirtLevel: number;
  /** Chance (0–1) that a free tile gets a decoration. */
  decoDensity: number;
  /** Relative weights for the decoration kinds. 0 disables a kind. */
  decoWeights: Record<DecoTile, number>;
  /** How much paths wander instead of taking the shortest route. 0 = straightest. */
  pathWiggle: number;
  /** Max distance (tiles, Chebyshev) from spawn to the lectern. */
  lecternRange: number;
  /** Tiles around spawn kept clear of ponds and decoration. */
  spawnClearance: number;
  /** Player start tile. `null` = map centre. */
  spawn: Point | null;
  /** Fix plots at a top-left tile instead of seeding them, e.g. `{ reservoir: { x: 20, y: 9 } }`. */
  pin: Record<PlotId, Point>;
  /** Placement re-rolls before giving up with a WorldgenError. */
  maxAttempts: number;
}

/** A partial `WorldgenOptions`. Nested records merge key by key. */
export type WorldgenPreset = Partial<
  Omit<WorldgenOptions, 'boundaryDepth' | 'plotSizes' | 'decoWeights' | 'pin'>
> & {
  boundaryDepth?: Partial<WorldgenOptions['boundaryDepth']>;
  plotSizes?: Partial<Record<PlotKind, Size>>;
  decoWeights?: Partial<Record<DecoTile, number>>;
  pin?: Record<PlotId, Point>;
};

export const BASE_OPTIONS: WorldgenOptions = {
  width: 32,
  height: 32,
  boundaryDepth: { min: 2, max: 3 },
  cornerRadius: 6,
  beachWidth: 0,
  fields: 2,
  plotSpacing: 1,
  plotSizes: {
    field: { w: 3, h: 3 },
    orchard: { w: 3, h: 3 },
    reservoir: { w: 3, h: 3 },
    well: { w: 2, h: 2 },
    wild: { w: 2, h: 2 },
    lectern: { w: 1, h: 1 },
    graveyard: { w: 4, h: 3 },
  },
  pondCoverage: 0.06,
  dirtLevel: 0.68,
  decoDensity: 0.07,
  decoWeights: { rock: 1, bush: 2, flower: 3 },
  pathWiggle: 1.5,
  lecternRange: 4,
  spawnClearance: 2,
  spawn: null,
  pin: {},
  maxAttempts: 50,
};

/** Biome look. Applied on top of BASE_OPTIONS and under any preset. */
export const BIOME_DEFAULTS: Record<Biome, WorldgenPreset> = {
  forest: {},
  island: {
    boundaryDepth: { min: 3, max: 6 },
    cornerRadius: 10,
    beachWidth: 2,
    pondCoverage: 0.03,
    decoWeights: { rock: 2, bush: 1, flower: 1 },
  },
};

export function mergeOptions(base: WorldgenOptions, preset: WorldgenPreset): WorldgenOptions {
  return {
    ...base,
    ...preset,
    boundaryDepth: { ...base.boundaryDepth, ...preset.boundaryDepth },
    plotSizes: { ...base.plotSizes, ...preset.plotSizes },
    decoWeights: { ...base.decoWeights, ...preset.decoWeights },
    pin: { ...base.pin, ...preset.pin },
  };
}

export function resolveOptions(biome: Biome, preset: WorldgenPreset = {}): WorldgenOptions {
  const opts = mergeOptions(mergeOptions(BASE_OPTIONS, BIOME_DEFAULTS[biome]), preset);
  validateOptions(opts);
  return opts;
}

/** Plot IDs and kinds this config generates, in canonical order (ids.md). */
export function plotSlots(opts: WorldgenOptions): { id: PlotId; kind: PlotKind }[] {
  return [
    ...Array.from({ length: opts.fields }, (_, i) => ({ id: `field-${i + 1}`, kind: 'field' as const })),
    { id: 'orchard-1', kind: 'orchard' },
    { id: 'reservoir', kind: 'reservoir' },
    { id: 'well', kind: 'well' },
    { id: 'wild', kind: 'wild' },
    { id: 'lectern', kind: 'lectern' },
    { id: 'graveyard', kind: 'graveyard' },
  ];
}

export class WorldgenError extends Error {
  override name = 'WorldgenError';
}

function validateOptions(o: WorldgenOptions): void {
  const fail = (msg: string) => {
    throw new WorldgenError(`Invalid worldgen options: ${msg}`);
  };
  const int = (v: number, min: number, max: number, name: string) => {
    if (!Number.isInteger(v) || v < min || v > max) fail(`${name} must be an integer in [${min}, ${max}], got ${v}`);
  };
  int(o.width, 16, 128, 'width');
  int(o.height, 16, 128, 'height');
  int(o.boundaryDepth.min, 1, 16, 'boundaryDepth.min');
  int(o.boundaryDepth.max, o.boundaryDepth.min, 16, 'boundaryDepth.max');
  int(o.cornerRadius, 0, 64, 'cornerRadius');
  int(o.beachWidth, 0, 8, 'beachWidth');
  int(o.fields, 1, 9, 'fields');
  int(o.plotSpacing, 0, 8, 'plotSpacing');
  int(o.lecternRange, 1, 64, 'lecternRange');
  int(o.spawnClearance, 0, 8, 'spawnClearance');
  int(o.maxAttempts, 1, 1000, 'maxAttempts');
  for (const [kind, s] of Object.entries(o.plotSizes)) {
    int(s.w, 1, 16, `plotSizes.${kind}.w`);
    int(s.h, 1, 16, `plotSizes.${kind}.h`);
  }
  for (const [name, v] of [
    ['dirtLevel', o.dirtLevel],
    ['decoDensity', o.decoDensity],
  ] as const) {
    if (!(v >= 0 && v <= 1)) fail(`${name} must be in [0, 1], got ${v}`);
  }
  if (!(o.pondCoverage >= 0 && o.pondCoverage <= 0.5)) fail(`pondCoverage must be in [0, 0.5], got ${o.pondCoverage}`);
  if (!(o.pathWiggle >= 0)) fail(`pathWiggle must be >= 0, got ${o.pathWiggle}`);
  if (Object.values(o.decoWeights).some((w) => !(w >= 0))) fail('decoWeights must be >= 0');
  if (o.spawn) {
    int(o.spawn.x, 0, o.width - 1, 'spawn.x');
    int(o.spawn.y, 0, o.height - 1, 'spawn.y');
  }
  const ids = new Set(plotSlots(o).map((s) => s.id));
  for (const [id, p] of Object.entries(o.pin)) {
    if (!ids.has(id)) fail(`pin.${id} is not a plot in this map (have: ${[...ids].join(', ')})`);
    int(p.x, 0, o.width - 1, `pin.${id}.x`);
    int(p.y, 0, o.height - 1, `pin.${id}.y`);
  }
}
