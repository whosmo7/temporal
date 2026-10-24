import type { Backend } from './Backend';
import { seedDemo, type DemoAccounts } from './demo';
import { LocalBackend } from './LocalBackend';

// Offline demo fallback (10): `VITE_OFFLINE=1 npm run build`, then `npm run preview` on the demo
// laptop. A hot-seat LocalBackend whose first load plays the demo world's founder generations,
// so the judge can sign in as `judge` / `demo` and inherit the same world as on the live site.

export const OFFLINE_PASSWORD = 'demo';
const STORAGE_KEY = 'inheritance.offline';

function localAccounts(backend: LocalBackend): DemoAccounts {
  const as = async (username: string) => {
    await backend
      .signIn(username, OFFLINE_PASSWORD)
      .catch(() => backend.signUp(username, OFFLINE_PASSWORD));
    return backend;
  };
  return { as, admin: () => as('admin') };
}

/** Seeds the demo world into an empty store. Reset by clearing site data (or `inheritance.offline`). */
export async function seedOffline(backend: LocalBackend): Promise<void> {
  if ((await backend.listAllWorlds()).length > 0) return;
  await seedDemo(localAccounts(backend));
  await backend.signOut();
}

export function createOfflineBackend(): Backend {
  const local = new LocalBackend({ storageKey: STORAGE_KEY });
  const ready = seedOffline(local);
  // Every call waits for the seed, so the UI can use it straight away.
  return new Proxy(local, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        await ready;
        return value.apply(target, args);
      };
    },
  });
}
