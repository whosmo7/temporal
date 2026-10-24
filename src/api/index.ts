import type { Backend } from './Backend';
import { LocalBackend } from './LocalBackend';
import { createOfflineBackend } from './offline';
import { SupabaseBackend } from './SupabaseBackend';

export type * from './Backend';

// UI code imports `backend` from here, never supabase-js.
// - VITE_OFFLINE=1: the offline demo fallback, with the demo world baked in (10).
// - Supabase env vars set: the real backend.
// - Otherwise: plain hot-seat LocalBackend (11 › .env.example).

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function pick(): Backend {
  if (import.meta.env.VITE_OFFLINE === '1') return createOfflineBackend();
  if (url && anonKey) return new SupabaseBackend(url, anonKey);
  return new LocalBackend();
}

export const backend: Backend = pick();

/**
 * The one backend the app talks to. `SupabaseBackend` replaces this once it exists (`07`);
 * the offline demo build keeps `LocalBackend`.
 */
export const backend: Backend = new LocalBackend();

export type * from './Backend';
