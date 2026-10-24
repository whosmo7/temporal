import { describe, expect, it } from 'vitest';
import { generateMap } from '../../../worldgen';
import { islandSize } from '../islandMap';

describe('gallery island', () => {
  it('crops to the land inside the boundary, with room for canopies and the cliff', () => {
    for (const biome of ['forest', 'island'] as const) {
      const map = generateMap(5, biome, 'default');
      const { w, h, box } = islandSize(map);
      expect(box.w).toBeLessThan(map.width);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const outside = x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h;
          if (outside) expect(map.layers.boundary[y * map.width + x]).not.toBeNull();
        }
      }
      expect(w).toBe(box.w * 16);
      expect(h).toBeGreaterThan(box.h * 16);
    }
  });
});
