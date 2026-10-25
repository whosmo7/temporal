// The four "How to play" scenes: where to stand in a fixed tutorial world, facing what, and what
// the ground looks like there. Pure, so a test checks each one faces what its caption says.

import { tileId, type PlotId } from '../../engine';
import type { Facing } from '../../render/movement';
import { founderLook, type ReplayMode, type WorldLook } from '../../render/world-view';
import { buildCollision, generateMap, isWalkable, walkDistance, type TileMap } from '../../worldgen';
import { promptLabel } from '../hud/copy';
import type { PromptRow } from '../hud/InteractPrompt';
import { TUTORIAL_TEXT } from './copy';

/** Every scene comes from this world, so the pictures are the same for everyone. */
export const TUTORIAL_SEED = 123;

/** Each picture shows this many tiles round the player. */
export const SHOT_TILES = { w: 8, h: 5 } as const;

export interface Scene {
  key: keyof typeof TUTORIAL_TEXT;
  title: string;
  text: string;
  /** The prompt the player would see there. */
  prompt: PromptRow;
  look: WorldLook;
  still: Required<Pick<ReplayMode, 'frame' | 'player'>> & Pick<ReplayMode, 'mark'>;
}

const STEP: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function tutorialMap(): TileMap {
  return generateMap(TUTORIAL_SEED, 'forest');
}

export function tutorialScenes(map: TileMap = tutorialMap()): Scene[] {
  const field = map.plots.find((p) => p.id === 'field-1');
  const oven = map.house?.furniture.find((f) => f.kind === 'oven');
  if (!field || field.w < 3 || field.h < 2 || !oven) throw new Error('The tutorial world needs a 3-wide field and a house');

  // On the field's second row, facing the middle tile of the first (fields are walked on).
  const onField = { x: field.x + 1, y: field.y + 1, facing: 'up' as const };
  const faced = tileId(field.id, 1, 0);
  const row = (stages: [string, string, string]): WorldLook => {
    const look = founderLook(map);
    stages.forEach((stage, x) => (look.plots[tileId(field.id, x, 0)] = stage));
    return look;
  };
  const scene = (
    key: Scene['key'],
    look: WorldLook,
    at: { x: number; y: number; facing: Facing },
    label: string,
    mark?: PlotId,
  ): Scene => ({
    key,
    ...TUTORIAL_TEXT[key],
    prompt: { keyLabel: 'E', text: label },
    look,
    still: { frame: around(at), player: feet(at), ...(mark ? { mark } : {}) },
  });

  const house = map.house!;
  const kitchen = { x: oven.x, y: oven.y + 1, facing: 'up' as const };
  return [
    scene('sow', row(['watered', 'sown', 'empty']), onField, promptLabel('water', 'field', map.biome), faced),
    scene('fill', founderLook(map), pondEdge(map, field), promptLabel('fillCan', 'well', map.biome)),
    scene('harvest', row(['ripe', 'ripe', 'rotten']), onField, promptLabel('harvest', 'field', map.biome), faced),
    {
      ...scene('eat', { ...founderLook(map), store: 'full' }, kitchen, promptLabel('eat', 'field', map.biome)),
      // The whole room, roof off.
      still: { frame: { x: house.x - (SHOT_TILES.w - house.w) / 2, y: house.y, w: SHOT_TILES.w, h: SHOT_TILES.h }, player: feet(kitchen) },
    },
  ];
}

/** A walkable tile next to a pond, reachable from the house, nearest the field; facing the water. */
export function pondEdge(map: TileMap, near: { x: number; y: number }): { x: number; y: number; facing: Facing } {
  const grid = buildCollision(map);
  const reach = walkDistance(map, grid);
  let best: { x: number; y: number; facing: Facing; d: number } | null = null;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isWalkable(map, grid, x, y) || reach[y * map.width + x]! < 0) continue;
      for (const facing of Object.keys(STEP) as Facing[]) {
        const wx = x + STEP[facing].x;
        const wy = y + STEP[facing].y;
        if (wx < 0 || wy < 0 || wx >= map.width || wy >= map.height) continue;
        if (map.layers.terrain[wy * map.width + wx] !== 'water') continue;
        const d = Math.hypot(x - near.x, y - near.y);
        if (!best || d < best.d) best = { x, y, facing, d };
      }
    }
  }
  if (!best) throw new Error('The tutorial world needs a pond');
  return { x: best.x, y: best.y, facing: best.facing };
}

/** Where the player's feet go to stand on a tile (as the game spawns them). */
function feet(at: { x: number; y: number; facing: Facing }) {
  return { x: at.x + 0.5, y: at.y + 0.9, facing: at.facing };
}

/** The picture's tiles, centred on the player. */
function around(at: { x: number; y: number }) {
  return { x: at.x + 0.5 - SHOT_TILES.w / 2, y: at.y + 0.5 - SHOT_TILES.h / 2, w: SHOT_TILES.w, h: SHOT_TILES.h };
}
