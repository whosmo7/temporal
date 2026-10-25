-- Decision 036: the admin panel's scope.
--   * Delete removes a world from the game, not from the database: worlds.removed_at / removed_by.
--     A removed world is never claimed, force-assigned, listed or replayed. Its turns, actions,
--     transitions, snapshots and journal pages stay as they are (rule 2). Refused while locked.
--   * Every admin call writes one row to admin_actions, which is append-only.
--   * The panel lists worlds in progress only.
-- The seed-demo Edge Function writes its own 'createDemoWorld' row with the service role.

alter table public.worlds
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id);

-- ---------------------------------------------------------------------------
-- Admin log
-- ---------------------------------------------------------------------------

create table public.admin_actions (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid references public.profiles (id),
  action text not null check (action in ('forceAssign', 'configureWorld', 'clearLock', 'markComplete',
                                         'removeWorld', 'createWorld', 'createDemoWorld', 'setSettings')),
  world_id uuid references public.worlds (id),
  before jsonb,
  after jsonb
);
create index admin_actions_at on public.admin_actions (at desc);

alter table public.admin_actions enable row level security;
create policy "admins read the admin log" on public.admin_actions for select using (public.is_admin());

-- Append-only, even for the service role and the definer functions below.
create function public.admin_actions_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The admin log is append-only';
end;
$$;
create trigger admin_actions_no_update before update or delete on public.admin_actions
  for each row execute function public.admin_actions_append_only();

create function public.log_admin(action text, world uuid, before jsonb, after jsonb) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.admin_actions (admin_id, action, world_id, before, after)
  values (auth.uid(), log_admin.action, log_admin.world, log_admin.before, log_admin.after);
$$;
revoke execute on function public.log_admin(text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_actions_append_only() from public, anon, authenticated;

-- The latest rows, newest first, with the admin's username.
create function public.admin_recent_actions(lim int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(r.item order by r.at desc, r.id desc), '[]'::jsonb) from (
    select a.at, a.id, jsonb_build_object(
      'id', a.id, 'at', a.at, 'admin', p.username, 'action', a.action,
      'world_id', a.world_id, 'before', a.before, 'after', a.after) as item
    from public.admin_actions a left join public.profiles p on p.id = a.admin_id
    order by a.at desc, a.id desc
    limit greatest(1, least(coalesce(lim, 20), 200))) r);
end;
$$;
revoke execute on function public.admin_recent_actions(int) from public, anon;
grant execute on function public.admin_recent_actions(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Remove a world (keeps its history)
-- ---------------------------------------------------------------------------

create function public.admin_remove_world(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
begin
  perform public.require_admin();
  select * into w from public.worlds x where x.id = world and x.removed_at is null for update;
  if not found then raise exception 'No such world'; end if;
  if w.locked_by is not null and w.lock_expires_at > now() then
    raise exception 'Someone is playing this world. Clear the lock first.';
  end if;
  update public.worlds set removed_at = now(), removed_by = auth.uid(), forced_for = null where id = world;
  perform public.log_admin('removeWorld', world, null, jsonb_build_object('removedAt', now()));
end;
$$;
revoke execute on function public.admin_remove_world(uuid) from public, anon;
grant execute on function public.admin_remove_world(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing admin RPCs: same behaviour, plus a log row and the removed-world check
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_worlds() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'world_id', w.id, 'seed', w.seed, 'biome', w.biome, 'status', w.status,
      'current_turn', w.current_turn, 'generation_count', w.generation_count,
      'turn_seconds', w.turn_seconds,
      'locked_by', (select username from public.profiles where id = w.locked_by),
      'lock_expires_at', w.lock_expires_at,
      'forced_for', (select username from public.profiles where id = w.forced_for),
      'players', coalesce((select jsonb_agg(p.username order by t.turn)
                           from public.turns t join public.profiles p on p.id = t.player_id
                           where t.world_id = w.id), '[]'::jsonb),
      'created_at', w.created_at)
    order by w.created_at desc), '[]'::jsonb)
    from public.worlds w
    where w.status = 'open' and w.removed_at is null);
end;
$$;

