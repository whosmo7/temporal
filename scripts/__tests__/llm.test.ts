// The LLM playthrough simulator with a fake DecisionMaker: no API key, no quota. Checks that the
// model only ever sees what a player could, that only listed ids act, that limits end a turn, and
// that the accepted log replays to the same world.

import { describe, expect, it } from 'vitest';
import { applyAction, beginTurn, createWorld, replay, visibleView, type Biome } from '../../src/engine';
import { candidates, newMemory, observe } from '../llm/observe';
import { PERSONAS, personasFor } from '../llm/personas';
import { SIM_PERSONAS } from '../../src/ui/screens/admin/simPersonas';
import { replayOfSim, simRunFromTrace } from '../../src/ui/screens/admin/simReplay';
import { DEFAULT_LIMITS, playGeneration, runLlmGame, startingState, worldOptions } from '../llm/play';
import { choicePrompt, journalPrompt } from '../llm/prompt';
import { report } from '../llm/report';
import { QuotaError, type ChoiceRequest, type ChoiceResponse, type DecisionMaker, type JournalRequest } from '../llm/types';

/** A DecisionMaker that answers with `pick(request)` and remembers every request it saw. */
class FakeDecisionMaker implements DecisionMaker {
  readonly model = 'fake';
  readonly seen: ChoiceRequest[] = [];
  readonly pages: JournalRequest[] = [];
  constructor(
    private readonly pick: (r: ChoiceRequest, call: number) => ChoiceResponse,
    private readonly page = (r: JournalRequest) => `${r.you} was here.`,
  ) {}
  async choose(r: ChoiceRequest): Promise<ChoiceResponse> {
    this.seen.push(structuredClone(r));
    return this.pick(r, this.seen.length);
  }
  async journal(r: JournalRequest) {
    this.pages.push(structuredClone(r));
    return { entry: this.page(r) };
  }
}

/** A plausible player: picks the first choice whose words match, in this order, else waits, then finishes. */
const PREFERENCE = [/^Harvest/, /^Pick/, /^Cook/, /^Water/, /^Fill/, /^Sow/, /^Repair/, /^Plant/, /^Dig/, /^Hunt|^Fish/, /^Clear and till/];
function sensible(r: ChoiceRequest): ChoiceResponse {
  const hungry = r.observation.hungry;
  for (const re of PREFERENCE) {
    if (re.source === '^Cook' && !hungry) continue;
    const c = r.candidates.find((c) => re.test(c.label));
    if (c) return { choice: c.id, repeat: 4, note: `private reason ${c.id}` };
  }
  const growing = Object.values(r.observation.land.fields).some((s) => s.watered || s.growing);
  return { choice: growing ? 'W1' : 'F1' };
}

const base = { seed: 3, biome: 'forest' as Biome, gens: 1, personas: personasFor(6), maxCalls: 500 };

describe('LLM simulator observations', () => {
  it('never shows the seed, events, pending effects, due dates or causes', async () => {
    const seed = 987654321;
    let state = createWorld(seed, { worldId: 'w', biome: 'island', generationCount: 6 }).state;
    expect(state.events.length).toBeGreaterThan(0);
    state = beginTurn(state).state;
    // A tree planted and a crop watered leave pending effects with due times.
    state = applyAction(state, { id: '1-0', actorId: 'p1', seq: 0, type: 'plantOrchard', plotId: 'orchard-1:0,0' }, 3).state;
    state = applyAction(state, { id: '1-1', actorId: 'p1', seq: 1, type: 'plantCrops', plotId: 'field-1:0,0' }, 5).state;
    state = applyAction(state, { id: '1-2', actorId: 'p1', seq: 2, type: 'fillCan' }, 6).state;
    state = applyAction(state, { id: '1-3', actorId: 'p1', seq: 3, type: 'water', plotId: 'field-1:0,0' }, 7).state;
    expect(state.pending.filter((e) => e.status === 'pending').length).toBe(2);

    const memory = newMemory({ generation: 1, generations: 6, you: 'Player 1', names: { p1: 'Player 1' }, graveyard: [], journal: [] });
    const view = visibleView(state, 7);
    const shown = candidates(view, 7, state.turnSeconds, memory).map(({ id, label, seconds }) => ({ id, label, seconds }));
    const request: ChoiceRequest = { persona: personasFor(1)[0]!, observation: observe(view, 7, state.turnSeconds, memory), candidates: shown };
    const { system, user } = choicePrompt(request);
    const everything = [JSON.stringify(request), system, user].join('\n');

    expect(everything).not.toContain(String(seed));
    for (const hidden of ['dueAt', 'committedAt', 'pending', 'cropRipe', 'orchardMature', 'cause', 'transition', 'wildStock', 'wear']) {
      expect(everything).not.toContain(hidden);
    }
    for (const e of state.events) {
      expect(everything).not.toContain(e.id);
      expect(everything).not.toContain(e.kind);
    }
    for (const e of state.pending) expect(everything).not.toContain(e.id);
    // The Fast Track choice is offered as the menu would: who and when, never when it's due.
    expect(user).toMatch(/Hurry the young tree Player 1 started today/);
    expect(Object.keys(shown[0]!).sort()).toEqual(['id', 'label', 'seconds']);
  });

  it('a later player sees earlier journal pages, never the earlier player’s reasoning', async () => {
    const maker = new FakeDecisionMaker(sensible, (r) => `Page from ${r.you}.`);
    await runLlmGame(maker, { ...base, gens: 2 });
    const second = maker.seen.filter((r) => r.observation.generation === 2);
    expect(second.length).toBeGreaterThan(0);
    const text = JSON.stringify(second) + second.map((r) => choicePrompt(r).user).join('\n');
    expect(text).toContain('Page from Player 1.');
    expect(text).not.toContain('private reason');
    expect(second[0]!.observation.graveyard).toEqual(['Player 1']);
    expect(journalPrompt(maker.pages[1]!).user).not.toContain('private reason');
  });
});

