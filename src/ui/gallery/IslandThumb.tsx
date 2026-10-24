import { useEffect, useMemo, useRef } from 'react';
import { drawIslandMap, islandMap, islandSize, type Frames, type IslandInput } from './islandMap';

let atlas: Promise<{ sheet: HTMLImageElement; frames: Frames }> | null = null;

/** The world atlas, loaded once for every thumbnail on the page. */
function loadAtlas() {
  atlas ??= (async () => {
    const base = import.meta.env.BASE_URL;
    const sheet = new Image();
    sheet.src = `${base}assets/atlas/world.png`;
    const data = (await fetch(`${base}assets/atlas/world.json`).then((r) => r.json())) as { frames: Record<string, { frame: Frames[string] }> };
    await sheet.decode();
    return { sheet, frames: Object.fromEntries(Object.entries(data.frames).map(([k, v]) => [k, v.frame])) };
  })();
  return atlas;
}

/**
 * A completed world's last generation as a small floating island (06 › gallery). `width` is the
 * CSS width; the island is drawn at art scale and smoothed down to it.
 */
export function IslandThumb({ input, width = 256, label }: { input: IslandInput; width?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useMemo(() => islandMap(input), [input]);
  const size = islandSize(map);

  useEffect(() => {
    let live = true;
    loadAtlas()
      .then(({ sheet, frames }) => {
        const ctx = canvas.current?.getContext('2d');
        if (live && ctx) drawIslandMap(ctx, sheet, frames, map, input);
      })
      .catch((err: unknown) => console.warn('Gallery island art unavailable.', err));
    return () => {
      live = false;
    };
  }, [map, input]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      className="island-thumb"
      width={size.w}
      height={size.h}
      style={{ width, height: (width * size.h) / size.w }}
    />
  );
}
