import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHeartbeat } from '../heartbeat';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('heartbeat', () => {
  it('beats at once and then every minute until stopped', async () => {
    const beat = vi.fn(async () => '2026-10-24T22:00:00Z');
    const stop = startHeartbeat(beat, () => {});
    expect(beat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000 * 3);
    expect(beat).toHaveBeenCalledTimes(4);
    stop();
    await vi.advanceTimersByTimeAsync(60_000 * 3);
    expect(beat).toHaveBeenCalledTimes(4);
  });

  it('stops and reports a voided turn once', async () => {
    const beat = vi.fn(async () => null);
    const voided = vi.fn();
    startHeartbeat(beat, voided);
    await vi.advanceTimersByTimeAsync(60_000 * 3);
    expect(voided).toHaveBeenCalledTimes(1);
    expect(beat).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a beat fails', async () => {
    let n = 0;
    const beat = vi.fn(async () => {
      if (n++ === 0) throw new Error('Failed to fetch');
      return '2026-10-24T22:00:00Z';
    });
    const voided = vi.fn();
    startHeartbeat(beat, voided);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(beat).toHaveBeenCalledTimes(2);
    expect(voided).not.toHaveBeenCalled();
  });

  it('ignores an answer that arrives after it was stopped', async () => {
    let answer!: (v: string | null) => void;
    const voided = vi.fn();
    const stop = startHeartbeat(() => new Promise((r) => (answer = r)), voided);
    stop();
    answer(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(voided).not.toHaveBeenCalled();
  });
});
