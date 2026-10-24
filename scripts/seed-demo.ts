// Seeds the demo world (10) on the live project: the founder generations from
// src/api/demo-world.json, played through claim_world → commit-turn like real players, then
// force-assigned to the judge. Also makes an unassigned spare copy.
//
//   ADMIN_USERNAME=... ADMIN_PASSWORD=... DEMO_PASSWORD=... npx tsx --env-file=.env.local scripts/seed-demo.ts
//
// ADMIN_* is an existing admin account (profiles.is_admin). Founder and judge accounts are created
// with DEMO_PASSWORD if they don't exist yet. Run it the morning of judging (10 › Seeding).

import type { Backend } from '../src/api/Backend';
import { DEMO, seedDemo, type DemoAccounts } from '../src/api/demo';
import { SupabaseBackend } from '../src/api/SupabaseBackend';
import { worldName } from '../src/worldgen/names';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const { ADMIN_USERNAME, ADMIN_PASSWORD, DEMO_PASSWORD } = process.env;
if (!url || !anonKey || !ADMIN_USERNAME || !ADMIN_PASSWORD || !DEMO_PASSWORD) {
  throw new Error(
    'Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ADMIN_USERNAME, ADMIN_PASSWORD and DEMO_PASSWORD',
  );
}

// One client per account, so each keeps its own session.
const sessions = new Map<string, Backend>();
async function signedIn(username: string, password: string): Promise<Backend> {
  const existing = sessions.get(username);
  if (existing) return existing;
  const backend = new SupabaseBackend(url!, anonKey!);
  await backend.signIn(username, password).catch(() => backend.signUp(username, password));
  sessions.set(username, backend);
  return backend;
}

const accounts: DemoAccounts = {
  as: (username) => signedIn(username, DEMO_PASSWORD),
  admin: async () => {
    const admin = await signedIn(ADMIN_USERNAME, ADMIN_PASSWORD);
    if (!(await admin.currentUser())?.isAdmin) throw new Error(`${ADMIN_USERNAME} is not an admin`);
    return admin;
  },
};

const name = worldName(DEMO.world.seed, DEMO.world.biome);
const main = await seedDemo(accounts);
console.log(`demo world  ${name}  ${main}  → force-assigned to ${DEMO.judge}`);
const spare = await seedDemo(accounts, DEMO, false);
console.log(`spare world ${name}  ${spare}  → unassigned (force-assign it if the main one breaks)`);
