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

/** Weakened start (soft fail): the player walks this much slower (`04` › visual state). */
export const WEAKENED_WALK = 0.75;

/** Radius of the player's light at night, in tiles. */
export const NIGHT_LIGHT_TILES = 3.5;

/** Night is this much darker outdoors than in the lamp-lit house. */
export const INDOOR_DARKNESS = 0.3;

/** Replay ghosts (decision 038): real seconds a generation's day takes when nothing else sets it, and the fade before it starts again. */
export const GHOST_DAY_SECONDS = 12;
export const GHOST_FADE_SECONDS = 1.5;
/** How solid a ghost is at most, and its cool tint (multiplied in), so it reads against grass. */
export const GHOST_ALPHA = 0.7;
export const GHOST_TINT = 0x9cb8ff;
