// Balance runs (02 › simulate.ts, inheritance-balance). Plays N generations with scripted
// strategies and prints one table per strategy and biome. Keep the column layout stable: C reads it.
//
//   npx tsx scripts/simulate.ts [--seed 1] [--gens 6] [--strategy planter] [--biome forest]

import type { Biome } from '../src/engine';
import { runStrategy, STRATEGIES, type GenRow } from './strategies';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seed = Number(arg('seed') ?? 1);
const gens = Number(arg('gens') ?? 6);
const strategyNames = arg('strategy') ? [arg('strategy')!] : Object.keys(STRATEGIES);
const biomes: Biome[] = arg('biome') ? [arg('biome') as Biome] : ['forest', 'island'];

const COLUMNS = [
  'gen',
  'stam',
  'food',
  'water',
  'upkeep',
  'weak',
  'reservoir',
  'well',
  'orchard',
  'wild',
];

function row(r: GenRow): string[] {
  const p = r.end.plots;
  const u = r.summary.upkeep;
  return [
    String(r.gen),
    String(r.start.stamina),
    String(r.end.resources.food),
    String(r.end.resources.water),
    u.met ? 'met' : `short ${u.food.required - u.food.paid}f ${u.water.required - u.water.paid}w`,
    r.summary.weakenedNext.toFixed(2),
    `${p['reservoir']?.stage}/${p['reservoir']?.wear}`,
    `${p['well']?.stage}/${p['well']?.wear}`,
    `${p['orchard-1:0,0']?.stage}/${p['orchard-1:0,0']?.wear}`, // the first tree (decision 019)
    String(r.end.wildStock),
  ];
}

function table(rows: string[][]): string {
  const widths = COLUMNS.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  return [line(COLUMNS), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

for (const name of strategyNames) {
  const strategy = STRATEGIES[name];
  if (!strategy) {
    console.error(`Unknown strategy "${name}". Try: ${Object.keys(STRATEGIES).join(', ')}`);
    process.exit(1);
  }
  for (const biome of biomes) {
    const rows = runStrategy(strategy, { seed, biome, gens });
    const missed = rows.filter((r) => !r.summary.upkeep.met).map((r) => r.gen);
    console.log(`\n${name} · ${biome} · seed ${seed} · ${gens} gens`);
    console.log(`events: ${rows[0]!.end.events.map((e) => e.id).join(', ') || 'none'}`);
    console.log(table(rows.map(row)));
    console.log(`missed upkeep: ${missed.length ? `gens ${missed.join(', ')}` : 'none'}`);
  }
}
