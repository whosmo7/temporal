// Seeded PRNG and hash (02 › Determinism). Worldgen built these first; the engine shares them so
// there is one implementation. The engine's own reducers need no randomness: events are fixed
// from the seed at createWorld.

export { createRng, hash } from '../worldgen/rng';
export type { HashPart, Rng } from '../worldgen/rng';
