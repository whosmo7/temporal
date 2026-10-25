// Balance fixtures (01 › Acceptance, inheritance-balance): the hoarder, planter and quick-fixer
// over six generations in both biomes, and the medium-world dilemma for one generation.
//
// `it.fails` marks a target the current numbers miss (01 › Balance after section 13). Each one
// passes while the gap is there and fails once the numbers fix it: then make it a plain `it`.

import { describe, expect, it } from 'vitest';
import { createWorld, type Biome, type PlotState, type WorldState } from '../../src/engine';
import {
  runStrategy,
  STRATEGIES,
  type GenRow,
  type PlannedAction,
  type Strategy,
} from '../strategies';
import { cropCycles, tilesOf } from '../strategies/run';

const GENS = 6;
const BIOMES: Biome[] = ['forest', 'island'];
const run = (name: string, biome: Biome) =>
  runStrategy(STRATEGIES[name]!, { seed: 1, biome, gens: GENS });
const missed = (rows: GenRow[]) => rows.filter((r) => !r.summary.upkeep.met).length;

/** What a successor can see standing: the reservoir full, the well clear, trees growing or fruiting. */
function standing(end: WorldState): number {
  const p = end.plots;
  const trees = tilesOf(end, 'orchard-1').filter((t) =>
    ['sapling', 'young', 'fruiting'].includes(t.stage ?? ''),
  ).length;
  return Number(p['reservoir']?.stage === 'full') + Number(p['well']?.stage === 'clear') + trees;
}

describe.each(BIOMES)('six generations, %s', (biome) => {
  const hoarder = run('hoarder', biome);
  const planter = run('planter', biome);
  const quickFixer = run('quickFixer', biome);

  it('selfish play leaves a visibly worse world than investing', () => {
    const invested = standing(planter.at(-1)!.end);
    expect(standing(hoarder.at(-1)!.end)).toBeLessThan(invested);
    expect(standing(quickFixer.at(-1)!.end)).toBeLessThan(invested);
  });

  it('quick fixes run out: the quick-fixer misses upkeep at least once', () => {
    expect(missed(quickFixer)).toBeGreaterThan(0);
  });

  // Gap: crops pay 1 food a tile with nothing limiting how many are sown, so the hoarder gains
  // about 24 food a generation and never misses upkeep. Seeds (022) should cap this.
  it.fails(
    'hoarding has a cost: the hoarder misses upkeep or ends with less food than it started',
    () => {
      const first = hoarder[0]!.start.food;
      expect(missed(hoarder) > 0 || hoarder.at(-1)!.end.resources.food < first).toBe(true);
    },
  );

  // Gap: stamina is a placeholder (0 for every action) and action times are a few seconds of a
  // 600 s day, so investing costs the planter nothing it needed. 01 wants it to cost upkeep.
  it.fails('pure investment costs something: the planter misses upkeep at least once', () => {
    expect(missed(planter)).toBeGreaterThan(0);
  });
});

// ---- Medium world (01 › Medium world): repair or comfort, not both ----

/** 01's medium world: generation 3 of 6, food 6, water 12, wild 4, reservoir cracked, well worn, saplings worn, fields empty. */
function mediumWorld(biome: Biome): WorldState {
  const s = createWorld(1, { worldId: 'medium', biome, generationCount: GENS }).state;
  const plots: Record<string, PlotState> = {};
  for (const [id, p] of Object.entries(s.plots)) {
    if (id === 'reservoir') plots[id] = { ...p, stage: 'cracked', wear: 0 };
    else if (id === 'well') plots[id] = { ...p, stage: 'clear', wear: 1 };
    else if (p.tile?.plot === 'orchard-1') plots[id] = { ...p, stage: 'sapling', wear: 1 };
    else plots[id] = p;
  }
  return { ...s, turn: 3, resources: { ...s.resources, food: 6, water: 12 }, wildStock: 4, plots };
}

const maintainAll = (s: WorldState): PlannedAction[] => [
  { type: 'maintain', plotId: 'well', t: 0 },
  ...tilesOf(s, 'orchard-1').map((t) => ({ type: 'maintain' as const, plotId: t.id, t: 0 })),
];
const repair: PlannedAction = { type: 'repairReservoir', plotId: 'reservoir', t: 0 };

const feedFirst: Strategy = {
  name: 'feedFirst',
  plan: (s) => [...maintainAll(s), ...cropCycles(s, 1).map((a) => ({ ...a, t: a.t + 1 }))],
};
const repairOnly: Strategy = { name: 'repairOnly', plan: () => [repair] };
const both: Strategy = { name: 'both', plan: (s) => [repair, ...feedFirst.plan(s)] };

/** 01's "comfortable": upkeep met, the well and every tree maintained, and at least 6 food left after the night. */
function comfortable(row: GenRow): boolean {
  const worn = Object.values(row.end.plots).some(
    (p) => (p.id === 'well' || p.tile?.plot === 'orchard-1') && p.wear > 1,
  );
  return row.summary.upkeep.met && !worn && row.end.resources.food >= 6;
}
/** The repair is done or under way (it may land in a later generation). */
const repaired = (row: GenRow) =>
  row.end.plots['reservoir']?.stage !== 'cracked' ||
  row.end.pending.some((e) => e.plotId === 'reservoir');
const oneDay = (strategy: Strategy, biome: Biome) =>
  runStrategy(strategy, { seed: 1, biome, gens: 1, from: mediumWorld(biome) })[0]!;

describe.each(BIOMES)('medium world, %s', (biome) => {
  it('feeding comfortably is reachable on its own', () => {
    expect(comfortable(oneDay(feedFirst, biome))).toBe(true);
  });

  it('repairing the reservoir is reachable on its own', () => {
    expect(repaired(oneDay(repairOnly, biome))).toBe(true);
  });

  // Gap: nothing in a day limits the two together (see above). 01 wants a choice between them.
  it.fails('repairing and feeding comfortably are not both reachable in one day', () => {
    const day = oneDay(both, biome);
    expect(repaired(day) && comfortable(day)).toBe(false);
  });
});
