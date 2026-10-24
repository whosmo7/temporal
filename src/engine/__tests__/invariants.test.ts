import { describe, expect, it } from 'vitest';
import { newGame, type Game } from '../__fixtures__/play';
import { createRng } from '../rng';
import { replay } from '../replay';
import type { ActionInput, PlotId } from '../types';
import { visibleView } from '../view';

const TYPES: ActionInput['type'][] = [
  'harvest',
  'plantCrops',
  'plantOrchard',
  'repairReservoir',
  'digWell',
  'fishHunt',
  'maintain',
  'fastTrack',
];
// Fields and orchards are acted on per tile (decision 019).
const PLOTS: PlotId[] = ['field-1:0,0', 'field-1:2,2', 'field-2:1,1', 'orchard-1:0,0', 'orchard-1:1,1', 'reservoir', 'well', 'wild'];

/** Plays a whole world with random (often invalid) actions drawn from a seeded stream. */
function randomGame(seed: number, gens = 6): Game {
  const rng = createRng(seed);
  const game = newGame(seed, { worldId: `w-${seed}`, generationCount: gens }, 'AL', true);
  for (let n = 1; n <= gens; n++) {
    game.turn((g) => {
      let t = 0;
      for (let i = 0; i < 12; i++) {
        t += rng.int(0, 80);
        const type = rng.pick(TYPES);
        const pending = g.state.pending.filter((e) => e.status === 'pending');
        g.act(type, {
          t,
          actorId: `p${n}`,
          plotId: rng.pick(PLOTS),
          eat: rng.chance(0.3),
          ...(type === 'fastTrack' && pending.length > 0
            ? { targetEffectId: rng.pick(pending).id }
            : {}),
        });
      }
    });
  }
  return game;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe('engine invariants', () => {
  it('same seed and log give the same world, and replay rebuilds it (property test)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const live = randomGame(seed);
      expect(randomGame(seed).state).toEqual(live.state);

      const { snapshots, summaries } = replay(
        seed,
        { worldId: `w-${seed}`, generationCount: 6, turns: 6 },
        live.log,
      );
      expect(snapshots.at(-1)?.state).toEqual(live.state);
      expect(summaries).toEqual(live.summaries);
    }
  });

  it('every transition has at least one cause', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const transition of randomGame(seed).transitions) {
        expect(transition.causes.length).toBeGreaterThan(0);
      }
    }
  });

  it('transition ids are unique', () => {
    const ids = randomGame(3).transitions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no engine call mutates the state it was given', () => {
    const game = newGame();
    game.begin();
    game.act('plantOrchard', { plotId: 'orchard-1:0,0' });
    deepFreeze(game.state);
    expect(() => {
      game.act('plantCrops', { plotId: 'field-1:0,0', t: 10 });
      game.act('harvest', { plotId: 'field-1:0,0', t: 200 });
      game.end();
      game.begin();
      visibleView(game.state, 100);
    }).not.toThrow();
  });

  it('replay never mutates the action log it is given', () => {
    const live = randomGame(5);
    const log = deepFreeze(structuredClone(live.log));
    expect(() => replay(5, { worldId: 'w-5', generationCount: 6, turns: 6 }, log)).not.toThrow();
    expect(log).toEqual(live.log);
  });

  it('the visible view never carries due dates or pending numbers', () => {
    const game = newGame();
    game.begin();
    game.act('plantOrchard', { plotId: 'orchard-1:0,0' });
    game.act('plantCrops', { plotId: 'field-1:0,0', t: 0 });
    const view = visibleView(game.state, 100);
    const text = JSON.stringify(view);
    expect(text).not.toContain('dueAt');
    expect(text).not.toContain('payload');
    expect(text).not.toContain('causes');
    expect(view.plots['field-1:0,0']?.stage).toBe('growing');
    expect(view.fastTrackable.map((o) => Object.keys(o).sort())).toEqual([
      ['actorId', 'committedTurn', 'cost', 'effectId', 'kind', 'plotId'],
      ['actorId', 'committedTurn', 'cost', 'effectId', 'kind', 'plotId'],
    ]);
  });
});
