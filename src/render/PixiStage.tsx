import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { TileMap } from '../worldgen';
import { BACKGROUND } from './constants';
import { createWorldView } from './world-view';

/**
 * Owns one Pixi Application for the lifetime of the component. Init is async in Pixi 8, so an
 * unmount that lands mid-init (StrictMode does this on purpose) destroys the app once init ends.
 */
export function PixiStage({ map }: { map: TileMap }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let ready = false;
    let disposed = false;
    let view: ReturnType<typeof createWorldView> | null = null;

    void app
      .init({
        resizeTo: el,
        background: BACKGROUND,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        roundPixels: true,
      })
      .then(() => {
        ready = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        el.appendChild(app.canvas);
        view = createWorldView(app, map);
      });

    return () => {
      disposed = true;
      if (!ready) return;
      view?.destroy();
      app.destroy(true, { children: true });
    };
  }, [map]);

  return <div ref={host} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