describe('LLM simulator choices and limits', () => {
  it('ids that are not on the list never act', async () => {
    const maker = new FakeDecisionMaker((_, call) => ({ choice: call === 1 ? 'Z9' : 'A99' }));
    const run = await runLlmGame(maker, base);
    expect(run.log).toEqual([]);
    expect(run.generations[0]).toMatchObject({ end: 'invalid', rejections: DEFAULT_LIMITS.invalidInARow, actions: 0 });
    expect(maker.seen[1]!.lastRejection).toMatch(/not one of the choices/);
  });

  it('an engine refusal is recorded and that choice leaves the list for the day', async () => {
    // Repair the reservoir, then try to repair it again: the engine refuses the second.
    const maker = new FakeDecisionMaker((r) => {
      const repair = r.candidates.find((c) => c.label.startsWith('Repair'));
      return { choice: repair?.id ?? 'F1', repeat: 2 };
    });
    const run = await runLlmGame(maker, base);
    expect(run.log.filter((a) => a.type === 'repairReservoir')).toHaveLength(1);
    expect(run.generations[0]!.end).toBe('finished');
  });

  it('the model-call limit ends a turn, and the run budget stops the run', async () => {
    const waiter = () => new FakeDecisionMaker(() => ({ choice: 'W1' }));
    const byTurn = await runLlmGame(waiter(), { ...base, limits: { ...DEFAULT_LIMITS, calls: 5, waits: 99, waitSeconds: 1 } });
    expect(byTurn.generations[0]).toMatchObject({ end: 'calls', calls: 6 }); // 5 choices + the journal

    const byRun = await runLlmGame(waiter(), { ...base, gens: 3, maxCalls: 4, limits: { ...DEFAULT_LIMITS, waits: 99, waitSeconds: 1 } });
    expect(byRun.generations).toHaveLength(1);
    expect(byRun.generations[0]!.end).toBe('budget');
    expect(byRun.stopped).toMatch(/budget/);
    expect(byRun.calls).toBe(4);
  });

  it('time ends a turn: waiting runs the clock to nightfall and nothing lands after it', async () => {
    const run = await runLlmGame(new FakeDecisionMaker(() => ({ choice: 'W1' })), { ...base, limits: { ...DEFAULT_LIMITS, waits: 99, waitSeconds: 30 } });
    expect(run.generations[0]!.end).toBe('time');
    expect(run.generations[0]!.calls).toBe(4 + 1); // 120 s / 30 s, then the journal
  });

  it('a quota error stops the run and keeps what was done', async () => {
    const maker = new FakeDecisionMaker((r, call) => {
      if (r.observation.generation === 2 && call > 0) throw new QuotaError('quota reached');
      return sensible(r);
    });
    const run = await runLlmGame(maker, { ...base, gens: 3 });
    expect(run.generations.map((g) => g.end)).toEqual([expect.not.stringMatching('quota'), 'quota']);
    expect(run.stopped).toBe('quota reached');
    expect(run.log.some((a) => a.committedAt.turn === 1)).toBe(true);
  });
});

