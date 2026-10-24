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
    const worldId = await playOne(api, 'al');
    await api.signUp('admin', 'secret1');
    expect(await api.listCompletedWorlds()).toEqual([]);
    await api.markComplete(worldId);
    const [done] = await api.listCompletedWorlds();
    expect(done).toMatchObject({ worldId, generationCount: 1, players: ['al'] });
    expect((await api.getReplay(worldId)).journal).toHaveLength(1);
  });

  it('force-assigns a world to a player, who gets it on their next Play', async () => {
    const worldId = await playOne(api, 'al');
    await api.signUp('judge', 'secret1');
    await api.signUp('admin', 'secret1');
    await api.forceAssign(worldId, 'Judge');
    expect((await api.listWorlds())[0]?.forcedFor).toBe('judge');
    await api.signIn('judge', 'secret1');
    expect((await api.claimWorld()).worldId).toBe(worldId);
  });

  it('configures worlds and defaults, within limits', async () => {
    const worldId = await playOne(api, 'al');
    await api.signUp('admin', 'secret1');
    await api.configureWorld(worldId, { turnSeconds: 120, generationCount: 3 });
    expect((await api.listWorlds())[0]).toMatchObject({ turnSeconds: 120, generationCount: 3 });
    await expect(api.configureWorld(worldId, { generationCount: 1 })).rejects.toThrow();
    await api.setSettings({ defaultTurnSeconds: 90, inheritRatio: 0 });
    expect(await api.getSettings()).toEqual({ defaultTurnSeconds: 90, defaultGenerationCount: 6, inheritRatio: 0 });
    await expect(api.setSettings({ inheritRatio: 2 })).rejects.toThrow();
  });
});
