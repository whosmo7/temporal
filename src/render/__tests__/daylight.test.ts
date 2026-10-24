import { describe, expect, it } from 'vitest';
import { beginTurn, createWorld } from '../../engine';
import { generateMap } from '../../worldgen';
import { useGameStore } from '../../store/game';
import { clockLabel, gameHour, isNight, lightAt } from '../daylight';
import { nearbyPlot } from '../interact';

describe('game clock', () => {
  it('runs one day, 6 am to 6 am, over the turn', () => {
    expect(gameHour(0, 600)).toBe(6);
    expect(gameHour(150, 600)).toBe(12);
    expect(gameHour(300, 600)).toBe(18);
    expect(gameHour(450, 600)).toBe(24);
    expect(gameHour(600, 600)).toBe(30);
    expect(gameHour(9999, 600)).toBe(30);
  });

  it('shows 12-hour time in 10-minute steps', () => {
    expect(clockLabel(6)).toBe('6:00 AM');
    expect(clockLabel(12)).toBe('12:00 PM');
    expect(clockLabel(13.5)).toBe('1:30 PM');
    expect(clockLabel(6 + 7 / 60)).toBe('6:00 AM');
    expect(clockLabel(24)).toBe('12:00 AM');
    expect(clockLabel(29.99)).toBe('5:50 AM');
  });

  it('is light by day and dark at night, with dawn and dusk between', () => {
    expect(lightAt(12)).toEqual({ tint: 0xffffff, darkness: 0, shade: 0x404363 });
    expect(lightAt(24).darkness).toBeGreaterThan(0.5);
    expect(lightAt(6).darkness).toBeGreaterThan(0);
    expect(lightAt(6).darkness).toBeLessThan(lightAt(24).darkness);
    expect(lightAt(18).darkness).toBeGreaterThan(0);
    expect(lightAt(18).darkness).toBeLessThan(lightAt(22).darkness);
    expect(isNight(12)).toBe(false);
    expect(isNight(20)).toBe(true);
    expect(isNight(29)).toBe(true);
    expect(isNight(30)).toBe(false); // time-up, 6 am
  });

  it('freezes while the journal is open and stops at time-up', () => {
    const s = useGameStore.getState();
    s.loadTurn(beginTurn(createWorld(1, { worldId: 'w', turnSeconds: 600 }).state).state, 'AL');
    s.advance(10);
    expect(useGameStore.getState().t).toBe(10);
    s.setJournalOpen(true);
    s.advance(100);
    expect(useGameStore.getState().t).toBe(10);
    s.setJournalOpen(false);
    s.advance(1000);
    expect(useGameStore.getState().t).toBe(600);
  });
});

describe('nearbyPlot', () => {
  it('finds the lectern when standing next to it, and nothing out in the open', () => {
    const map = generateMap(123, 'forest');
    const lectern = map.plots.find((p) => p.kind === 'lectern')!;
    const below = { x: lectern.x + 0.5, y: lectern.y + 1.9, facing: 'up' as const, moving: false };
    expect(nearbyPlot(map, below)).toBe('lectern');
    const far = { x: lectern.x + 0.5, y: lectern.y + 4.9, facing: 'up' as const, moving: false };
    expect(nearbyPlot(map, far)).not.toBe('lectern');
  });

  it('prefers the plot the player is facing', () => {
    const map = {
      ...generateMap(1, 'forest'),
      plots: [
        { id: 'a', kind: 'well' as const, x: 4, y: 5, w: 1, h: 1 },
        { id: 'b', kind: 'lectern' as const, x: 6, y: 5, w: 1, h: 1 },
      ],
    };
    const between = { x: 5.5, y: 5.9, moving: false };
    expect(nearbyPlot(map, { ...between, facing: 'left' })).toBe('a');
    expect(nearbyPlot(map, { ...between, facing: 'right' })).toBe('b');
  });
});
