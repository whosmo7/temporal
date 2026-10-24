import { hash, type HashPart } from './rng';

export type Noise2D = (x: number, y: number) => number;

/**
 * Seeded 2D value noise in [0, 1). Lattice values come from `hash(seed, tag, ix, iy)`, so the
 * same seed and tag always give the same field, with no state.
 */
export function valueNoise(seed: number, tag: HashPart): Noise2D {
  const base = hash(seed, tag);
  const lattice = (ix: number, iy: number) => hash(base, ix, iy) / 0x100000000;
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const top = lerp(lattice(ix, iy), lattice(ix + 1, iy), fx);
    const bottom = lerp(lattice(ix, iy + 1), lattice(ix + 1, iy + 1), fx);
    return lerp(top, bottom, fy);
  };
}

export interface FbmOptions {
  /** Lattice cells per tile at the first octave. Smaller = broader features. */
  frequency: number;
  octaves: number;
  /** Amplitude multiplier per octave. */
  persistence?: number;
}

/** Fractal (layered) value noise, normalised back to [0, 1). */
export function fbm(seed: number, tag: HashPart, opts: FbmOptions): Noise2D {
  const persistence = opts.persistence ?? 0.5;
  const layers = Array.from({ length: opts.octaves }, (_, i) => valueNoise(seed, `${tag}:${i}`));
  let total = 0;
  for (let i = 0, amp = 1; i < opts.octaves; i++, amp *= persistence) total += amp;
  return (x, y) => {
    let sum = 0;
    let freq = opts.frequency;
    let amp = 1;
    for (const layer of layers) {
      sum += layer(x * freq, y * freq) * amp;
      freq *= 2;
      amp *= persistence;
    }
    return sum / total;
  };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
