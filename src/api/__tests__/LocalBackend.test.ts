import { beforeEach, describe, expect, it } from 'vitest';
import { createWorld } from '../../engine';
import type { ActionEntry, ClaimedWorld } from '../Backend';
import { DEFAULT_SETTINGS, LocalBackend } from '../LocalBackend';

// The 07 backend scenarios on LocalBackend. scripts/test-backend.ts runs the same ones (plus the
// concurrency test) against the live Supabase project.

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}

const TTL_MS =
  (DEFAULT_SETTINGS.defaultTurnSeconds +
    DEFAULT_SETTINGS.journalAllowanceSeconds +
    DEFAULT_SETTINGS.lockGraceSeconds) *
  1000;

let clock = 0;
let rolls: number[] = [];
const make = () =>
  new LocalBackend({
    now: () => clock,
    // Scripted coin flips; 0 means "inherit" and "pick the first world".
    random: () => rolls.shift() ?? 0,
  });

/** Plants crops on the first field, a valid gen-1 action. */
function plantAction(world: ClaimedWorld): ActionEntry {
  const state =
    world.snapshot ??
    createWorld(world.seed, { worldId: world.worldId, biome: world.biome, preset: world.preset })
      .state;
  const field = Object.values(state.plots).find((p) => p.kind === 'field');
  if (!field) throw new Error('no field plot');
  return {
    id: `a-${world.turn}`,
    worldId: world.worldId,
    actorId: 'whoever',
    type: 'plantCrops',
    plotId: field.id,
    committedAt: { turn: world.turn, t: 10 },
    dueAt: { turn: world.turn, t: 10 },
    seq: 0,
  };
}

const journal = (text: string) => ({ text, drawing: null });

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  clock = 1_000_000;
  rolls = [];
});

