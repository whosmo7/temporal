// Runs a world with one simulated player per generation (scripts/simulate-llm.ts and the admin
// panel's llm-simulate Edge Function, decision 040). The DecisionMaker only picks a candidate id;
// applyAction, tick, beginTurn and endTurn decide everything, so no game rule lives here. Each
// action takes CONFIG.actionSeconds and lands when it finishes (decision 019); the clock only moves
// forward and nothing lands after nightfall.

import {
  applyAction,
  beginTurn,
  createWorld,
  endTurn,
  tick,
  visibleView,
  type ActionEntry,
  type Biome,
  type TurnSummary,
  type WorldState,
} from '../../src/engine';
import { candidates, doneLabel, newMemory, observe } from './observe';
import {
  QuotaError,
  type Candidate,
  type Decision,
  type DecisionMaker,
  type GenerationResult,
  type Persona,
  type SimJournalPage,
  type TurnEnd,
  type TurnLimits,
  type Usage,
} from './types';

export const DEFAULT_LIMITS: TurnLimits = {
  calls: 40,
  actions: 120,
  invalidInARow: 3,
  waits: 12,
  waitSeconds: 10,
  maxRepeat: 8,
};

type Trace = (event: Record<string, unknown>) => void;

export interface LlmRunOptions {
  seed: number;
  biome: Biome;
  gens: number;
  personas: Persona[];
  /** Model calls for the whole run, journals included. */
  maxCalls: number;
  limits?: TurnLimits;
  /** Ask each player for a journal page at the end of their day. */
  journal?: boolean;
  /** Receives every trace event as it happens, so an interrupted run keeps what it did. */
  trace?: Trace;
}

export interface LlmRunResult {
  generations: GenerationResult[];
  /** Every accepted action, in order: replay(seed, opts, log) rebuilds the final state. */
  log: ActionEntry[];
  finalState: WorldState;
  calls: number;
  usage: Usage;
  /** Why the run ended before its last generation, if it did. */
  stopped?: string;
}

/** World options shared by the run and its replay check. */
export const worldOptions = (o: Pick<LlmRunOptions, 'biome' | 'gens'>) => ({ worldId: 'llm-sim', biome: o.biome, generationCount: o.gens });

/** The world before generation 1. */
export const startingState = (o: Pick<LlmRunOptions, 'seed' | 'biome' | 'gens'>) => createWorld(o.seed, worldOptions(o)).state;

export interface GenerationInput {
  /** The world as the previous generation left it (or `startingState` for generation 1). */
  state: WorldState;
  generation: number;
  generations: number;
  persona: Persona;
  /** Journal pages left so far. */
  journal: SimJournalPage[];
  /** Model calls this generation may use, journal included. */
  callsLeft: number;
  limits?: TurnLimits;
  journalPage?: boolean;
  trace?: Trace;
  /** Stop choosing when `now()` passes this (a server function's time limit). Ends the turn as 'deadline'. */
  deadline?: { at: number; now: () => number };
}

export interface GenerationStep {
  result: GenerationResult;
  /** This generation's accepted actions. */
  log: ActionEntry[];
  /** The world after its night. */
  state: WorldState;
  journalPage?: SimJournalPage;
  /** Set when a quota error stopped it: the run should stop. */
  stopped?: string;
}

