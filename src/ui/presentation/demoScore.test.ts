import { describe, expect, it } from 'vitest';
import { scoreExample } from './demoScore';

describe('presentation scoring example', () => {
  it('lets surplus extraction pay while excessive extraction reduces the score', () => {
    const leave = scoreExample(0);
    const surplus = scoreExample(12);
    const empty = scoreExample(48);
    expect(surplus.score.total).toBeGreaterThan(leave.score.total);
    expect(empty.score.total).toBeLessThan(leave.score.total);
    expect(empty.score.corruption).toBeGreaterThan(surplus.score.corruption);
  });

  it('shows the successor’s reserves after upkeep and the shortfall from emptying the store', () => {
    expect(scoreExample(0).foodLeft).toBe(36);
    expect(scoreExample(12).foodLeft).toBe(24);
    expect(scoreExample(48).foodLeft).toBe(0);
    expect(scoreExample(48).shortfall).toBe(1);
  });

  it('can be reset without carrying over actions or scores', () => {
    const first = scoreExample(0);
    scoreExample(48);
    expect(scoreExample(0)).toEqual(first);
    expect(scoreExample(-1)).toEqual(first);
    expect(scoreExample(100)).toEqual(scoreExample(48));
  });
});
