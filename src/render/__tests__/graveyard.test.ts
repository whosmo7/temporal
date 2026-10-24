import { describe, expect, it } from 'vitest';
import { generateMap } from '../../worldgen';
import { TILE } from '../constants';
import { layoutStones, nearestStone, stoneLabel } from '../graveyard';

const plot = generateMap(123, 'forest').plots.find((p) => p.kind === 'graveyard')!;
const stones = (n: number) => Array.from({ length: n }, (_, i) => ({ turn: i + 1, username: `P${i + 1}` }));

describe('graveyard layout', () => {
  it('gives every stone its own place inside the fence, up to 80 generations', () => {
    for (let n = 0; n <= 80; n++) {
      const spots = layoutStones(plot, stones(n));
      expect(spots).toHaveLength(n);
      expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(n);
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(plot.w * TILE);
        expect(s.y).toBeLessThanOrEqual(plot.h * TILE);
        expect(s.y - 14 * s.scale).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps full-size stones for a default-length world', () => {
    expect(layoutStones(plot, stones(6)).every((s) => s.scale === 1)).toBe(true);
  });

  it('puts the oldest at the back and keeps stones where they are as new ones arrive', () => {
    const five = layoutStones(plot, stones(5));
    const six = layoutStones(plot, stones(6));
    expect(six.slice(0, 5)).toEqual(five);
    const ys = six.map((s) => s.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('orders by generation, whatever order the stones arrive in', () => {
    const shuffled = [stones(3)[2]!, stones(3)[0]!, stones(3)[1]!];
    expect(layoutStones(plot, shuffled).map((s) => s.stone.turn)).toEqual([1, 2, 3]);
  });

  it('labels a stone with its name and generation', () => {
    expect(stoneLabel({ turn: 2, username: 'AL' })).toBe('AL · Generation 2');
  });

  it('reads the stone nearest the player', () => {
    const spots = layoutStones(plot, stones(4));
    const target = spots[3]!;
    const walker = { x: plot.x + target.x / TILE, y: plot.y + plot.h + 0.5, facing: 'up' as const, moving: false };
    expect(nearestStone(plot, spots, walker)?.stone.turn).toBe(4);
    expect(nearestStone(plot, [], walker)).toBeNull();
  });
});
