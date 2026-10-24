import { Container, Graphics } from 'pixi.js';
import { TILE } from './constants';

/** Ambient effects that come from the world's look, not from actions (harvest pops and splashes come with `applyAction`). */
export interface Fx {
  layer: Container;
  /** Blight motes drift while the world is weakened. */
  setMotes(on: boolean): void;
  /** Flies circle these spots (world px): rotten fields, a rotting store. */
  setFlies(spots: { x: number; y: number }[]): void;
  /** `centre` is the camera's focus in world px, so motes stay in view. */
  update(dt: number, centre: { x: number; y: number }): void;
  destroy(): void;
}

const MOTES = 36;
/** Motes live in a box this many tiles across, centred on the camera, and wrap at its edges. */
const MOTE_FIELD = { w: 30, h: 18 };

export function createFx(): Fx {
  const layer = new Container();
  const motes = Array.from({ length: MOTES }, (_, i) => {
    const g = new Graphics().rect(0, 0, 2, 2).fill(i % 3 === 0 ? 0xf2b84b : 0xfccca7);
    g.alpha = 0;
    layer.addChild(g);
    // Spread with a fixed golden-ratio sequence: even coverage, no randomness needed.
    return { g, fx: (i * 0.618) % 1, fy: (i * 0.382 + 0.5) % 1, phase: i * 1.7, speed: 0.15 + (i % 5) * 0.04 };
  });
  let motesOn = false;
  let motesAlpha = 0;

  const flyLayer = new Container();
  layer.addChild(flyLayer);
  let flies: { g: Graphics; cx: number; cy: number; r: number; phase: number; speed: number }[] = [];
  let time = 0;

  return {
    layer,
    setMotes: (on) => {
      motesOn = on;
    },
    setFlies: (spots) => {
      flyLayer.removeChildren().forEach((c) => c.destroy());
      flies = spots.flatMap((s, si) =>
        [0, 1, 2].map((k) => {
          const g = new Graphics().rect(0, 0, 1, 1).fill(0x1f2027);
          flyLayer.addChild(g);
          return { g, cx: s.x, cy: s.y, r: 4 + k * 3, phase: si * 2.1 + k * 2.4, speed: 2.5 + k * 0.9 };
        }),
      );
    },
    update: (dt, centre) => {
      time += dt;
      motesAlpha += ((motesOn ? 1 : 0) - motesAlpha) * Math.min(1, dt * 1.5);
      const w = MOTE_FIELD.w * TILE;
      const h = MOTE_FIELD.h * TILE;
      for (const m of motes) {
        m.fx = (m.fx + dt * m.speed * 0.02) % 1;
        m.fy = (m.fy - dt * m.speed * 0.012 + 1) % 1;
        // Each mote has a fixed world position on a repeating w×h grid; show the copy inside the field.
        const left = centre.x - w / 2;
        const top = centre.y - h / 2;
        const x = left + wrap(m.fx * w - left, w);
        const y = top + wrap(m.fy * h - top, h);
        m.g.position.set(Math.round(x + Math.sin(time * 0.7 + m.phase) * 3), Math.round(y));
        m.g.alpha = motesAlpha * (0.45 + 0.35 * Math.sin(time * 1.3 + m.phase));
      }
      for (const f of flies) {
        const a = time * f.speed + f.phase;
        f.g.position.set(Math.round(f.cx + Math.cos(a) * f.r), Math.round(f.cy + Math.sin(a * 1.3) * f.r * 0.5));
      }
    },
    destroy: () => layer.destroy({ children: true }),
  };
}

function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}
