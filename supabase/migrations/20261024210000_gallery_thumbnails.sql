-- 06 gallery thumbnails: list_completed_worlds also returns the map preset and the state after the
-- last generation (CompletedWorld.preset / finalState). Same visibility as before (security invoker).

create or replace function public.list_completed_worlds() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'world_id', w.id, 'seed', w.seed, 'biome', w.biome, 'preset', w.preset,
    'generation_count', w.generation_count, 'completed_at', w.completed_at,
    'players', coalesce((select jsonb_agg(p.username order by t.turn)
                         from public.turns t join public.profiles p on p.id = t.player_id
                         where t.world_id = w.id), '[]'::jsonb),
    'final_state', (select s.state from public.snapshots s
                    where s.world_id = w.id order by s.turn desc limit 1))
    order by w.completed_at desc), '[]'::jsonb)
  from public.worlds w where w.status = 'complete';
$$;
