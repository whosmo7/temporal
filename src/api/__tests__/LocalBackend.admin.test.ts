import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../LocalBackend';

function stubStorage() {
  const items = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
}

/** One player plays a generation of a fresh world with no actions; returns its id. */
async function playOne(api: LocalBackend, username: string): Promise<string> {
  await api.signUp(username, 'secret1').catch(() => api.signIn(username, 'secret1'));
  const claimed = await api.claimWorld();
  await api.commitTurn({ worldId: claimed.worldId, actions: [], journal: { text: '', drawing: [] } });
  return claimed.worldId;
}

describe('LocalBackend admin', () => {
  let api: LocalBackend;
  beforeEach(() => {
    stubStorage();
    api = new LocalBackend();
  });

  it('only lets an admin in', async () => {
    const player = await api.signUp('player', 'secret1');
    expect(player.isAdmin).toBe(false);
    await expect(api.listWorlds()).rejects.toThrow('Not allowed');
    const admin = await api.signUp('admin', 'secret1');
    expect(admin.isAdmin).toBe(true);
    await expect(api.listWorlds()).resolves.toEqual([]);
  });

  it('skips a world to its replay with the generations played so far', async () => {
    const worldId = await playOne(api, 'alba');
    await api.signUp('admin', 'secret1');
    expect(await api.listCompletedWorlds()).toEqual([]);
    await api.markComplete(worldId);
    const [done] = await api.listCompletedWorlds();
    expect(done).toMatchObject({ worldId, generationCount: 1, players: ['alba'] });
    expect((await api.getReplay(worldId)).journal).toHaveLength(1);
  });

  it('force-assigns a world to a player, who gets it on their next Play', async () => {
    const worldId = await playOne(api, 'alba');
    await api.signUp('judge', 'secret1');
    await api.signUp('admin', 'secret1');
    await api.forceAssign(worldId, 'Judge');
    expect((await api.listWorlds())[0]?.forcedFor).toBe('judge');
    await api.signIn('judge', 'secret1');
    expect((await api.claimWorld()).worldId).toBe(worldId);
  });

  it('configures worlds and defaults, within limits', async () => {
    const worldId = await playOne(api, 'alba');
    await api.signUp('admin', 'secret1');
    await api.configureWorld(worldId, { turnSeconds: 120, generationCount: 3 });
    expect((await api.listWorlds())[0]).toMatchObject({ turnSeconds: 120, generationCount: 3 });
    await expect(api.configureWorld(worldId, { generationCount: 1 })).rejects.toThrow();
    await api.setSettings({ defaultTurnSeconds: 90, inheritRatio: 0 });
    expect(await api.getSettings()).toEqual({ defaultTurnSeconds: 90, defaultGenerationCount: 6, inheritRatio: 0 });
    await expect(api.setSettings({ inheritRatio: 2 })).rejects.toThrow();
  });

  it('lists worlds in progress only (decision 036)', async () => {
    const worldId = await playOne(api, 'alba');
    await api.signUp('admin', 'secret1');
    expect((await api.listWorlds()).map((w) => w.worldId)).toEqual([worldId]);
    await api.markComplete(worldId);
    expect(await api.listWorlds()).toEqual([]);
  });

  it('removes a world from the game but keeps its history, and refuses while it is locked', async () => {
    const worldId = await playOne(api, 'alba');
    // A second finished world, to check the gallery and replay hide only the removed one.
    await api.signUp('admin', 'secret1');
    await api.markComplete(worldId);
    const live = await playOne(api, 'cora');
    await api.signIn('admin', 'secret1');

    // Locked: refused until the lock is cleared.
    await api.signUp('dov', 'secret1');
    api = new LocalBackend({ random: () => 0 }); // always inherits
    await api.signIn('dov', 'secret1');
    expect((await api.claimWorld()).worldId).toBe(live);
    await api.signIn('admin', 'secret1');
    await expect(api.removeWorld(live)).rejects.toThrow('Clear the lock first');
    await api.clearLock(live);
    await api.removeWorld(live);
    await api.removeWorld(worldId);

    expect(await api.listWorlds()).toEqual([]);
    expect(await api.listCompletedWorlds()).toEqual([]);
    await expect(api.getReplay(worldId)).rejects.toThrow('World not found');
    await expect(api.forceAssign(live, 'dov')).rejects.toThrow('No such world');
    // Nobody is dealt it again: dov gets a fresh world.
    await api.signIn('dov', 'secret1');
    expect((await api.claimWorld()).worldId).not.toBe(live);
    // History kept: its turns are still stored.
    const stored = JSON.parse(localStorage.getItem('inheritance.local')!) as { turns: { worldId: string }[] };
    expect(stored.turns.filter((t) => t.worldId === live)).toHaveLength(1);
  });

  it('logs every admin change, newest first, with who made it', async () => {
    const worldId = await playOne(api, 'alba');
    await api.signUp('judge', 'secret1');
    await api.signUp('admin', 'secret1');
    await api.forceAssign(worldId, 'judge');
    await api.configureWorld(worldId, { generationCount: 4 });
    await api.setSettings({ defaultTurnSeconds: 90 });
    await api.markComplete(worldId);
    const log = await api.listAdminActions();
    expect(log.map((a) => a.action)).toEqual(['markComplete', 'setSettings', 'configureWorld', 'forceAssign']);
    expect(log.every((a) => a.admin === 'admin')).toBe(true);
    expect(log[3]).toMatchObject({ worldId, before: null, after: 'judge' });
    expect(log[2]).toMatchObject({ before: { generationCount: 6 }, after: { generationCount: 4 } });
    expect(await api.listAdminActions(2)).toHaveLength(2);
    await api.signIn('judge', 'secret1');
    await expect(api.listAdminActions()).rejects.toThrow('Not allowed');
  });

  it('creates the demo world: founders played, judge assigned, admin still signed in', async () => {
    await api.signUp('admin', 'secret1');
    const worldId = await api.createDemoWorld();
    expect((await api.currentUser())?.username).toBe('admin');
    const [demo] = await api.listWorlds();
    expect(demo).toMatchObject({ worldId, players: ['founder_a', 'founder_b'], forcedFor: 'judge' });
    expect((await api.listAdminActions()).map((a) => a.action)).toEqual(['createDemoWorld']);
    await api.signIn('judge', 'demo');
    expect((await api.claimWorld()).worldId).toBe(worldId);
  });
});
