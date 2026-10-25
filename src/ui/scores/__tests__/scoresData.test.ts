import { describe, expect, it } from 'vitest';
import type { CompletedWorld } from '../../../api';
import type { GenerationScore, WorldState } from '../../../engine';
import { byTotal, rowsOf, scoreRows } from '../scoresData';

const score = (turn: number, total: number): GenerationScore => ({
  turn,
  productive: 0,
  extraction: 0,
  corruption: 0,
  condition: total,
  exitBonus: total,
  total,
});

function world(id: string, players: string[], scores?: GenerationScore[]): CompletedWorld {
  return {
    worldId: id,
    name: `World ${id}`,
    seed: 1,
    biome: 'forest',
    generationCount: players.length,
    completedAt: '2026-10-25',
    players,
    score: null,
    finalState: (scores ? { scores } : {}) as WorldState,
  };
}

describe('scores page data', () => {
  const worlds = [
    world('a', ['al', 'mo', 'al'], [score(1, 40), score(2, 70), score(3, 55)]),
    world('b', ['ke', 'mo'], [score(1, 90), score(2, 20)]),
    world('old', ['zo']), // finished before scoring: no scores
  ];

  it('names each generation by who played it, in generation order', () => {
    const rows = scoreRows(worlds);
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.worldId === 'a' && r.turn === 2)?.username).toBe('mo');
    expect(rows.find((r) => r.worldId === 'b' && r.turn === 1)?.worldName).toBe('World b');
  });

  it('ranks everyone highest first', () => {
    expect(byTotal(scoreRows(worlds)).map((r) => r.total)).toEqual([90, 70, 55, 40, 20]);
  });

  it('lists a player’s own generations, including a return to the same world', () => {
    expect(rowsOf(scoreRows(worlds), 'al').map((r) => [r.worldId, r.turn])).toEqual([
      ['a', 3],
      ['a', 1],
    ]);
    expect(rowsOf(scoreRows(worlds), 'nobody')).toEqual([]);
  });
});
