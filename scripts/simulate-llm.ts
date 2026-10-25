// LLM playthrough simulator (dev tool). Gemini plays one generation after another in the same world;
// the engine decides every outcome. Separate from scripts/simulate.ts, the browser game and Supabase.
//
//   GEMINI_API_KEY=... npm run simulate:llm -- --seed 1 --gens 6 --biome forest --persona pragmatic
//
// Flags: --seed (1) --gens (2) --biome (forest|island) --persona (comma list; the rest follow)
//        --model (gemini-3.5-flash-lite) --max-calls (60) --out (.sim/llm-….jsonl) --no-journal
//
// Docs: docs/llm-simulator.md. The key is read from this process's environment, or from .env.local
// if it isn't set. Never give it a VITE_ prefix: those end up in the public website. The trace is a
// local developer artifact of simulated players; don't upload it or present it as a real game.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Biome } from '../src/engine';
import { GeminiDecisionMaker } from './llm/gemini';
import { personasFor } from './llm/personas';
import { DEFAULT_LIMITS, runLlmGame, worldOptions, type LlmRunResult } from './llm/play';
import { PROMPT_VERSION } from './llm/prompt';
import { report } from './llm/report';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: the environment alone has to carry the key.
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set. Set it in this shell (export GEMINI_API_KEY=...) or add a GEMINI_API_KEY= line to .env.local.');
  process.exit(1);
}

const seed = Number(arg('seed') ?? 1);
const gens = Number(arg('gens') ?? 2);
const biome = (arg('biome') ?? 'forest') as Biome;
const model = arg('model') ?? 'gemini-3.5-flash-lite';
const maxCalls = Number(arg('max-calls') ?? 60);
const journal = !flag('no-journal');
if (!['forest', 'island'].includes(biome) || !(gens >= 1) || !(maxCalls >= 1) || !Number.isFinite(seed)) {
  console.error('Bad flags. Try: --seed 1 --gens 6 --biome forest --max-calls 60');
  process.exit(1);
}
const personas = personasFor(gens, arg('persona'));
const out = arg('out') ?? `.sim/llm-${seed}-${biome}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;

mkdirSync(dirname(out), { recursive: true });
const write = (event: Record<string, unknown>) => appendFileSync(out, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
write({
  type: 'run',
  simulated: true,
  note: 'Simulated players driven by an LLM. Not a real game.',
  model,
  promptVersion: PROMPT_VERSION,
  seed,
  biome,
  gens,
  maxCalls,
  limits: DEFAULT_LIMITS,
  personas: personas.map((p, i) => ({ generation: i + 1, id: p.id, motive: p.motive })),
});
process.on('SIGINT', () => {
  write({ type: 'interrupted' });
  console.error(`\nInterrupted. Everything so far is in ${out}`);
  process.exit(130);
});

console.log(`LLM playthrough · ${model} · ${biome} · seed ${seed} · ${gens} gens · up to ${maxCalls} calls`);
console.log(`trace → ${out}\n`);

let result: LlmRunResult;
try {
  result = await runLlmGame(new GeminiDecisionMaker(model, apiKey), {
    seed,
    biome,
    gens,
    personas,
    maxCalls,
    journal,
    trace: (event) => {
      write(event);
      if (event.type === 'turnEnd') console.log(`  generation ${String(event.generation)} done (${String(event.persona)}, ${String(event.calls)} calls)`);
    },
  });
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  write({ type: 'error', message });
  console.error(`\nStopped: ${message}\nEverything so far is in ${out}`);
  process.exit(1);
}

write({ type: 'final', worldOptions: worldOptions({ biome, gens }), seed, calls: result.calls, usage: result.usage, stopped: result.stopped ?? null, log: result.log, finalState: result.finalState });

console.log(`\n${report(result, gens).join('\n')}`);
console.log(`\ntrace: ${out}`);