create or replace function public.admin_set_settings(
  inherit_ratio numeric default null,
  default_turn_seconds int default null,
  default_generation_count int default null,
  journal_allowance_seconds int default null,
  lock_grace_seconds int default null,
  heartbeat_cap_seconds int default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  before jsonb;
  after jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object('inheritRatio', s.inherit_ratio, 'defaultTurnSeconds', s.default_turn_seconds,
                            'defaultGenerationCount', s.default_generation_count)
    into before from public.settings s where s.id = 1;
  update public.settings s set
    inherit_ratio = coalesce(admin_set_settings.inherit_ratio, s.inherit_ratio),
    default_turn_seconds = coalesce(admin_set_settings.default_turn_seconds, s.default_turn_seconds),
    default_generation_count = coalesce(admin_set_settings.default_generation_count, s.default_generation_count),
    journal_allowance_seconds = coalesce(admin_set_settings.journal_allowance_seconds, s.journal_allowance_seconds),
    lock_grace_seconds = coalesce(admin_set_settings.lock_grace_seconds, s.lock_grace_seconds),
    heartbeat_cap_seconds = coalesce(admin_set_settings.heartbeat_cap_seconds, s.heartbeat_cap_seconds)
  where s.id = 1;
  select jsonb_build_object('inheritRatio', s.inherit_ratio, 'defaultTurnSeconds', s.default_turn_seconds,
                            'defaultGenerationCount', s.default_generation_count)
    into after from public.settings s where s.id = 1;
  perform public.log_admin('setSettings', null, before, after);
end;
$$;

create or replace function public.admin_set_world(world uuid, turn_seconds int default null, generation_count int default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
begin
  perform public.require_admin();
  select * into w from public.worlds x where x.id = world and x.removed_at is null for update;
  if not found then raise exception 'No such world'; end if;
  if w.status = 'complete' then raise exception 'This world has ended'; end if;
  if coalesce(admin_set_world.turn_seconds, w.turn_seconds) <= 0 then
    raise exception 'Turn length must be above 0';
  end if;
  if coalesce(admin_set_world.generation_count, w.generation_count) < w.current_turn then
    raise exception 'At least % generations: that one is being played or next', w.current_turn;
  end if;
  update public.worlds x set
    turn_seconds = coalesce(admin_set_world.turn_seconds, x.turn_seconds),
    generation_count = coalesce(admin_set_world.generation_count, x.generation_count)
  where x.id = world;
  perform public.log_admin('configureWorld', world,
    jsonb_build_object('turnSeconds', w.turn_seconds, 'generationCount', w.generation_count),
    jsonb_build_object('turnSeconds', coalesce(admin_set_world.turn_seconds, w.turn_seconds),
                       'generationCount', coalesce(admin_set_world.generation_count, w.generation_count)));
end;
$$;

create or replace function public.admin_complete_world(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
  played int;
begin
  perform public.require_admin();
  select * into w from public.worlds x where x.id = world and x.removed_at is null for update;
  if not found then raise exception 'No such world'; end if;
  if w.status = 'complete' then return; end if;
  select count(*) into played from public.turns where world_id = world;
  if played = 0 then raise exception 'Nobody has played this world yet'; end if;
  update public.worlds
  set status = 'complete', completed_at = now(), generation_count = played,
      locked_by = null, lock_expires_at = null, locked_at = null, forced_for = null
  where id = world;
  perform public.log_admin('markComplete', world,
    jsonb_build_object('generationCount', w.generation_count), jsonb_build_object('generationCount', played));
end;
$$;

create or replace function public.admin_clear_lock(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  holder text;
begin
  perform public.require_admin();
  select p.username into holder from public.worlds w left join public.profiles p on p.id = w.locked_by
  where w.id = world and w.removed_at is null;
  if not found then raise exception 'No such world'; end if;
  update public.worlds set locked_by = null, lock_expires_at = null, locked_at = null where id = world;
  perform public.log_admin('clearLock', world, to_jsonb(holder), null);
end;
$$;

create or replace function public.admin_force_assign(world uuid, username text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  target uuid;
  target_name text;
  previous text;
begin
  perform public.require_admin();
  select id, profiles.username into target, target_name from public.profiles
  where profiles.username = lower(trim(admin_force_assign.username));
  if target is null then raise exception 'No player by that name'; end if;
  select p.username into previous from public.worlds w left join public.profiles p on p.id = w.forced_for
  where w.id = world;
  update public.worlds set forced_for = target where id = world and status = 'open' and removed_at is null;
  if not found then raise exception 'This world has ended'; end if;
  perform public.log_admin('forceAssign', world, to_jsonb(previous), to_jsonb(target_name));
end;
$$;

create or replace function public.admin_create_world(
  seed bigint,
  biome text,
  preset text default 'default',
  turn_seconds int default null,
  generation_count int default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  cfg public.settings;
  new_id uuid;
begin
  perform public.require_admin();
  select * into cfg from public.settings where settings.id = 1;
  insert into public.worlds (seed, biome, preset, turn_seconds, generation_count)
  values (admin_create_world.seed, admin_create_world.biome, admin_create_world.preset,
          coalesce(admin_create_world.turn_seconds, cfg.default_turn_seconds),
          coalesce(admin_create_world.generation_count, cfg.default_generation_count))
  returning worlds.id into new_id;
  perform public.log_admin('createWorld', new_id, null, jsonb_build_object(
    'seed', admin_create_world.seed, 'biome', admin_create_world.biome, 'preset', admin_create_world.preset));
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Removed worlds leave the game: claim, gallery, replay
-- ---------------------------------------------------------------------------

-- As 20261025120000_weighted_claim.sql, plus `removed_at is null` on force-assign and the draw.
create or replace function public.claim_world(avoid uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cfg public.settings;
  w public.worlds;
  roll double precision;
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;

  -- One claim at a time per player, so a double click can't take two worlds.
  perform pg_advisory_xact_lock(hashtext('claim:' || me::text));

  -- 1. Resume a world we already hold.
  select * into w from public.worlds
  where locked_by = me and lock_expires_at > now() limit 1;
  if found then return public.claim_payload(w); end if;

  -- 3. Expire stale locks. Those turns are voided; nothing was written for them.
  update public.worlds set locked_by = null, lock_expires_at = null, locked_at = null
  where locked_by is not null and lock_expires_at <= now();

  -- 2. Admin force-assign (exempt from the previous-generation rule).
  select * into w from public.worlds
  where forced_for = me and status = 'open' and locked_by is null and removed_at is null
  limit 1 for update skip locked;

  -- 4. The weighted draw over the open worlds this player may inherit.
  if not found then
    select * into cfg from public.settings where id = 1;
    roll := random();
    if roll < cfg.inherit_ratio then
      -- Furthest along first on a low roll, any other first on a middle one; then the rest.
      select * into w from public.worlds where id = (
        with pool as (
          select x.id, x.current_turn from public.worlds x
          where x.status = 'open' and x.locked_by is null and x.removed_at is null
            and (x.forced_for is null or x.forced_for = me)
            -- not a world whose latest generation this player played
            and not exists (
              select 1 from public.turns t
              where t.world_id = x.id and t.turn = x.current_turn - 1 and t.player_id = me))
        select p.id from pool p
        order by
          case when roll < least(cfg.highest_chance, cfg.inherit_ratio)
            then p.current_turn = (select max(current_turn) from pool)
            else p.current_turn < (select max(current_turn) from pool) end desc,
          random()
        limit 1)
      for update skip locked;
    end if;
    if w.id is null then
      insert into public.worlds (seed, biome, turn_seconds, generation_count)
      values (floor(random() * 2147483647)::bigint,
              (array['forest', 'island'])[1 + floor(random() * 2)::int],
              cfg.default_turn_seconds, cfg.default_generation_count)
      returning * into w;
    end if;
  end if;

  -- 5. Lock it.
  update public.worlds
  set locked_by = me, locked_at = now(), lock_expires_at = now() + public.lock_ttl(w), forced_for = null
  where id = w.id
  returning * into w;
  return public.claim_payload(w);
end;
$$;

-- As 20261025140000_world_score_tally.sql, without removed worlds.
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
  from public.worlds w where w.status = 'complete' and w.removed_at is null;
$$;

-- As 20261024200000_claim_commit_admin.sql, without removed worlds.
create or replace function public.get_replay(world uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'world_id', w.id, 'seed', w.seed, 'biome', w.biome,
    'snapshots', coalesce((select jsonb_agg(s.state order by s.turn)
                           from public.snapshots s where s.world_id = w.id), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', a.id, 'world_id', a.world_id, 'actor_id', a.actor_id, 'type', a.type,
                  'plot_id', a.plot_id, 'target_effect_id', a.target_effect_id, 'eat', a.eat,
                  'committed_turn', a.committed_turn, 'committed_t', a.committed_t,
                  'due_turn', a.due_turn, 'due_t', a.due_t, 'seq', a.seq)
                  order by a.turn, a.seq)
                 from public.actions a where a.world_id = w.id), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', x.id, 'turn', x.turn, 't', x.t, 'target', x.target, 'before', x.before,
                  'after', x.after, 'delta', x.delta, 'causes', x.causes)
                  order by x.turn, x.seq)
                 from public.transitions x where x.world_id = w.id), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(jsonb_build_object(
                  'turn', j.turn, 'author_username', p.username, 'text', j.text, 'drawing', j.drawing)
                  order by j.turn)
                 from public.journal_pages j join public.profiles p on p.id = j.author_id
                 where j.world_id = w.id), '[]'::jsonb))
  from public.worlds w where w.id = world and w.status = 'complete' and w.removed_at is null;
$$;
