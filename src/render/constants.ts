/** Art pixels per tile. Follows the asset pack (`09`); 16 until C picks one. */
export const TILE = 16;

/** Player walk speed in tiles per second. */
export const WALK_SPEED = 4.5;

/** Roughly how many tiles the camera should show across and down; zoom is the largest integer that fits. */
export const VIEW_TILES = { x: 22, y: 13 } as const;

/** Inside the house the camera zooms in until about this many tiles fit (the 7×5 house plus a margin). */
export const VIEW_TILES_INSIDE = { x: 11, y: 8 } as const;

/** Fixed simulation step for movement, in seconds. */
export const FIXED_STEP = 1 / 60;

/** Player collision box at the feet, in tiles. */
export const PLAYER_HITBOX = { w: 0.6, h: 0.35 } as const;

export const BACKGROUND = 0x101418;
