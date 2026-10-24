import type { Backend } from './Backend';
import { LocalBackend } from './LocalBackend';

/**
 * The one backend the app talks to. `SupabaseBackend` replaces this once it exists (`07`);
 * the offline demo build keeps `LocalBackend`.
 */
export const backend: Backend = new LocalBackend();

export type * from './Backend';
