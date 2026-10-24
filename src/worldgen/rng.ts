// Seeded randomness for worldgen. Self-contained until the `02` engine PRNG lands; A can swap
// `createRng` / `hash` for the engine versions as long as the outputs stay deterministic.
// Never use Math.random here (see inheritance-engine).

export type HashPart = number | string;

/** Mixes any number of parts into a uint32. Strings are folded in char by char. */
export function hash(...parts: HashPart[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    if (typeof part === 'number') {
      h = mix(h ^ (part | 0));
      // Keep the fractional part significant, so 0.25 and 0.5 hash differently.
      h = mix(h ^ Math.floor((part - Math.floor(part)) * 0x100000000));
    } else {
      for (let i = 0; i < part.length; i++) h = mix(h ^ part.charCodeAt(i));
      h = mix(h ^ part.length);
    }
  }
  return h >>> 0;
}

/** murmur3 finaliser: avalanches a 32-bit value. */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  return {
    next,
    int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick on empty list');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}

/**
 * An independent stream per generation stage, so changing one preset knob (say deco density)
 * doesn't move the plots.
 */
export function deriveRng(seed: number, ...tags: HashPart[]): Rng {
  return createRng(hash(seed, ...tags));
}
