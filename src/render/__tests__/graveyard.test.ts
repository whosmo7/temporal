import { describe, expect, it } from 'vitest';
import { TILE } from '../constants';
import { graveSlots } from '../graveyard';

const plot = { x: 10, y: 4, w: 4, h: 3 };
const inside = (s: { x: number; y: number }) =>
  s.x > plot.x * TILE && s.x < (plot.x + plot.w) * TILE && s.y > plot.y * TILE && s.y <= (plot.y + plot.h) * TILE;

describe('graveSlots', () => {
  it('is empty with no stones', () => {
    expect(graveSlots(plot, 0)).toEqual([]);
  });

  it('fills the back row left to right, then moves forward', () => {
    const s = graveSlots(plot, 7);
    expect(s.slice(0, 5).every((g) => g.y === s[0]!.y)).toBe(true);
    for (let i = 1; i < 5; i++) expect(s[i]!.x).toBeGreaterThan(s[i - 1]!.x);
    expect(s[5]!.y).toBeGreaterThan(s[0]!.y);
    expect(s[5]!.x).toBe(s[0]!.x);
  });

  it('never puts the same shape side by side', () => {
    const s = graveSlots(plot, 15);
    for (let i = 1; i < s.length; i++) {
      if (s[i]!.y === s[i - 1]!.y) expect(s[i]!.frame).not.toBe(s[i - 1]!.frame);
    }
    expect(new Set(s.map((g) => g.frame))).toEqual(new Set(['grave/1', 'grave/2', 'grave/3', 'grave/4']));
  });

  it('keeps every stone inside the fence, even past the comfortable count', () => {
    for (const n of [1, 15, 40]) {
      const s = graveSlots(plot, n);
      expect(s).toHaveLength(n);
      expect(s.every(inside)).toBe(true);
      expect(new Set(s.map((g) => `${g.x},${g.y}`)).size).toBe(n);
    }
  });

  it('is the same every time', () => {
    expect(graveSlots(plot, 9)).toEqual(graveSlots(plot, 9));
  });
});
