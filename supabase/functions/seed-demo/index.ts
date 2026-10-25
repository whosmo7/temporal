// seed-demo (decision 036): the admin panel's "Create demo world". Makes the world from
// src/api/demo-world.json, plays its founder generations through the same engine re-run and
// commit_turn_write as commit-turn, then force-assigns the judge. Server-side, because the browser
// can't sign in as each founder without dropping the admin's own session. scripts/seed-demo.ts
// stays as the backup path.
//
// Deploy: `npm run functions:deploy`. Founder accounts are made here if missing, with a random
// password nobody needs. The judge account must already exist, since someone signs in as it.

import { createClient } from '@supabase/supabase-js';
import { DEMO, demoActions, InvalidTurnError, runTurn, type WorldState } from '../_shared/engine.js';

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

/** Same synthetic email as SupabaseBackend.signUp (07). */
const emailFor = (username: string) => `${username}@players.temporal.local`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Only an admin, from their JWT.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = await db.auth.getUser(token);
  const caller = auth.user?.id;
  if (!caller) return reply(401, { error: 'Not signed in' });
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', caller).maybeSingle();
  if (!me?.is_admin) return reply(403, { error: 'Admins only' });

  const idOf = async (username: string): Promise<string | null> => {
    const { data } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
    return data?.id ?? null;
  };

  const judge = await idOf(DEMO.judge);
  if (!judge) return reply(400, { error: `Make the ${DEMO.judge} account first: sign up as ${DEMO.judge} in the game.` });

  // Founders: made if missing. The signup trigger creates their profile.
  const founders: string[] = [];
  for (const gen of DEMO.generations) {
    let id = await idOf(gen.player);
    if (!id) {
      const { error } = await db.auth.admin.createUser({
        email: emailFor(gen.player),
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { username: gen.player },
      });
      if (error) return reply(500, { error: `Couldn't make ${gen.player}: ${error.message}` });
      id = await idOf(gen.player);
      if (!id) return reply(500, { error: `No profile for ${gen.player}` });
    }
    founders.push(id);
  }

  const { data: cfg } = await db.from('settings').select('default_turn_seconds, default_generation_count').eq('id', 1).single();
  const { data: world, error: worldError } = await db
    .from('worlds')
    .insert({
      seed: DEMO.world.seed,
      biome: DEMO.world.biome,
      preset: DEMO.world.preset ?? 'default',
      turn_seconds: DEMO.world.turnSeconds ?? cfg?.default_turn_seconds,
      generation_count: DEMO.world.generationCount ?? cfg?.default_generation_count,
    })
    .select('*')
    .single();
  if (worldError || !world) return reply(500, { error: worldError?.message ?? 'No world' });

  // Each founder holds the lock for their generation, as a claim would give them, then commits.
  let previous: WorldState | null = null;
  for (const [i, gen] of DEMO.generations.entries()) {
    const player = founders[i]!;
    const turn = i + 1;
    const now = Date.now();
    const { error: lockError } = await db
      .from('worlds')
      .update({ locked_by: player, locked_at: new Date(now).toISOString(), lock_expires_at: new Date(now + 3600_000).toISOString() })
      .eq('id', world.id);
    if (lockError) return reply(500, { error: lockError.message });

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
        previous,
        demoActions(world.id, turn, gen.actions),
        player,
      );
    } catch (e) {
      if (e instanceof InvalidTurnError) return reply(422, { error: `Generation ${turn}: ${e.message}` });
      throw e;
    }

    const { error: writeError } = await db.rpc('commit_turn_write', {
      p_world: world.id,
      p_player: player,
      p_turn: turn,
      p_actions: result.actions,
      p_transitions: result.transitions,
      p_snapshot: result.state,
      p_journal_text: gen.journal,
      p_drawing: null,
    });
    if (writeError) return reply(409, { error: `Generation ${turn}: ${writeError.message}` });
    previous = result.state;
  }

  const { error: assignError } = await db.from('worlds').update({ forced_for: judge }).eq('id', world.id);
  if (assignError) return reply(500, { error: assignError.message });

  await db.from('admin_actions').insert({
    admin_id: caller,
    action: 'createDemoWorld',
    world_id: world.id,
    after: { worldId: world.id, judge: DEMO.judge },
  });

  return reply(200, { worldId: world.id });
});
