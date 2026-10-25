import { describe, expect, it } from 'vitest';
import { landOf, levelName } from '../land';
import { canPips, toolAria, toolbarOf } from '../toolbarData';

describe('the land (13, decision 023)', () => {
  it('shows nothing until the engine has health and level', () => {
    expect(landOf({ resources: {} })).toBeNull();
    expect(landOf(null)).toBeNull();
  });

  it('turns health into a bar fraction and the level into its name', () => {
    expect(landOf({ health: 55, level: 1 })).toEqual({
      health: 0.55,
      level: 1,
      name: 'Taking root',
    });
    expect(landOf({ health: 140, level: 0 })?.health).toBe(1);
  });

  it('names every level, and keeps the last name past the top', () => {
    expect([0, 1, 2, 3, 4, 7].map(levelName)).toEqual([
      'Bare',
      'Taking root',
      'Green',
      'Blooming',
      'Abundant',
      'Abundant',
    ]);
  });
});

describe('the toolbar (13)', () => {
  it('reads seeds and the can only once the engine provides them', () => {
    expect(toolbarOf({ resources: { food: 3 } })).toEqual({ seeds: null, can: null });
    expect(toolbarOf({ resources: { seeds: 9 }, can: { pours: 2, capacity: 3 } })).toEqual({
      seeds: 9,
      can: { pours: 2, capacity: 3 },
    });
  });

  it('draws one pip per pour, filled for what is left', () => {
    expect(canPips({ pours: 2, capacity: 3 })).toEqual([true, true, false]);
    expect(canPips({ pours: 5, capacity: 3 })).toEqual([true, true, true]);
  });

  it('reads the slots aloud', () => {
    const data = { seeds: 4, can: { pours: 1, capacity: 3 } };
    expect(toolAria('can', data)).toBe('Can, 1 of 3');
    expect(toolAria('seeds', data)).toBe('Seeds, 4');
    expect(toolAria('seeds', { seeds: null, can: null })).toBe('Seeds');
  });
});