/** Plays one generation: begin, choices until an end, the night, then an optional journal page. */
export async function playGeneration(maker: DecisionMaker, input: GenerationInput): Promise<GenerationStep> {
  const limits = input.limits ?? DEFAULT_LIMITS;
  const trace = input.trace ?? (() => {});
  const gen = input.generation;
  const persona = input.persona;
  const actorId = `p${gen}`;
  const you = `Player ${gen}`;
  const names = Object.fromEntries(Array.from({ length: gen }, (_, i) => [`p${i + 1}`, `Player ${i + 1}`]));
  let state = beginTurn(input.state).state;
  const memory = newMemory({
    generation: gen,
    generations: input.generations,
    you,
    names,
    graveyard: Object.values(names).filter((n) => n !== you),
    journal: [...input.journal],
  });
  trace({ type: 'turnStart', generation: gen, persona: persona.id, player: you });

  const log: ActionEntry[] = [];
  const usage: Usage = {};
  let calls = 0;
  let actions = 0;
  let rejections = 0;
  let invalidInARow = 0;
  let waits = 0;
  let seq = 0;
  let t = 0;
  let lastRejection: string | undefined;
  let end: TurnEnd | undefined;
  let stopped: string | undefined;

  const reject = (decision: Decision, why: string) => {
    decision.rejection = why;
    lastRejection = why;
    rejections++;
    invalidInARow++;
  };

  while (!end) {
    if (t >= state.turnSeconds) end = 'time';
    else if (calls >= input.callsLeft) end = 'budget';
    else if (calls >= limits.calls) end = 'calls';
    else if (actions >= limits.actions) end = 'actions';
    else if (invalidInARow >= limits.invalidInARow) end = 'invalid';
    else if (input.deadline && input.deadline.now() >= input.deadline.at) end = 'deadline';
    if (end) break;

    const view = visibleView(state, t);
    const offered = candidates(view, t, state.turnSeconds, memory);
    const shown = offered.map(({ id, label, seconds }) => ({ id, label, seconds }));
    const observation = observe(view, t, state.turnSeconds, memory);
    const decision: Decision = { generation: gen, t, observation, candidates: shown, accepted: [] };

    try {
      calls++;
      const request = { persona, observation, candidates: shown, ...(lastRejection ? { lastRejection } : {}) };
      decision.response = await maker.choose(request);
      addUsage(usage, decision.response.usage);
    } catch (e) {
      if (!(e instanceof QuotaError)) throw e;
      stopped = e.message;
      end = 'quota';
      trace({ type: 'decision', ...decision, rejection: 'quota' });
      break;
    }
    lastRejection = undefined;

    // Only an id on the list counts. Anything else is recorded and nothing happens.
    const picked = offered.find((c) => c.id === decision.response!.choice);
    if (!picked) {
      reject(decision, `"${decision.response.choice}" is not one of the choices`);
    } else if (picked.kind === 'finish') {
      end = 'finished';
      invalidInARow = 0;
    } else if (picked.kind === 'wait') {
      if (waits >= limits.waits) {
        reject(decision, 'you have already waited a lot today; choose something else or call it a day');
      } else {
        waits++;
        invalidInARow = 0;
        t = Math.min(state.turnSeconds, t + limits.waitSeconds);
        state = tick(state, t).state;
      }
    } else {
      // Repeats re-find the same choice by key each time, so each one is offered again before it happens.
      const times = Math.max(1, Math.min(limits.maxRepeat, Math.floor(decision.response.repeat ?? 1)));
      let current: Candidate | undefined = picked;
      for (let i = 0; i < times && current; i++) {
        if (actions >= limits.actions) break;
        const landsAt = t + current.seconds;
        if (landsAt > state.turnSeconds + 1e-9) {
          if (i === 0) reject(decision, 'there is not enough daylight left for that');
          break;
        }
        const result = applyAction(state, { id: `${gen}-${seq}`, actorId, seq, ...current.input! }, landsAt);
        if (result.error || !result.entry) {
          if (i === 0) reject(decision, result.error ?? 'that did not work');
          memory.refused.add(current.key); // the player learned it won't work today
          break;
        }
        state = result.state;
        log.push(result.entry);
        seq++;
        actions++;
        invalidInARow = 0;
        t = landsAt;
        memory.done.push(doneLabel(current));
        if (current.input!.type === 'maintain' && current.input!.plotId && !current.key.startsWith('clear')) memory.tended.add(current.input!.plotId);
        decision.accepted.push({ id: result.entry.id, type: result.entry.type, ...(result.entry.plotId ? { plotId: result.entry.plotId } : {}), at: landsAt });
        if (i + 1 < times) {
          const key: string = current.key;
          current = candidates(visibleView(state, t), t, state.turnSeconds, memory).find((c) => c.key === key);
        }
      }
    }
    trace({ type: 'decision', ...decision });
  }

  const ended = endTurn(state);
  state = ended.state;
  const result: GenerationResult = {
    generation: gen,
    persona: persona.id,
    player: you,
    calls,
    actions,
    rejections,
    end: end ?? 'time',
    summary: ended.summary,
    usage,
    state,
  };

  // A journal page from what this player did and what the day cost, if the budget allows.
  let journalPage: SimJournalPage | undefined;
  if (input.journalPage !== false && maker.journal && !stopped && calls < input.callsLeft) {
    try {
      calls++;
      result.calls++;
      const page = await maker.journal({
        persona,
        you,
        generation: gen,
        generations: input.generations,
        doneToday: observe(visibleView(state, 0), 0, state.turnSeconds, memory).doneToday,
        summary: summaryWords(ended.summary),
        journal: [...input.journal],
      });
      addUsage(usage, page.usage);
      if (page.entry.trim()) {
        result.journal = page.entry.trim();
        journalPage = { generation: gen, author: you, text: result.journal, simulated: true };
        trace({ type: 'journal', generation: gen, author: you, entry: result.journal, simulated: true, usage: page.usage });
      }
    } catch (e) {
      if (!(e instanceof QuotaError)) throw e;
      stopped = e.message;
    }
  }

  trace({
    type: 'turnEnd',
    generation: gen,
    persona: persona.id,
    end: result.end,
    calls: result.calls,
    actions,
    rejections,
    usage,
    summary: ended.summary,
    score: state.scores?.at(-1) ?? null,
  });
  return { result, log, state, ...(journalPage ? { journalPage } : {}), ...(stopped ? { stopped } : {}) };
}

