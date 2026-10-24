import { Assets, type Spritesheet, type Texture } from 'pixi.js';

/**
 * Loads C's packed world atlas (`09`, built by `npm run atlas`). Frames it doesn't have yet keep
 * the painted placeholders, so this resolves to whatever is there and never blocks the world:
 * if the file is missing or fails to load, it resolves empty.
 */
export async function loadWorldAtlas(): Promise<Record<string, Texture>> {
  try {
    const sheet = await Assets.load<Spritesheet>(`${import.meta.env.BASE_URL}assets/atlas/world.json`);
    for (const tex of Object.values(sheet.textures)) tex.source.scaleMode = 'nearest';
    return sheet.textures;
  } catch (err) {
    console.warn('World atlas unavailable; using placeholder art.', err);
    return {};
  }
}
