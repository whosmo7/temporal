import { describe, expect, it } from 'vitest';
import { facedSpot, facedTile } from '../../../render/interact';
import { buildCollision, isWalkable } from '../../../worldgen';
import { SHOT_TILES, tutorialMap, tutorialScenes } from '../scenes';

describe('How to play scenes', () => {
  const map = tutorialMap();
  const scenes = tutorialScenes(map);
  const grid = buildCollision(map);
  const walker = (key: string) => ({ ...scenes.find((s) => s.key === key)!.still.player, moving: false });

  it('are sow and water, fill the can, harvest, eat, in that order, each with its prompt', () => {
    expect(scenes.map((s) => `${s.key}: E ${s.prompt.text}`)).toEqual([
      'sow: E Water',
      'fill: E Fill the can',
      'harvest: E Harvest',
      'eat: E Cook and eat',
    ]);
  });

  it('stand the player on walkable ground, facing what the picture is about', () => {
    for (const s of scenes) expect(isWalkable(map, grid, Math.floor(s.still.player.x), Math.floor(s.still.player.y))).toBe(true);
    expect(facedTile(map, walker('sow'))).toBe('field-1:1,0');
    expect(facedTile(map, walker('harvest'))).toBe('field-1:1,0');
    expect(facedSpot(map, walker('fill'))).toBe('water');
    expect(facedSpot(map, walker('eat'))).toBe('oven');
  });

  it('show the faced tile sown before watering, and ripe next to rotten for the harvest', () => {
    const [sow, , harvest] = scenes;
    expect(sow!.look.plots['field-1:1,0']).toBe('sown');
    expect(sow!.look.plots['field-1:0,0']).toBe('watered');
    expect(harvest!.look.plots['field-1:1,0']).toBe('ripe');
    expect(harvest!.look.plots['field-1:2,0']).toBe('rotten');
  });

  it('frame the same number of tiles in every picture, the kitchen showing the whole house', () => {
    for (const s of scenes) expect([s.still.frame.w, s.still.frame.h]).toEqual([SHOT_TILES.w, SHOT_TILES.h]);
    const house = map.house!;
    const kitchen = scenes[3]!.still.frame;
    expect(kitchen.x).toBeLessThanOrEqual(house.x);
    expect(kitchen.x + kitchen.w).toBeGreaterThanOrEqual(house.x + house.w);
  });
});
