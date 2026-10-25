import { describe, expect, it } from 'vitest';
import type { ActionEntry, Transition } from '../../../../engine';
import { actsPhrase, historyLine, legacyOf, shortName } from '../words';

const names: Record<number, string> = { 1: 'AL', 2: 'MO', 3: 'KE' };
const nameOf = (t: number) => names[t] ?? `Generation ${t}`;

function action(id: string, type: ActionEntry['type'], turn: number): ActionEntry {
  const at = { turn, second: 0 };
  return { id, worldId: 'w', actorId: `u${turn}`, type, committedAt: at, dueAt: at, seq: 0 };
}

function gain(
  id: string,
  turn: number,
  resource: 'food' | 'water',
  delta: number,
  credits: ActionEntry[],
): Transition {
  return {
    id,
    at: { turn, second: 0 },
    target: { resource },
    before: 0,
    after: delta,
    delta,
    causes: credits.map((a) => ({
      kind: 'action',
      actionId: a.id,
      actorId: a.actorId,
      committedTurn: a.committedAt.turn,
    })),
  } as Transition;
}

describe('plot history lines (06)', () => {
  it('names the player and what they did, then the stage', () => {
    const g = { turn: 1, stage: 'sown', acts: [{ actor: 'AL', type: 'plantCrops' as const }] };
    expect(historyLine(g, 'field', 'forest')).toBe('Gen 1 · AL sowed it · Sown, dry');
  });

  it('joins several acts and counts repeats', () => {
    const acts = [
      { actor: 'MO', type: 'fishHunt' as const },
      { actor: 'MO', type: 'fishHunt' as const },
      { actor: 'MO', type: 'fillCan' as const },
    ];
    expect(actsPhrase(acts, 'island')).toBe('MO fished there 2 times and filled the can there');
    expect(actsPhrase(acts, 'forest')).toBe('MO hunted there 2 times and filled the can there');
  });

  it('leaves out the acts when nobody touched it, and the stage when it has none', () => {
    expect(historyLine({ turn: 2, stage: 'ripe', acts: [] }, 'field', 'forest')).toBe(
      'Gen 2 · Ripe',
    );
    expect(historyLine({ turn: 3, stage: '', acts: [] }, 'lectern', 'forest')).toBe('Gen 3');
  });
});

describe('timeline names', () => {
  it('keeps short names and cuts long ones', () => {
    expect(shortName('AL')).toBe('AL');
    expect(shortName('Bartholomew')).toBe('Barthol…');
  });
});

describe('legacy view (06)', () => {
  const orchard = action('a1', 'plantOrchard', 1);
  const well = action('a2', 'digWell', 2);
  const pick = action('a3', 'harvest', 3);

  it('says which later generations a player’s work fed or watered', () => {
    const transitions = [
      gain('t1', 3, 'food', 15, [pick, orchard]),
      gain('t2', 4, 'food', 15, [orchard]),
      gain('t3', 5, 'food', 10, [orchard]),
      gain('t4', 3, 'water', 6, [well]),
      gain('t5', 4, 'water', 6, [well]),
    ];
    expect(legacyOf({ actions: [orchard, well, pick], transitions }, nameOf)).toEqual([
      { turn: 1, text: 'AL planted an orchard in Generation 1. It fed Generations 3, 4 and 5.' },
      { turn: 2, text: 'MO dug a well in Generation 2. It gave water to Generations 3 and 4.' },
    ]);
  });

  it('ignores same-generation gains, losses and harvests', () => {
    const transitions = [
      gain('t1', 1, 'food', 15, [orchard]),
      gain('t2', 3, 'food', -4, [orchard]),
      gain('t3', 4, 'food', 5, [pick]),
    ];
    expect(legacyOf({ actions: [orchard, pick], transitions }, nameOf)).toEqual([]);
  });

  it('puts food and water in one sentence when the same work gave both', () => {
    const transitions = [gain('t1', 2, 'food', 3, [orchard]), gain('t2', 2, 'water', 3, [orchard])];
    expect(legacyOf({ actions: [orchard], transitions }, nameOf)[0]?.text).toBe(
      'AL planted an orchard in Generation 1. It fed Generation 2 and gave water to Generation 2.',
    );
  });
});
