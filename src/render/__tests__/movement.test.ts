import { describe, expect, it } from 'vitest';
import { buildCollision, generateMap, walkDistance } from '../../worldgen';
import { cameraOffset, pickZoom } from '../camera';
import { PLAYER_HITBOX } from '../constants';
import { hits, stepWalker, type CollisionGrid, type Walker } from '../movement';

/** 5×5 room: walls round the edge, open 3×3 middle. */
function room(): CollisionGrid {
  const width = 5;
  const height = 5;
  const blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (x === 0 || y === 0 || x === 4 || y === 4) blocked[y * width + x] = 1;
  return { width, height, blocked };
}

const at = (x: number, y: number): Walker => ({ x, y, facing: 'down', moving: false });

describe('stepWalker', () => {
  it('walks at the given speed and faces the way it moves', () => {
    const w = stepWalker(at(2.5, 2.9), { x: 1, y: 0 }, 2, 0.25, room());
    expect(w.x).toBeCloseTo(3.0);
    expect(w.y).toBe(2.9);
    expect(w.facing).toBe('right');
    expect(w.moving).toBe(true);
  });

  it('moves diagonally at the same speed as straight', () => {
    const w = stepWalker(at(2.5, 2.9), { x: 1, y: -1 }, 1, 0.5, room());
    expect(Math.hypot(w.x - 2.5, w.y - 2.9)).toBeCloseTo(0.5);
  });

  it('stops flush against a wall instead of entering it', () => {
    let w = at(2.5, 2.9);
    for (let i = 0; i < 100; i++) w = stepWalker(w, { x: 1, y: 0 }, 5, 1 / 60, room());
    expect(hits(w.x, w.y, room())).toBe(false);
    expect(w.x + PLAYER_HITBOX.w / 2).toBeCloseTo(4, 2);
    expect(w.moving).toBe(false);
    expect(w.facing).toBe('right');
  });

  it('slides along a wall when walking diagonally into it', () => {
    let w = at(3.6, 2.9);
    for (let i = 0; i < 10; i++) w = stepWalker(w, { x: 1, y: -1 }, 3, 1 / 60, room());
    expect(w.y).toBeLessThan(2.9);
    expect(hits(w.x, w.y, room())).toBe(false);
  });

  it('never leaves the map, even with no walls', () => {
    const open: CollisionGrid = { width: 3, height: 3, blocked: new Uint8Array(9) };
    let w = at(1.5, 1.5);
    for (let i = 0; i < 200; i++) w = stepWalker(w, { x: -1, y: -1 }, 6, 1 / 60, open);
    expect(w.x - PLAYER_HITBOX.w / 2).toBeGreaterThanOrEqual(0);
    expect(w.y - PLAYER_HITBOX.h).toBeGreaterThanOrEqual(0);
  });

  it('standing still is not moving', () => {
    expect(stepWalker(at(2.5, 2.9), { x: 0, y: 0 }, 5, 1, room())).toMatchObject({ x: 2.5, y: 2.9, moving: false });
  });

  it('the player spawns clear of every generated map and can walk off spawn', () => {
    for (const biome of ['forest', 'island'] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const map = generateMap(seed, biome);
        const grid = { width: map.width, height: map.height, blocked: buildCollision(map) };
        const start = at(map.spawn.x + 0.5, map.spawn.y + 0.9);
        expect(hits(start.x, start.y, grid), `${biome} ${seed}`).toBe(false);
        expect(walkDistance(map, grid.blocked).filter((d) => d > 0).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('camera', () => {
  it('zooms by whole device pixels', () => {
    expect(pickZoom(1280, 720, 1)).toBe(3);
    expect(pickZoom(1920, 1080, 1)).toBe(5);
    expect(pickZoom(1280, 720, 2) * 2).toBe(6); // 1440 device px tall / (13 tiles × 16) = 6.9
    expect(Number.isInteger(pickZoom(1536, 864, 1.25) * 1.25)).toBe(true);
    expect(pickZoom(200, 100, 1)).toBe(1);
  });

  it('centres on the focus and clamps at the map edge', () => {
    const view = { w: 800, h: 600 };
    const world = { w: 512, h: 512 };
    expect(cameraOffset({ x: 256, y: 256 }, view, world, 3, 1)).toEqual({ x: 400 - 768, y: 300 - 768 });
    expect(cameraOffset({ x: 0, y: 0 }, view, world, 3, 1)).toEqual({ x: 0, y: 0 });
    expect(cameraOffset({ x: 512, y: 512 }, view, world, 3, 1)).toEqual({ x: 800 - 1536, y: 600 - 1536 });
  });

  it('centres a map smaller than the view', () => {
    expect(cameraOffset({ x: 10, y: 10 }, { w: 1000, h: 800 }, { w: 100, h: 100 }, 2, 1)).toEqual({ x: 400, y: 300 });
  });
});