/** Plays every generation in turn, within the run's call budget. */
export async function runLlmGame(maker: DecisionMaker, opts: LlmRunOptions): Promise<LlmRunResult> {
  let state = startingState(opts);
  const log: ActionEntry[] = [];
  const generations: GenerationResult[] = [];
  const journal: SimJournalPage[] = [];
  const usage: Usage = {};
  let calls = 0;
  let stopped: string | undefined;

  for (let gen = 1; gen <= opts.gens; gen++) {
    if (calls >= opts.maxCalls) {
      stopped = `model call budget (${opts.maxCalls}) used up before generation ${gen}`;
      break;
    }
    const step = await playGeneration(maker, {
      state,
      generation: gen,
      generations: opts.gens,
      persona: opts.personas[gen - 1] ?? opts.personas[0]!,
      journal,
      callsLeft: opts.maxCalls - calls,
      ...(opts.limits ? { limits: opts.limits } : {}),
      journalPage: opts.journal !== false,
      ...(opts.trace ? { trace: opts.trace } : {}),
    });
    state = step.state;
    log.push(...step.log);
    generations.push(step.result);
    if (step.journalPage) journal.push(step.journalPage);
    calls += step.result.calls;
    addUsage(usage, step.result.usage);
    if (step.result.end === 'budget') stopped = `model call budget (${opts.maxCalls}) used up in generation ${gen}`;
    if (step.stopped) {
      stopped = step.stopped;
      break;
    }
  }

  if (!stopped && generations.length < opts.gens) stopped = 'stopped early';
  return { generations, log, finalState: state, calls, usage, ...(stopped ? { stopped } : {}) };
}

/** The realised cost summary in words: what was paid and gained today, nothing still to come. */
export function summaryWords(s: TurnSummary): string[] {
  const out = [`You gathered ${s.gained.food} food and ${s.gained.water} water, and used ${s.spent.water} water.`];
  if (s.foodEaten) out.push(`You ate ${s.foodEaten} food.`);
  if (s.cropsRotted) out.push(`${s.cropsRotted} tiles of crops rotted in the ground.`);
  out.push(
    s.upkeep.met
      ? `The night took its ${s.upkeep.food.required} food.`
      : `The night wanted ${s.upkeep.food.required} food and found ${s.upkeep.food.paid}.`,
  );
  return out;
}

export function addUsage(into: Usage, add: Usage | undefined): void {
  if (!add) return;
  for (const k of ['promptTokens', 'outputTokens', 'totalTokens'] as const) {
    if (add[k] !== undefined) into[k] = (into[k] ?? 0) + add[k]!;
  }
}
