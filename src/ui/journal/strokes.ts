/**
 * Journal drawings as stroke JSON on a fixed logical canvas (`05` › Storage format). Small, crisp
 * at any scale, and replayable stroke by stroke. One renderer (`paintStrokes`) draws them for the
 * journal, the replay and gallery thumbnails.
 */

export const CANVAS_W = 320;
export const CANVAS_H = 200;

/** Stroke colour that rubs out what's under it instead of drawing. */
export const ERASE = 'erase';

export const PEN_WIDTH = 2.5;
export const ERASER_WIDTH = 12;

export interface Stroke {
  /** A `#rrggbb` colour, or `ERASE`. */
  color: string;
  width: number;
  /** Logical canvas coordinates, 0..CANVAS_W × 0..CANVAS_H. */
  points: [number, number][];
}

export type Drawing = Stroke[];

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Reads a stored drawing defensively. Pages come from the server or an old local copy, so any
 * malformed stroke is dropped rather than breaking the whole page.
 */
export function asDrawing(value: unknown): Drawing {
  if (!Array.isArray(value)) return [];
  const out: Drawing = [];
  for (const s of value) {
    if (!s || typeof s !== 'object') continue;
    const { color, width, points } = s as Partial<Stroke>;
    if (typeof color !== 'string' || !(color === ERASE || HEX.test(color))) continue;
    if (typeof width !== 'number' || !(width > 0 && width <= 40)) continue;
    if (!Array.isArray(points) || points.length === 0) continue;
    const pts = points.filter(
      (p): p is [number, number] =>
        Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
    if (pts.length) out.push({ color, width, points: pts });
  }
  return out;
}

/** Clamps a point to the canvas and rounds it to 0.1 px, which keeps the JSON short. */
export function toLogical(x: number, y: number): [number, number] {
  const cx = Math.min(CANVAS_W, Math.max(0, x));
  const cy = Math.min(CANVAS_H, Math.max(0, y));
  return [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10];
}

/** Adds a point unless it's within `minDist` of the last one, so a slow hand doesn't bloat the page. */
export function appendPoint(points: [number, number][], p: [number, number], minDist = 1): boolean {
  const last = points[points.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minDist) return false;
  points.push(p);
  return true;
}

export function isBlank(drawing: Drawing): boolean {
  return !drawing.some((s) => s.color !== ERASE);
}

/**
 * Draws strokes onto a transparent 2D context. `scale` maps logical px to canvas px (include the
 * devicePixelRatio). Erasing uses destination-out, so the canvas must sit over the paper, not
 * contain it.
 */
export function paintStrokes(ctx: CanvasRenderingContext2D, drawing: Drawing, scale: number) {
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of drawing) {
    ctx.globalCompositeOperation = s.color === ERASE ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.color === ERASE ? '#000' : s.color;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = s.width * scale;
    const pts = s.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0] * scale, pts[0][1] * scale, (s.width * scale) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Quadratic curves through the midpoints: smooth like a pen, without moving any point.
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * scale;
      const my = ((pts[i][1] + pts[i + 1][1]) / 2) * scale;
      ctx.quadraticCurveTo(pts[i][0] * scale, pts[i][1] * scale, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0] * scale, last[1] * scale);
    ctx.stroke();
  }
  ctx.restore();
}
