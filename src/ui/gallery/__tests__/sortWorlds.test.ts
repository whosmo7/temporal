import { describe, expect, it } from 'vitest';
import type { CompletedWorld } from '../../../api';
import { sortWorlds } from '../sortWorlds';

const world = (id: string, score: number | null, completedAt: string): CompletedWorld => ({
  worldId: id,
  name: id,
  seed: 1,
  biome: 'forest',
  generationCount: 6,
  completedAt,
  players: [],
  score,
});
const ids = (ws: CompletedWorld[]) => ws.map((w) => w.worldId);

describe('gallery order (decision 037)', () => {
  const worlds = [
    world('old-high', 12, '2026-10-24T10:00:00Z'),
    world('new-low', -3, '2026-10-25T10:00:00Z'),
    world('mid', 5, '2026-10-25T08:00:00Z'),
    world('new-high', 12, '2026-10-25T09:00:00Z'),
    world('unscored', null, '2026-10-25T11:00:00Z'),
  ];

  it('most recent: newest first', () => {
    expect(ids(sortWorlds(worlds, 'recent'))).toEqual(['unscored', 'new-low', 'new-high', 'mid', 'old-high']);
  });

  it('highest and lowest score, ties newest first, unscored last', () => {
    expect(ids(sortWorlds(worlds, 'highest'))).toEqual(['new-high', 'old-high', 'mid', 'new-low', 'unscored']);
    expect(ids(sortWorlds(worlds, 'lowest'))).toEqual(['new-low', 'mid', 'new-high', 'old-high', 'unscored']);
  });

  it("doesn't reorder the list it's given", () => {
    const copy = [...worlds];
    sortWorlds(worlds, 'highest');
    expect(worlds).toEqual(copy);
  });
});
