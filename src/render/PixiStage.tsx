import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { TileMap } from '../worldgen';
import { loadWorldAtlas } from './atlas';
import { BACKGROUND } from './constants';
import { createWorldView, type WorldLook, type WorldView } from './world-view';

interface Props {
  map: TileMap;
  /** Visual stages to show; changes are applied without rebuilding the world. */
  look?: WorldLook;
  onReady?: (view: WorldView | null) => void;
}

/**
 * Owns one Pixi Application for the lifetime of the component. Init is async in Pixi 8, so an
 * unmount that lands mid-init (StrictMode does this on purpose) destroys the app once init ends.
 */
export function PixiStage({ map, look, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<WorldView | null>(null);
  const latestLook = useRef(look);
  latestLook.current = look;
  const latestOnReady = useRef(onReady);
  latestOnReady.current = onReady;

  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let ready = false;
    let disposed = false;

    void app
      .init({
        resizeTo: el,
        background: BACKGROUND,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        roundPixels: true,
      })
      .then(async () => {
        const art = await loadWorldAtlas();
        ready = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        el.appendChild(app.canvas);
        view.current = createWorldView(app, map, latestLook.current, art);
        latestOnReady.current?.(view.current);
      });

    return () => {
      disposed = true;
      if (!ready) return;
      latestOnReady.current?.(null);
      view.current?.destroy();
      view.current = null;
      app.destroy(true, { children: true });
    };
  }, [map]);

  useEffect(() => {
    if (look) view.current?.setLook(look);
  }, [look]);

  return <div ref={host} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
