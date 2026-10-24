// Live backend tests (07): concurrency, abandon/void, commit → successor, double commit, RLS.
// Runs against the linked Supabase project, so only run it before launch or on a test project.
//
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx --env-file=.env.local scripts/test-backend.ts [--cleanup]
//
// The service role key creates throwaway users and shortens the lock TTL for the run; it is read
// from the environment only. Settings are restored at the end. --cleanup deletes the test users
// and their worlds afterwards (test fixtures only; player history is never deleted).

import { createClient } from '@supabase/supabase-js';
import { SupabaseBackend } from '../src/api/SupabaseBackend';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const run = Date.now().toString(36).slice(-6);
const PASSWORD = `pw-${run}-test`;
const TURN_SECONDS = 3;
const userIds: string[] = [];
const worldIds = new Set<string>();
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function player(tag: string): Promise<SupabaseBackend> {
  const username = `zt_${run}_${tag}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@players.temporal.local`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  userIds.push(data.user.id);
  const backend = new SupabaseBackend(url!, anonKey!);
  await backend.signIn(username, PASSWORD);
  return backend;
}

async function claim(b: SupabaseBackend) {
  const w = await b.claimWorld();
  worldIds.add(w.worldId);
  return w;
}

const { data: saved, error: settingsError } = await admin.from('settings').select('*').single();
if (settingsError) throw settingsError;

try {
  await admin
    .from('settings')
    .update({
      inherit_ratio: 1,
      default_turn_seconds: TURN_SECONDS,
      default_generation_count: 2,
      journal_allowance_seconds: 0,
      lock_grace_seconds: 0,
    })
    .eq('id', 1);
  // Only this run's worlds should be inheritable: park any other open world behind a lock.
  // (Pre-launch there are none; if there are, stop rather than touch them.)
  const { count } = await admin
    .from('worlds')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if ((count ?? 0) > 0) throw new Error(`${count} open worlds already exist; run on an empty project`);

  const [a, b, c, d, e] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(player));

  // Abandon: A claims and never commits. Past the TTL, B gets the same world at the same turn.
  const abandoned = await claim(a!);
  await sleep((TURN_SECONDS + 1) * 1000);
  const late = await a!
    .commitTurn({ worldId: abandoned.worldId, actions: [], journal: { text: 'late', drawing: null } })
    .then(() => 'committed')
    .catch((err: Error) => err.message);
  check('late commit is refused', late !== 'committed', late);
  const inherited = await claim(b!);
  check('abandoned world is claimable again', inherited.worldId === abandoned.worldId);
  check('same turn after abandon', inherited.turn === 1, `turn ${inherited.turn}`);
  check('no stone or page for the voided turn', inherited.gravestones.length === 0 && inherited.journal.length === 0);

  // Commit → successor sees page, stone and state.
  await b!.commitTurn({
    worldId: inherited.worldId,
    actions: [],
    journal: { text: 'Look after it.', drawing: null },
  });
  const twice = await b!
    .commitTurn({ worldId: inherited.worldId, actions: [], journal: { text: 'again', drawing: null } })
    .then(() => 'committed')
    .catch((err: Error) => err.message);
  check('second commit for the same turn is refused', twice !== 'committed', twice);
  const successor = await claim(c!);
  check('successor inherits the world', successor.worldId === inherited.worldId);
  check('successor is on turn 2', successor.turn === 2);
  check('successor sees the page', successor.journal[0]?.text === 'Look after it.');
  check('successor sees the stone', successor.gravestones[0]?.username === `zt_${run}_b`);
  check('successor gets the snapshot', successor.snapshot?.turn === 2, `snapshot turn ${successor.snapshot?.turn}`);

  // C plays the last generation (count 2), so the world completes and reaches the gallery.
  await c!.commitTurn({ worldId: successor.worldId, actions: [], journal: { text: 'End.', drawing: null } });
  const gallery = await c!.listCompletedWorlds();
  const listed = gallery.find((g) => g.worldId === successor.worldId);
  check('completed world is in the gallery', listed !== undefined);
  check('gallery lists both players in order', listed?.players.join() === `zt_${run}_b,zt_${run}_c`);
  const replay = await e!.getReplay(successor.worldId);
  check('replay has a snapshot per generation', replay.snapshots.length === 2);
  check('replay has both pages', replay.journal.map((j) => j.text).join('|') === 'Look after it.|End.');
  check('replay transitions are in engine order', replay.transitions[0]?.id.startsWith('begin-1') ?? false);

  // Concurrency: exactly one open unlocked world (a fresh claim left to lapse), then two players
  // claim at the same moment.
  const lapsed = await claim(d!);
  await sleep((TURN_SECONDS + 1) * 1000);
  const [x, y] = await Promise.all([claim(a!), claim(e!)]);
  check('two simultaneous claims get different worlds', x.worldId !== y.worldId);
  check('one of them got the open world', [x.worldId, y.worldId].includes(lapsed.worldId));

  // RLS: history can't be written or changed from a client.
  const raw = createClient(url, anonKey, { auth: { persistSession: false } });
  await raw.auth.signInWithPassword({ email: `zt_${run}_b@players.temporal.local`, password: PASSWORD });
  const { data: updated } = await raw
    .from('journal_pages')
    .update({ text: 'rewritten' })
    .eq('world_id', inherited.worldId)
    .select();
  const { error: insertError } = await raw.from('journal_pages').insert({
    world_id: inherited.worldId,
    turn: 9,
    author_id: userIds[1],
    text: 'forged',
  });
  check('journal page update changes nothing', (updated ?? []).length === 0);
  check('journal page insert is refused', insertError !== null);
  const { error: rpcError } = await raw.rpc('commit_turn_write', {
    p_world: inherited.worldId, p_player: userIds[1], p_turn: 2, p_actions: [], p_transitions: [],
    p_snapshot: {}, p_journal_text: 'forged', p_drawing: null,
  });
  check('clients cannot call commit_turn_write', rpcError !== null);
  const { error: adminError } = await raw.rpc('admin_complete_world', { world: inherited.worldId });
  check('non-admins cannot use admin RPCs', adminError !== null);
} finally {
  await admin.from('settings').update(saved).eq('id', 1);
  console.log('settings restored');

  if (process.argv.includes('--cleanup')) {
    const ids = [...worldIds];
    for (const table of ['journal_pages', 'snapshots', 'transitions', 'actions', 'turns']) {
      await admin.from(table).delete().in('world_id', ids);
    }
    await admin.from('worlds').delete().in('id', ids);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
    console.log(`cleaned up ${ids.length} test worlds and ${userIds.length} test users`);
  } else {
    // Keep test worlds out of play and out of the way.
    await admin
      .from('worlds')
      .update({ status: 'complete', completed_at: new Date().toISOString(), locked_by: null, lock_expires_at: null })
      .in('id', [...worldIds]);
  }
}

console.log(failures === 0 ? '\nall backend checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
