import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO } from '../demo';
import { LocalBackend } from '../LocalBackend';
import { OFFLINE_PASSWORD, seedOffline } from '../offline';

class MemoryStorage {
  private items = new Map<string, string>();
  getItem = (key: string) => this.items.get(key) ?? null;
  setItem = (key: string, value: string) => void this.items.set(key, value);
  removeItem = (key: string) => void this.items.delete(key);
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('demo world', () => {
  it('hands the judge the seeded world after the founders, with their pages and stones', async () => {
    const backend = new LocalBackend({ storageKey: 'test.offline' });
    await seedOffline(backend);
    await seedOffline(backend); // second load doesn't add another copy
    expect(await backend.listAllWorlds()).toHaveLength(1);

    await backend.signIn(DEMO.judge, OFFLINE_PASSWORD);
    const world = await backend.claimWorld();
    expect(world.seed).toBe(DEMO.world.seed);
    expect(world.turn).toBe(DEMO.generations.length + 1);
    expect(world.journal.map((p) => p.authorUsername)).toEqual(DEMO.generations.map((g) => g.player));
    expect(world.gravestones).toHaveLength(DEMO.generations.length);
    // The demo moment: the orchard founder_a planted is there for the judge.
    expect(world.snapshot?.plots['orchard-1']?.stage).not.toBe('empty');
  });
});
