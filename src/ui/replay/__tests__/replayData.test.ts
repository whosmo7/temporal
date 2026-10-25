import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Replay } from '../../../api';
import { LocalBackend } from '../../../api/LocalBackend';
import {
  applyAction,
  beginTurn,
  createWorld,
  endTurn,
  replay as rebuild,
  type ActionEntry,
  type ActionInput,
  type Transition,
  type WorldState,
} from '../../../engine';
import { changedPlots, playerOf, plotHistory, stonesAt, viewAt } from '../replayData';

const NAMES = ['AL', 'MO', 'KE'];
type Act = Pick<ActionInput, 'type' | 'plotId' | 'targetEffectId'> & { t?: number };

/** Plays one generation per list as NAMES[n - 1], with no seeded events, into a finished-world Replay. */
function played(turns: Act[][]): Replay {
  let state: WorldState = createWorld(4, { worldId: 'w', biome: 'forest', generationCount: turns.length }).state;
  state.events = [];
  const snapshots: WorldState[] = [];
  const actions: ActionEntry[] = [];
  const transitions: Transition[] = [];
  turns.forEach((acts, i) => {
    const begun = beginTurn(state);
    state = begun.state;
    transitions.push(...begun.transitions);
    acts.forEach(({ t, ...a }, seq) => {
      const r = applyAction(state, { ...a, id: `${i + 1}-${seq}`, actorId: `id-${NAMES[i]}`, seq }, t ?? seq);
      if (r.error || !r.entry) throw new Error(`${a.type}: ${r.error}`);
      state = r.state;
      transitions.push(...r.transitions);
      actions.push(r.entry);
    });
    const ended = endTurn(state);
    state = ended.state;
    transitions.push(...ended.transitions);
    snapshots.push(state);
  });
  const journal = turns.map((_, i) => ({ turn: i + 1, authorUsername: NAMES[i]!, text: '', drawing: [] }));
  return { worldId: 'w', name: 'Test', seed: 4, biome: 'forest', snapshots, actions, transitions, journal };
}

const TILE = 'field-1:0,0';
const TREE = 'orchard-1:0,0';

describe('replay data', () => {
  // Gen 1, AL: sows and waters one tile too late in the day (it rots), plants a tree, starts the repair.
  // Gen 2, MO: tends the rotten tile, and hurries AL's tree.
  const world = () =>
    played([
      [
        { type: 'plantCrops', plotId: TILE, t: 500 },
        { type: 'fillCan', t: 501 },
        { type: 'water', plotId: TILE, t: 502 },
        { type: 'plantOrchard', plotId: TREE, t: 503 }, // action 1-3: its effect is 1-3:orchardMature
        { type: 'repairReservoir', plotId: 'reservoir', t: 504 },
      ],
      [
        { type: 'maintain', plotId: TILE, t: 1 },
        { type: 'fastTrack', targetEffectId: '1-3:orchardMature', t: 2 },
      ],
    ]);

  it('generation 0 is the founder world', () => {
    const r = world();
    expect(viewAt(r, 0).plots[TILE]?.stage).toBe('empty');
    expect(viewAt(r, 0).plots['reservoir']?.stage).toBe('cracked');
    expect(viewAt(r, 1).plots[TILE]?.stage).toBe('rotten');
  });

  it('lists exactly the tiles and plots whose look changed that generation', () => {
    const r = world();
    const gen1 = changedPlots(r, 1);
    expect(gen1).toContain(TILE); // empty → rotten
    expect(gen1).toContain(TREE); // empty → sapling
    expect(gen1).not.toContain('field-1:1,0');
    expect(gen1).not.toContain('reservoir'); // the repair lands next generation
    const gen2 = changedPlots(r, 2);
    expect(gen2).toEqual(expect.arrayContaining([TILE, TREE, 'reservoir']));
    expect(gen2).not.toContain('field-1:1,0');
  });

  it("tells one tile's story, generation by generation, with who acted on it", () => {
    expect(plotHistory(world(), TILE)).toEqual([
      { turn: 1, stage: 'rotten', acts: [{ actor: 'AL', type: 'plantCrops' }, { actor: 'AL', type: 'water' }] },
      { turn: 2, stage: 'empty', acts: [{ actor: 'MO', type: 'maintain' }] },
    ]);
  });

  it('counts hurrying a tree as acting on it', () => {
    expect(plotHistory(world(), TREE)).toEqual([
      { turn: 1, stage: 'sapling', acts: [{ actor: 'AL', type: 'plantOrchard' }] },
      { turn: 2, stage: 'fruiting', acts: [{ actor: 'MO', type: 'fastTrack' }] },
    ]);
  });

  it('names each generation by its page, and adds a stone per generation', () => {
    const r = world();
    expect(playerOf(r, 2)).toBe('MO');
    expect(stonesAt(r, 1)).toEqual([{ turn: 1, username: 'AL' }]);
    expect(stonesAt(r, 2)).toHaveLength(2);
  });
});

// LocalBackend keeps its state in localStorage; Vitest runs in Node.
class MemoryStorage {
  private items = new Map<string, string>();
  getItem = (key: string) => this.items.get(key) ?? null;
  setItem = (key: string, value: string) => void this.items.set(key, value);
  removeItem = (key: string) => void this.items.delete(key);
}
beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('stored snapshots', () => {
  it('replay() rebuilds the snapshots the backend stored for a played world', async () => {
    const backend = new LocalBackend({ storageKey: 'test.replay' });
    await backend.signUp('admin', 'secret1');
    const worldId = await backend.createSeededWorld({ seed: 9, biome: 'island', generationCount: 2 });
    for (const [turn, acts] of [
      [1, [{ type: 'plantCrops', plotId: TILE, t: 10 }, { type: 'fillCan', t: 12 }, { type: 'water', plotId: TILE, t: 14 }, { type: 'harvest', plotId: TILE, t: 170 }]],
      [2, [{ type: 'digWell', plotId: 'well', t: 5 }, { type: 'fishHunt', plotId: 'wild', t: 20 }]],
    ] as const) {
      await backend.forceAssign(worldId, 'admin');
      const claim = await backend.claimWorld();
      expect(claim.worldId).toBe(worldId);
      const actions = acts.map((a, seq) => ({
        ...a,
        id: `${turn}-${seq}`,
        worldId,
        actorId: 'admin',
        seq,
        committedAt: { turn, t: a.t },
        dueAt: { turn, t: a.t },
      })) as ActionEntry[];
      await backend.commitTurn({ worldId, actions, journal: { text: `Gen ${turn}`, drawing: [] } });
    }

    const stored = await backend.getReplay(worldId);
    expect(stored.snapshots).toHaveLength(2);
    const rebuilt = rebuild(stored.seed, { worldId, biome: stored.biome, preset: stored.preset, generationCount: 2 }, stored.actions);
    expect(rebuilt.snapshots.map((s) => s.state)).toEqual(stored.snapshots);
  });
});
