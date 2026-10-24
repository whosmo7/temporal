// Types for engine.js, the esbuild bundle of src/api/runTurn.ts (scripts/bundle-engine.ts).
// tsc resolves `../_shared/engine.js` to this file, so it type-checks even before the bundle is built.
export * from '../../../src/api/runTurn';
export type { ActionEntry } from '../../../src/engine/types';
