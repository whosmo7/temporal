import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../../api/LocalBackend';
import { useGameStore } from '../../../store/game';
import { clearUnsaved, keepUnsaved, loadUnsaved, turnStart } from '../turnStart';

// LocalBackend and the local copy use localStorage; Vitest runs in Node.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('the play flow on LocalBackend', () => {
  it('a new world starts at generation 1 with no pages or stones', async () => {
    const backend = new LocalBackend();
    await backend.signUp('alma', '');
    const claim = await backend.claimWorld();
    const start = turnStart(claim);
    expect(start.world.turn).toBe(1);
    expect(start.world.worldId).toBe(claim.worldId);
    expect(start.pages).toEqual([]);
    expect(start.stones).toEqual([]);
  });

  it('a committed turn is what the next player inherits', async () => {
    const backend = new LocalBackend();
    await backend.signUp('alma', '');
    const claim = await backend.claimWorld();
    const start = turnStart(claim);
    useGameStore.getState().loadTurn(start.world, 'alma', start.begun);
    const repair = useGameStore.getState().act({ type: 'repairReservoir', plotId: 'reservoir' });
    expect(repair.error).toBeUndefined();
    const { log } = useGameStore.getState();
    const local = useGameStore.getState().finishTurn()!;

    await backend.commitTurn({ worldId: claim.worldId, actions: log, journal: { text: 'Fixed the wall.', drawing: [] } });

    await backend.signUp('bram', '');
    vi.spyOn(Math, 'random').mockReturnValue(0); // inherit, and pick the only open world
    const next = await backend.claimWorld();
    expect(next.worldId).toBe(claim.worldId);
    expect(next.turn).toBe(2);
    expect(next.gravestones).toEqual([{ turn: 1, username: 'alma' }]);
    expect(next.journal.map((p) => p.text)).toEqual(['Fixed the wall.']);
    // The backend's re-run of the turn ends where the player's own run did.
    expect(next.snapshot).toEqual(local.state);
    expect(turnStart(next).world.turn).toBe(2);
  });

  it('refreshing mid-turn claims the same world at the same turn', async () => {
    const backend = new LocalBackend();
    await backend.signUp('alma', '');
    const first = await backend.claimWorld();
    const again = await backend.claimWorld();
    expect(again.worldId).toBe(first.worldId);
    expect(again.turn).toBe(first.turn);
  });
});

describe('the local copy of a sealed turn', () => {
  it('is kept until cleared', () => {
    const input = { worldId: 'w', actions: [], journal: { text: 'hi', drawing: [] } };
    expect(loadUnsaved()).toBeNull();
    keepUnsaved(input);
    expect(loadUnsaved()).toEqual(input);
    clearUnsaved();
    expect(loadUnsaved()).toBeNull();
  });
});
