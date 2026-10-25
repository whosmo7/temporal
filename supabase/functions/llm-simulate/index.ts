// llm-simulate (decision 040): the admin panel's "Simulated players". Plays ONE generation of an LLM
// playthrough per request (Edge Functions have a time limit), with the GEMINI_API_KEY secret. The
// admin page passes the world state and journal pages forward and asks for the next generation.
//
// Nothing is written to the database: no world, turn or trace row. The result goes back to the
// admin's browser only, marked as simulated. Deploy: `npm run functions:deploy`.

import { createClient } from '@supabase/supabase-js';
import { GeminiDecisionMaker, PERSONAS, personasFor, playGeneration, PROMPT_VERSION, startingState, type SimJournalPage, type WorldState } from '../_shared/sim.js';

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

/** Stop choosing this long after the request starts, so the reply beats the platform's time limit. */
const DEADLINE_MS = 110_000;
const MAX_CALLS_PER_REQUEST = 45;
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

interface Body {
  seed?: number;
  biome?: string;
  gens?: number;
  generation?: number;
  personas?: string[];
  model?: string;
  callBudget?: number;
  journal?: SimJournalPage[];
  state?: WorldState | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const startedAt = Date.now();

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return reply(401, { error: 'Not signed in' });
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', auth.user.id).maybeSingle();
  if (!me?.is_admin) return reply(403, { error: 'Admins only' });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return reply(500, { error: 'GEMINI_API_KEY is not set as a Supabase secret.' });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Bad request' });
  }
  const seed = Number(body.seed);
  const gens = Number(body.gens);
  const generation = Number(body.generation);
  const biome = body.biome;
  const model = body.model?.trim() || DEFAULT_MODEL;
  const callBudget = Math.min(MAX_CALLS_PER_REQUEST, Math.floor(Number(body.callBudget ?? MAX_CALLS_PER_REQUEST)));
  if (!Number.isInteger(seed) || !Number.isInteger(gens) || gens < 1 || gens > 12) return reply(400, { error: 'Seed and 1–12 generations, please' });
  if (!Number.isInteger(generation) || generation < 1 || generation > gens) return reply(400, { error: 'No such generation' });
  if (biome !== 'forest' && biome !== 'island') return reply(400, { error: 'Biome is forest or island' });
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply(400, { error: 'That is not a Gemini model id' });
  if (!(callBudget >= 1)) return reply(400, { error: 'No model calls left in the budget' });
  const ids = (body.personas ?? []).filter((id) => PERSONAS.some((p) => p.id === id));

  // Generation 1 starts from the seed; later ones from the state the previous request returned.
  const state = generation === 1 ? startingState({ seed, biome, gens }) : body.state;
  if (!state || state.turn !== generation) return reply(400, { error: `Expected the world as generation ${generation - 1} left it` });

  const persona = personasFor(gens, ids.join(','))[generation - 1]!;
  const trace: Record<string, unknown>[] = [];
  try {
    const step = await playGeneration(new GeminiDecisionMaker(model, apiKey), {
      state,
      generation,
      generations: gens,
      persona,
      journal: Array.isArray(body.journal) ? body.journal.filter((p) => p?.simulated === true) : [],
      callsLeft: callBudget,
      trace: (event) => trace.push({ at: new Date().toISOString(), ...event }),
      deadline: { at: startedAt + DEADLINE_MS, now: () => Date.now() },
    });
    return reply(200, {
      simulated: true,
      model,
      promptVersion: PROMPT_VERSION,
      persona: { id: persona.id, motive: persona.motive },
      result: { ...step.result, state: undefined },
      state: step.state,
      log: step.log,
      journalPage: step.journalPage ?? null,
      stopped: step.stopped ?? null,
      trace,
    });
  } catch (e) {
    return reply(502, { error: `The simulation stopped: ${e instanceof Error ? e.message : String(e)}`, trace });
  }
});