describe('LocalBackend', () => {
  it('rejects bad usernames and duplicate names', async () => {
    const b = make();
    await expect(b.signUp('x', 'pw')).rejects.toThrow();
    await b.signUp('Alma', 'pw');
    await expect(b.signUp('alma', 'pw')).rejects.toThrow('taken');
  });

  it('gives the successor the page, the stone and the state', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1]; // new world
    const first = await b.claimWorld();
    expect(first.turn).toBe(1);
    expect(first.snapshot).toBeNull();
    expect(first.name).toMatch(/^\w+ \w+$/);
    await b.commitTurn({
      worldId: first.worldId,
      actions: [plantAction(first)],
      journal: journal('Look after it.'),
    });

    await b.signUp('bram', 'pw');
    rolls = [0]; // inherit
    const second = await b.claimWorld();
    expect(second.worldId).toBe(first.worldId);
    expect(second.turn).toBe(2);
    expect(second.snapshot).not.toBeNull();
    expect(second.journal).toEqual([
      { turn: 1, authorUsername: 'alma', text: 'Look after it.', drawing: null },
    ]);
    expect(second.gravestones).toEqual([{ turn: 1, username: 'alma' }]);
  });

  it('logs actions under the committer, whatever actorId the client sent', async () => {
    const b = make();
    const me = await b.signUp('alma', 'pw');
    await b.setSettings({ defaultGenerationCount: 1 });
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    await b.commitTurn({ worldId: w.worldId, actions: [plantAction(w)], journal: journal('') });
    const replay = await b.getReplay(w.worldId);
    expect(replay.actions.map((a) => a.actorId)).toEqual([me.id]);
  });

  it('resumes a held world instead of taking another', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const first = await b.claimWorld();
    rolls = [0.99, 0.5, 0.5];
    expect((await b.claimWorld()).worldId).toBe(first.worldId);
  });

  it('voids an abandoned turn: claimable again at the same turn, no stone', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const abandoned = await b.claimWorld();

    clock += TTL_MS + 1;
    await expect(
      b.commitTurn({ worldId: abandoned.worldId, actions: [], journal: journal('late') }),
    ).rejects.toThrow('expired');

    await b.signUp('bram', 'pw');
    rolls = [0];
    const again = await b.claimWorld();
    expect(again.worldId).toBe(abandoned.worldId);
    expect(again.turn).toBe(1);
    expect(again.gravestones).toEqual([]);
    expect(again.journal).toEqual([]);
  });

  it('keeps a locked world from a second player', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const held = await b.claimWorld();
    await b.signUp('bram', 'pw');
    rolls = [0, 0.99, 0.1, 0.1];
    expect((await b.claimWorld()).worldId).not.toBe(held.worldId);
  });

  it('rejects a second commit for the same turn and an invalid action', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    const bad = { ...plantAction(w), plotId: 'nowhere' as ActionEntry['plotId'] };
    await expect(b.commitTurn({ worldId: w.worldId, actions: [bad], journal: journal('') })).rejects.toThrow(
      'Invalid action',
    );
    await b.commitTurn({ worldId: w.worldId, actions: [], journal: journal('') });
    await expect(
      b.commitTurn({ worldId: w.worldId, actions: [], journal: journal('again') }),
    ).rejects.toThrow('expired');
  });

  it("doesn't hand a player back the world they just committed", async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    await b.commitTurn({ worldId: w.worldId, actions: [], journal: journal('') });
    rolls = [0, 0.1, 0.1]; // wants to inherit, but the only open world is the one just played
    expect((await b.claimWorld()).worldId).not.toBe(w.worldId);
  });

  it('heartbeat extends the lock, but only up to the cap', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    const claimedAt = clock;
    const cap = claimedAt + TTL_MS + DEFAULT_SETTINGS.heartbeatCapSeconds * 1000;

    clock = claimedAt + TTL_MS - 1000;
    const extended = await b.heartbeat(w.worldId);
    expect(Date.parse(extended!)).toBe(clock + DEFAULT_SETTINGS.lockGraceSeconds * 1000);

    for (let i = 0; i < 20; i++) {
      clock += 60_000;
      if (clock >= cap) break;
      await b.heartbeat(w.worldId);
    }
    clock = cap + 1;
    expect(await b.heartbeat(w.worldId)).toBeNull();
  });

  it('admin: force-assign, configure the world, skip to replay', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    await b.commitTurn({ worldId: w.worldId, actions: [plantAction(w)], journal: journal('p1') });

    await b.signUp('judge', 'pw');
    await b.signUp('admin', 'pw');
    await b.forceAssign(w.worldId, 'judge');
    await b.setWorld(w.worldId, { turnSeconds: 60, generationCount: 3 });

    // Someone else can't take a world forced for the judge.
    rolls = [0, 0.99, 0.1, 0.1];
    expect((await b.claimWorld()).worldId).not.toBe(w.worldId);

    await b.signIn('judge', 'pw');
    rolls = [0.99, 0.99, 0.99];
    const judged = await b.claimWorld();
    expect(judged.worldId).toBe(w.worldId);
    expect(judged.turnSeconds).toBe(60);
    expect(judged.generationCount).toBe(3);

    await b.completeWorld(w.worldId);
    const gallery = await b.listCompletedWorlds();
    expect(gallery.map((g) => g.worldId)).toEqual([w.worldId]);
    expect(gallery[0]!.players).toEqual(['alma']);
    const replay = await b.getReplay(w.worldId);
    expect(replay.snapshots).toHaveLength(1);
    expect(replay.journal.map((j) => j.text)).toEqual(['p1']);
  });

  it('completes the world after its last generation', async () => {
    const b = make();
    await b.signUp('alma', 'pw');
    await b.setSettings({ defaultGenerationCount: 2 });
    rolls = [0.99, 0.1, 0.1];
    const w = await b.claimWorld();
    await b.commitTurn({ worldId: w.worldId, actions: [], journal: journal('1') });
    expect(await b.listCompletedWorlds()).toEqual([]);
    await expect(b.getReplay(w.worldId)).rejects.toThrow();

    await b.signUp('bram', 'pw');
    rolls = [0];
    await b.claimWorld();
    await b.commitTurn({ worldId: w.worldId, actions: [], journal: journal('2') });
    const replay = await b.getReplay(w.worldId);
    expect(replay.snapshots.map((s) => s.turn)).toHaveLength(2);
    expect(replay.journal.map((j) => j.authorUsername)).toEqual(['alma', 'bram']);
  });
});
