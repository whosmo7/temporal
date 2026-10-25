import { Application, Rectangle } from 'pixi.js';
import type { TileMap } from '../worldgen';
import { loadWorldAtlas } from './atlas';
import { BACKGROUND } from './constants';
import { createWorldView, type ReplayMode, type WorldLook } from './world-view';

/**
 * Draws one still shot of a world off-screen and returns it as a PNG data URL (the tutorial's
 * pictures). It uses the game's own renderer, so the shots keep up with the art. Each shot has
 * its own short-lived Pixi app, so only one extra WebGL context is open at a time.
 */
export async function snapshot(
  map: TileMap,
  look: WorldLook,
  still: ReplayMode,
  size: { w: number; h: number },
): Promise<string> {
  const app = new Application();
  await app.init({
    width: size.w,
    height: size.h,
    background: BACKGROUND,
    antialias: false,
    resolution: 1, // whole art pixels; the page scales the image up with `image-rendering: pixelated`
    roundPixels: true,
    autoStart: false,
  });
  try {
    const art = await loadWorldAtlas();
    const view = createWorldView(app, map, look, art, still);
    app.ticker.update(); // one frame: the still camera, the light
    app.render();
    const canvas = app.renderer.extract.canvas({ target: app.stage, frame: new Rectangle(0, 0, size.w, size.h) });
    const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
    view.destroy();
    return url;
  } finally {
    app.destroy(true, { children: true });
  }
}
