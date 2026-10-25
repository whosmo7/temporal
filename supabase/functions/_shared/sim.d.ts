// Types for sim.js, the esbuild bundle of scripts/llm/edge.ts (scripts/bundle-engine.ts).
// tsc resolves `../_shared/sim.js` to this file, so it type-checks even before the bundle is built.
export * from '../../../scripts/llm/edge';
export type { WorldState } from '../../../src/engine/types';
