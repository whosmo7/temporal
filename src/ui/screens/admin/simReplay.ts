// Watching a simulated run (decision 040) in the replay viewer. A run is a seed and an accepted
// action log, so the engine's replay() rebuilds every generation's snapshots, changes and actions
// exactly. Works for a run the admin panel just made and for a trace file (admin download or
// `npm run simulate:llm`). Held in memory only: nothing is saved anywhere.

import type { ActionEntry, JournalPage, Replay } from '../../../api/Backend';
import { replay, type Biome } from '../../../engine';
import { worldName } from '../../../worldgen/names';

export interface SimRun {
  seed: number;
  biome: Biome;
  gens: number;
  log: ActionEntry[];
  /** Generations actually played (a run may stop early). */
  played: number;
  /** Persona id per generation, from 1. */
  personas: string[];
  pages: { generation: number; text: string }[];
}

/** Same world options as scripts/llm/play.ts › worldOptions, so the replay matches the run. */
const SIM_WORLD_ID = 'llm-sim';

export function replayOfSim(run: SimRun): Replay {
  const rebuilt = replay(run.seed, { worldId: SIM_WORLD_ID, biome: run.biome, generationCount: run.gens, turns: run.played }, run.log);
  const author = (gen: number) => `Player ${gen}${run.personas[gen - 1] ? ` (${run.personas[gen - 1]})` : ''}`;
  const journal: JournalPage[] = Array.from({ length: run.played }, (_, i) => ({
    turn: i + 1,
    authorUsername: author(i + 1),
    text: run.pages.find((p) => p.generation === i + 1)?.text ?? '',
    drawing: [],
  }));
  return {
    worldId: SIM_WORLD_ID,
    name: `Simulated · ${worldName(run.seed, run.biome)}`,
    seed: run.seed,
    biome: run.biome,
    snapshots: rebuilt.snapshots.map((s) => s.state),
    actions: rebuilt.snapshots.flatMap((s) => s.actions),
    transitions: rebuilt.snapshots.flatMap((s) => s.transitions),
    journal,
  };
}

/** Reads a simulator trace (JSONL). Throws a readable error when it can't be watched. */
export function simRunFromTrace(text: string): SimRun {
  const events = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        throw new Error(`Line ${i + 1} isn't JSON. Is this a simulator trace?`);
      }
    });
  const run = events.find((e) => e.type === 'run');
  const final = events.find((e) => e.type === 'final');
  if (!run || run.simulated !== true) throw new Error("This isn't a simulator trace (no simulated run line).");
  if (!final || !Array.isArray(final.log)) throw new Error('This trace has no final line, so the run was interrupted before it finished writing.');
  const seed = Number(run.seed);
  const gens = Number(run.gens);
  const biome = run.biome;
  if (!Number.isFinite(seed) || !(gens >= 1) || (biome !== 'forest' && biome !== 'island')) throw new Error('The trace is missing its seed, biome or generation count.');

  const ends = events.filter((e) => e.type === 'turnEnd').map((e) => Number(e.generation));
  const personas: string[] = [];
  for (const p of Array.isArray(run.personas) ? (run.personas as { generation?: number; id?: string }[]) : []) {
    if (p.generation && p.id) personas[p.generation - 1] = p.id;
  }
  return {
    seed,
    biome,
    gens,
    log: final.log as ActionEntry[],
    played: ends.length ? Math.max(...ends) : 0,
    personas,
    pages: events
      .filter((e) => e.type === 'journal' && typeof e.entry === 'string')
      .map((e) => ({ generation: Number(e.generation), text: String(e.entry) })),
  };
}

// The run being watched, for the /admin/simulation route. In memory: a refresh clears it.
let watching: Replay | null = null;
export const setWatching = (r: Replay | null) => void (watching = r);
export const getWatching = () => watching;
