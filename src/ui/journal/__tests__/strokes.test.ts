import { describe, expect, it } from 'vitest';
import { CANVAS_H, CANVAS_W, ERASE, appendPoint, asDrawing, isBlank, toLogical } from '../strokes';

describe('asDrawing', () => {
  it('keeps well-formed strokes, including eraser strokes', () => {
    const d = [
      { color: '#1f2027', width: 2.5, points: [[1, 2], [3, 4]] },
      { color: ERASE, width: 12, points: [[5, 6]] },
    ];
    expect(asDrawing(d)).toEqual(d);
  });

  it('returns an empty drawing for anything that is not an array', () => {
    expect(asDrawing(null)).toEqual([]);
    expect(asDrawing('strokes')).toEqual([]);
    expect(asDrawing({ color: '#000000' })).toEqual([]);
  });

  it('drops malformed strokes and points without losing the good ones', () => {
    const good = { color: '#3a6757', width: 2.5, points: [[10, 10]] };
    const d = asDrawing([
      good,
      { color: 'red', width: 2.5, points: [[1, 1]] }, // not a hex colour
      { color: '#3a6757', width: 0, points: [[1, 1]] }, // no width
      { color: '#3a6757', width: 2.5, points: [] }, // no points
      { color: '#3a6757', width: 2.5, points: [[1, 1], [NaN, 2], [3]] },
    ]);
    expect(d).toEqual([good, { color: '#3a6757', width: 2.5, points: [[1, 1]] }]);
  });
});

describe('toLogical', () => {
  it('clamps to the canvas and rounds to 0.1 px', () => {
    expect(toLogical(-5, 9999)).toEqual([0, CANVAS_H]);
    expect(toLogical(CANVAS_W + 1, 12.345)).toEqual([CANVAS_W, 12.3]);
  });
});

describe('appendPoint', () => {
  it('skips points closer than the minimum distance', () => {
    const pts: [number, number][] = [[0, 0]];
    expect(appendPoint(pts, [0.5, 0.5])).toBe(false);
    expect(appendPoint(pts, [3, 4])).toBe(true);
    expect(pts).toEqual([[0, 0], [3, 4]]);
  });
});

describe('isBlank', () => {
  it('treats a drawing with only eraser strokes as blank', () => {
    expect(isBlank([])).toBe(true);
    expect(isBlank([{ color: ERASE, width: 12, points: [[1, 1]] }])).toBe(true);
    expect(isBlank([{ color: '#1f2027', width: 2.5, points: [[1, 1]] }])).toBe(false);
  });
});
