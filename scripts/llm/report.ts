// The LLM simulator's printed result: one row per generation, then totals. Keep the columns stable.

import { tilesOf } from '../strategies/run';
import type { LlmRunResult } from './play';

const COLUMNS = ['gen', 'persona', 'food', 'water', 'upkeep', 'wild', 'reservoir', 'well', 'trees', 'fields', 'calls', 'acts', 'rej', 'end', 'score'];

export function report(result: LlmRunResult, gens: number): string[] {
  const rows = result.generations.map((g) => {
    const s = g.state;
    const u = g.summary.upkeep;
    const orchard = tilesOf(s, 'orchard-1');
    const trees = orchard.filter((p) => ['sapling', 'young', 'fruiting'].includes(p.stage ?? '')).length;
    const fieldTiles = Object.values(s.plots).filter((p) => p.kind === 'field');
    const growing = fieldTiles.filter((p) => ['sown', 'watered', 'growing', 'ripe'].includes(p.stage ?? '')).length;
    const spoiled = fieldTiles.filter((p) => ['rotten', 'withered'].includes(p.stage ?? '')).length;
    return [
      String(g.generation),
      g.persona,
      String(s.resources.food),
      String(s.resources.water),
      u.met ? 'met' : `short ${u.food.required - u.food.paid}f`,
      String(s.wildStock),
      String(s.plots['reservoir']?.stage ?? '-'),
      String(s.plots['well']?.stage ?? '-'),
      `${trees}/${orchard.length}`,
      `${growing}g ${spoiled}x`, // tiles growing or ripe, and spoiled
      String(g.calls),
      String(g.actions),
      String(g.rejections),
      g.end,
      String(s.scores?.at(-1)?.total ?? '-'),
    ];
  });
  const widths = COLUMNS.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd();

  const missed = result.generations.filter((g) => !g.summary.upkeep.met).map((g) => g.generation);
  const actions = result.generations.reduce((a, g) => a + g.actions, 0);
  const rejections = result.generations.reduce((a, g) => a + g.rejections, 0);
  const u = result.usage;
  return [
    line(COLUMNS),
    line(widths.map((w) => '-'.repeat(w))),
    ...rows.map(line),
    '',
    `generations played: ${result.generations.length}/${gens}${result.stopped ? ` (stopped: ${result.stopped})` : ''}`,
    `model calls: ${result.calls} · tokens: ${u.totalTokens ?? 'n/a'} (prompt ${u.promptTokens ?? 'n/a'}, output ${u.outputTokens ?? 'n/a'})`,
    `actions accepted: ${actions} · rejected choices: ${rejections}`,
    `missed upkeep: ${missed.length ? `gens ${missed.join(', ')}` : 'none'}`,
    ...result.generations.filter((g) => g.journal).map((g) => `journal ${g.generation} (simulated, ${g.persona}): "${g.journal}"`),
  ];
}
