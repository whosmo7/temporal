import { useEffect, useRef, type PointerEvent } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  ERASE,
  ERASER_WIDTH,
  PEN_WIDTH,
  appendPoint,
  paintStrokes,
  toLogical,
  type Drawing,
  type Stroke,
} from './strokes';
import { useCanvasScale } from './useCanvas';

/**
 * The sketch box. The parent owns the strokes (for undo and clear); this only turns a pointer
 * drag into one new stroke and hands it back when the pen lifts.
 */
export function DrawingCanvas({
  drawing,
  color,
  disabled,
  onStroke,
  width = CANVAS_W,
}: {
  drawing: Drawing;
  /** A pen colour or `ERASE`. */
  color: string;
  disabled?: boolean;
  onStroke: (stroke: Stroke) => void;
  width?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const frame = useRef(0);
  const scale = useCanvasScale(ref);
  // Read through a ref so a frame queued during a drag never paints a stale stroke list.
  const latest = useRef({ drawing, scale });
  latest.current = { drawing, scale };

  const repaint = () => {
    const ctx = ref.current?.getContext('2d');
    const { drawing: strokes, scale: s } = latest.current;
    if (!ctx || s <= 0) return;
    paintStrokes(ctx, live.current ? [...strokes, live.current] : strokes, s);
  };

  useEffect(repaint);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const pointAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return toLogical(((e.clientX - r.left) / r.width) * CANVAS_W, ((e.clientY - r.top) / r.height) * CANVAS_H);
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // No capture (unusual pointer); the stroke still works while the pointer stays inside.
    }
    live.current = { color, width: color === ERASE ? ERASER_WIDTH : PEN_WIDTH, points: [pointAt(e)] };
    repaint();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const stroke = live.current;
    if (!stroke) return;
    // Coalesced events keep fast curves smooth on high-rate mice.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    let added = false;
    for (const ev of events) {
      const r = e.currentTarget.getBoundingClientRect();
      const p = toLogical(((ev.clientX - r.left) / r.width) * CANVAS_W, ((ev.clientY - r.top) / r.height) * CANVAS_H);
      added = appendPoint(stroke.points, p) || added;
    }
    if (added) {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(repaint);
    }
  };

  const finish = () => {
    cancelAnimationFrame(frame.current);
    const stroke = live.current;
    live.current = null;
    if (stroke) onStroke(stroke);
  };

  return (
    <canvas
      ref={ref}
      className={`sketch__canvas${color === ERASE ? ' sketch__canvas--erase' : ''}`}
      aria-label="Sketch box. Draw with the mouse."
      aria-disabled={disabled || undefined}
      style={{ width, height: (width * CANVAS_H) / CANVAS_W }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    />
  );
}
