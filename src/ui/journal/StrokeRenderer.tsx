import { useEffect, useRef } from 'react';
import { CANVAS_H, CANVAS_W, paintStrokes, type Drawing } from './strokes';
import { useCanvasScale } from './useCanvas';

/**
 * Draws a sealed drawing, read-only, at any size (keeps the 320×200 aspect). The one renderer for
 * journal pages, the replay's journal panel (`06`) and gallery thumbnails.
 */
export function StrokeRenderer({
  drawing,
  width = CANVAS_W,
  label,
  className,
}: {
  drawing: Drawing;
  /** CSS width in px; height follows the canvas aspect. */
  width?: number;
  /** Accessible description, e.g. "Sketch by al". */
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = useCanvasScale(ref);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx && scale > 0) paintStrokes(ctx, drawing, scale);
  }, [drawing, scale]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={className}
      style={{ width, height: (width * CANVAS_H) / CANVAS_W, display: 'block', imageRendering: 'auto' }}
    />
  );
}
