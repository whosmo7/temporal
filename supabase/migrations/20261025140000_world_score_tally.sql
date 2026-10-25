-- Decision 037: the gallery's world score. list_completed_worlds also counts, from each world's
-- history, what the score is made of; the client applies the weights (CONFIG.score), so the
-- numbers live in one place. Counted the same way as tallyHistory() in src/engine/score.ts:
--   cropsHarvested  harvest actions on a field (`field-…`)
--   treesHarvested  harvest actions on an orchard (`orchard-…`)
--   catches         fishHunt actions
--   cropsRotted     stage transitions of a field tile to 'rotten'
--   seedsWithered   stage transitions of a field tile to 'withered'
-- Same visibility as before (security invoker).

create or replace function public.list_completed_worlds() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'world_id', w.id, 'seed', w.seed, 'biome', w.biome, 'preset', w.preset,
    'generation_count', w.generation_count, 'completed_at', w.completed_at,
    'players', coalesce((select jsonb_agg(p.username order by t.turn)
                         from public.turns t join public.profiles p on p.id = t.player_id
                         where t.world_id = w.id), '[]'::jsonb),
    'final_state', (select s.state from public.snapshots s
                    where s.world_id = w.id order by s.turn desc limit 1),
    'tally', (select jsonb_build_object(
        'cropsHarvested', count(*) filter (where a.type = 'harvest' and split_part(a.plot_id, ':', 1) ~ '^field(-[0-9]+)?$'),
        'treesHarvested', count(*) filter (where a.type = 'harvest' and split_part(a.plot_id, ':', 1) ~ '^orchard(-[0-9]+)?$'),
        'catches', count(*) filter (where a.type = 'fishHunt'))
      || (select jsonb_build_object(
        'cropsRotted', count(*) filter (where x.after #>> '{}' = 'rotten'),
        'seedsWithered', count(*) filter (where x.after #>> '{}' = 'withered'))
        from public.transitions x
        where x.world_id = w.id and x.target ->> 'field' = 'stage'
          and split_part(x.target ->> 'plot', ':', 1) ~ '^field(-[0-9]+)?$')
      from public.actions a where a.world_id = w.id))
    order by w.completed_at desc), '[]'::jsonb)
  from public.worlds w where w.status = 'complete';
$$;