describe('LLM simulator for the admin panel', () => {
  it('the admin panel offers the same personas, in the same order', () => {
    expect([...SIM_PERSONAS]).toEqual(PERSONAS.map((p) => p.id));
  });

  it('a generation stops choosing at its deadline, as the server function does', async () => {
    let clock = 0;
    const maker = new FakeDecisionMaker(() => {
      clock += 40;
      return { choice: 'W1' };
    });
    const step = await playGeneration(maker, {
      state: startingState(base),
      generation: 1,
      generations: 1,
      persona: personasFor(1)[0]!,
      journal: [],
      callsLeft: 40,
      limits: { ...DEFAULT_LIMITS, waits: 99, waitSeconds: 1 },
      deadline: { at: 100, now: () => clock },
    });
    expect(step.result.end).toBe('deadline');
    expect(step.result.calls).toBe(3 + 1); // three choices before the clock passes 100, then the journal
    expect(step.state.turn).toBe(2);
  });
});

describe('LLM simulator full runs', () => {
  for (const biome of ['forest', 'island'] as Biome[]) {
    it(`six generations finish in the ${biome}, with time moving forward, and the log replays to the same world`, async () => {
      const opts = { ...base, biome, gens: 6 };
      const run = await runLlmGame(new FakeDecisionMaker(sensible), opts);
      expect(run.generations).toHaveLength(6);
      expect(run.stopped).toBeUndefined();
      expect(run.finalState.turn).toBe(7);
      expect(run.log.length).toBeGreaterThan(20);
      for (let gen = 1; gen <= 6; gen++) {
        const times = run.log.filter((a) => a.committedAt.turn === gen).map((a) => a.committedAt.t ?? 0);
        expect(times).toEqual([...times].sort((a, b) => a - b));
        expect(Math.max(0, ...times)).toBeLessThanOrEqual(run.finalState.turnSeconds);
      }
      // Six distinct personas, one per generation.
      expect(new Set(run.generations.map((g) => g.persona)).size).toBe(6);

      const rebuilt = replay(opts.seed, { ...worldOptions(opts), turns: 6 }, run.log);
      expect(rebuilt.snapshots.at(-1)!.state).toEqual(run.finalState);

      const printed = report(run, 6);
      expect(printed[0]).toMatch(/^gen\s+persona\s+food\s+water\s+upkeep\s+wild/);
      expect(printed.filter((l) => /^\d\s/.test(l))).toHaveLength(6);
      expect(printed).toContain('generations played: 6/6');
    });
  }
});

describe('watching a simulated run in the replay viewer', () => {
  it('a trace file rebuilds into the same world, with each player and their page', async () => {
    const events: Record<string, unknown>[] = [];
    const opts = { ...base, gens: 3 };
    const run = await runLlmGame(new FakeDecisionMaker(sensible, (r) => `Page from ${r.you}.`), { ...opts, trace: (e) => events.push(e) });
    // The same lines the CLI writes: the run header, every event, then the final line.
    const lines = [
      { type: 'run', simulated: true, seed: opts.seed, biome: opts.biome, gens: opts.gens, personas: opts.personas.slice(0, 3).map((p, i) => ({ generation: i + 1, id: p.id })) },
      ...events,
      { type: 'final', log: run.log, finalState: run.finalState },
    ];
    const sim = simRunFromTrace(lines.map((l) => JSON.stringify(l)).join('\n'));
    expect(sim).toMatchObject({ seed: opts.seed, biome: opts.biome, gens: 3, played: 3 });

    const watched = replayOfSim(sim);
    expect(watched.snapshots).toHaveLength(3);
    expect(watched.snapshots.at(-1)).toEqual(run.finalState);
    expect(watched.actions).toHaveLength(run.log.length);
    expect(watched.journal.map((p) => p.authorUsername)).toEqual(['Player 1 (pragmatic)', 'Player 2 (cautious)', 'Player 3 (builder)']);
    expect(watched.journal[1]!.text).toBe('Page from Player 2.');
    expect(watched.name).toMatch(/^Simulated · /);
  });

  it('an interrupted or foreign file says why it can’t be watched', () => {
    expect(() => simRunFromTrace('{"type":"run","simulated":true,"seed":1,"biome":"forest","gens":2}')).toThrow(/interrupted/);
    expect(() => simRunFromTrace('{"type":"final","log":[]}')).toThrow(/isn't a simulator trace/);
    expect(() => simRunFromTrace('not json')).toThrow(/isn't JSON/);
  });
});

