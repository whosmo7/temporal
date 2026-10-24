import { create } from 'zustand';
import { backend, type Profile } from '../api';

/**
 * Who is signed in. `status` is 'loading' until the stored session has been read once, so
 * guarded routes don't bounce a signed-in player to the login page on refresh.
 */
export interface SessionStore {
  user: Profile | null;
  status: 'loading' | 'ready';

  /** Reads the stored session. Safe to call more than once. */
  restore(): Promise<void>;
  signIn(username: string, password: string): Promise<void>;
  signUp(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export const useSession = create<SessionStore>((set) => ({
  user: null,
  status: 'loading',

  async restore() {
    const user = await backend.currentUser().catch(() => null);
    set({ user, status: 'ready' });
  },
  async signIn(username, password) {
    set({ user: await backend.signIn(username, password), status: 'ready' });
  },
  async signUp(username, password) {
    set({ user: await backend.signUp(username, password), status: 'ready' });
  },
  async signOut() {
    await backend.signOut();
    set({ user: null });
  },
}));

/** Same rule as `profiles.username` in the schema. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
/** Supabase Auth's default minimum. */
export const PASSWORD_MIN = 6;
