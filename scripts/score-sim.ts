// Competitive scoring runs (decision 039). Two tables per biome:
//   1. Everyone plays one strategy: each generation's locked score and the world it handed over.
//   2. One player deviates: a planter world where generation k plays strategy X instead. Shows
//      X's own score against the planter it replaced, and what it did to everyone after it.
//
//   npx tsx scripts/score-sim.ts [--seed 1] [--gens 6] [--biome forest] [--base planter]

import type { Biome, GenerationScore } from '../src/engine';
import { runLineup, STRATEGIES } from './strategies';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seed = Number(arg('seed') ?? 1);
const gens = Number(arg('gens') ?? 6);
const biomes: Biome[] = arg('biome') ? [arg('biome') as Biome] : ['forest', 'island'];
const base = STRATEGIES[arg('base') ?? 'planter']!;
const names = Object.keys(STRATEGIES);

function scores(lineup: string[], biome: Biome): GenerationScore[] {
  const rows = runLineup(lineup.map((n) => STRATEGIES[n]!), { seed, biome, gens });
  return rows.at(-1)!.end.scores ?? [];
}

const pad = (s: string | number, w = 7) => String(s).padStart(w);

for (const biome of biomes) {
  console.log(`\n== ${biome} · seed ${seed} · ${gens} gens ==`);
  console.log('\nEveryone plays one strategy: total (condition) per generation, then the sum');
  console.log(pad('', 12) + Array.from({ length: gens }, (_, i) => pad(`g${i + 1}`, 13)).join('') + pad('sum', 8));
  for (const name of names) {
    const s = scores(Array(gens).fill(name), biome);
    const cells = s.map((g) => pad(`${g.total.toFixed(1)} (${Math.round(g.condition)})`, 13));
    console.log(name.padEnd(12) + cells.join('') + pad(s.reduce((a, g) => a + g.total, 0).toFixed(1), 8));
  }

  console.log(`\nOne player deviates in a ${base.name} world: own score − the ${base.name} it replaced [later players' change]`);
  console.log(pad('', 12) + Array.from({ length: gens }, (_, i) => pad(`g${i + 1}`, 16)).join(''));
  const baseline = scores(Array(gens).fill(base.name), biome);
  for (const name of names) {
    if (name === base.name) continue;
    const cells = baseline.map((_, k) => {
      const lineup = Array(gens).fill(base.name);
      lineup[k] = name;
      const s = scores(lineup, biome);
      const own = s[k]!.total - baseline[k]!.total;
      const later = s.slice(k + 1).reduce((a, g, i) => a + g.total - baseline[k + 1 + i]!.total, 0);
      return pad(`${own >= 0 ? '+' : ''}${own.toFixed(1)} [${later >= 0 ? '+' : ''}${later.toFixed(0)}]`, 16);
    });
    console.log(name.padEnd(12) + cells.join(''));
  }
}
