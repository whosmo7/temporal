// Types for engine.js, the esbuild bundle of src/api/edge.ts (scripts/bundle-engine.ts).
// tsc resolves `../_shared/engine.js` to this file, so it type-checks even before the bundle is built.
export * from '../../../src/api/edge';
export type { ActionEntry, WorldState } from '../../../src/engine/types';
