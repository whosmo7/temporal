import { useEffect, useState, type RefObject } from 'react';
import { CANVAS_W } from './strokes';

/**
 * Keeps a canvas's backing store matched to its CSS size × devicePixelRatio, and returns the
 * logical-to-canvas scale to paint with. Re-renders when the element or the pixel ratio changes.
 */
export function useCanvasScale(ref: RefObject<HTMLCanvasElement | null>): number {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      setScale((cssW * dpr) / CANVAS_W);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [ref]);

  return scale;
}
