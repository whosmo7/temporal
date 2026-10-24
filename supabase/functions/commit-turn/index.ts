// commit-turn (07): the authoritative turn commit. Re-runs the submitted actions through the same
// engine the client uses, then hands the result to commit_turn_write, which re-checks the lock and
// appends everything in one transaction.
//
// Deploy: `npm run functions:deploy` (bundles the engine first). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are set by Supabase in every function; nothing to configure.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { InvalidTurnError, runTurn } from '../_shared/engine.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Who is committing: from their JWT, never from the body.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  const player = auth.user?.id;
  if (!player) return reply(401, { error: 'Not signed in' });

  let input: { worldId?: string; actions?: unknown[]; journal?: { text?: string; drawing?: unknown } };
  try {
    input = await req.json();
  } catch {
    return reply(400, { error: 'Bad request' });
  }
  if (typeof input.worldId !== 'string' || !Array.isArray(input.actions)) {
    return reply(400, { error: 'Bad request' });
  }

  // 1. The caller holds the lock and it hasn't expired. commit_turn_write checks again under a row lock.
  const { data: world, error: worldError } = await admin
    .from('worlds')
    .select('*')
    .eq('id', input.worldId)
    .maybeSingle();
  if (worldError) return reply(500, { error: worldError.message });
  if (!world) return reply(404, { error: 'World not found' });
  if (world.locked_by !== player || Date.parse(world.lock_expires_at) <= Date.now()) {
    return reply(409, { error: 'Your turn has expired' });
  }

  // 2. Latest snapshot, or null for generation 1.
  const { data: snap, error: snapError } = await admin
    .from('snapshots')
    .select('state')
    .eq('world_id', world.id)
    .order('turn', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapError) return reply(500, { error: snapError.message });

  // 3. Re-run the turn. Any invalid action rejects the whole commit.
  let result;
  try {
    result = runTurn(
      {
        worldId: world.id,
        seed: Number(world.seed),
        biome: world.biome,
        preset: world.preset,
        generationCount: world.generation_count,
        turnSeconds: world.turn_seconds,
      },
      snap?.state ?? null,
      input.actions,
      player,
    );
  } catch (e) {
    if (e instanceof InvalidTurnError) return reply(422, { error: e.message });
    throw e;
  }

  // 4. Append everything and advance the world, in one transaction.
  const { error: writeError } = await admin.rpc('commit_turn_write', {
    p_world: world.id,
    p_player: player,
    p_turn: world.current_turn,
    p_actions: result.actions,
    p_transitions: result.transitions,
    p_snapshot: result.state,
    p_journal_text: input.journal?.text ?? '',
    p_drawing: input.journal?.drawing ?? null,
  });
  if (writeError) return reply(409, { error: writeError.message });

  return reply(200, { ok: true, summary: result.summary });
});
