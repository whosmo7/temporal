-- 07 Backend: claim_world, heartbeat, commit write, admin RPCs, gallery + replay reads.
-- Decision 016 covers the claim and lock rules.

-- ---------------------------------------------------------------------------
-- Fixes and additions to the first migration
-- ---------------------------------------------------------------------------

-- Engine ids are unique within a world only (`begin-3#0`, `end-3#2`), so scope the keys by world.
alter table public.transitions drop constraint transitions_pkey, add primary key (world_id, id);
alter table public.actions drop constraint actions_pkey, add primary key (world_id, id);
-- Emission order within a world, so the replay reads transitions back in the order the engine made them.
alter table public.transitions add column seq int not null default 0;

-- When the current lock started, so heartbeat can cap how long one claim lasts.
alter table public.worlds add column locked_at timestamptz;

-- How far past its first deadline a lock may be stretched by heartbeats (journal reading stops the clock, 012).
alter table public.settings add column heartbeat_cap_seconds int not null default 900
  check (heartbeat_cap_seconds >= 0);

-- ---------------------------------------------------------------------------
-- Payload helpers
-- ---------------------------------------------------------------------------

-- What a player gets when they claim a world: the world, the last snapshot, every page and every stone.
create function public.claim_payload(w public.worlds) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'world_id', w.id,
    'seed', w.seed,
    'biome', w.biome,
    'preset', w.preset,
    'turn', w.current_turn,
    'generation_count', w.generation_count,
    'turn_seconds', w.turn_seconds,
    'lock_expires_at', w.lock_expires_at,
    'snapshot', (select s.state from public.snapshots s
                 where s.world_id = w.id order by s.turn desc limit 1),
    'journal', coalesce((select jsonb_agg(jsonb_build_object(
                   'turn', j.turn, 'author_username', p.username, 'text', j.text, 'drawing', j.drawing)
                   order by j.turn)
                 from public.journal_pages j join public.profiles p on p.id = j.author_id
                 where j.world_id = w.id), '[]'::jsonb),
    'gravestones', coalesce((select jsonb_agg(jsonb_build_object('turn', t.turn, 'username', p.username)
                   order by t.turn)
                 from public.turns t join public.profiles p on p.id = t.player_id
                 where t.world_id = w.id), '[]'::jsonb)
  );
$$;

create function public.lock_ttl(w public.worlds) returns interval
language sql stable security definer set search_path = '' as $$
  select make_interval(secs => w.turn_seconds + s.journal_allowance_seconds + s.lock_grace_seconds)
  from public.settings s where s.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- claim_world: one player per world (07 › claim_world)
-- `avoid` is the world this device last played (client-side repeat check, decision 016). It is a
-- preference: if it's the only open world, a new world is made instead.
-- ---------------------------------------------------------------------------

create function public.claim_world(avoid uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cfg public.settings;
  w public.worlds;
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

  -- 2. Admin force-assign.
  select * into w from public.worlds
  where forced_for = me and status = 'open' and locked_by is null
  limit 1 for update skip locked;

  -- 4. Inherit an open world, or start a new one.
  if not found then
    select * into cfg from public.settings where id = 1;
    if random() < cfg.inherit_ratio then
      select * into w from public.worlds
      where status = 'open' and locked_by is null
        and (forced_for is null or forced_for = me)
        and id is distinct from avoid
      order by random() limit 1 for update skip locked;
    end if;
    if not found or w.id is null then
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

-- ---------------------------------------------------------------------------
-- heartbeat: keeps the lock alive while the clock is stopped (journal open, end-of-turn flow).
-- Extends to now() + grace, never past locked_at + full TTL + heartbeat_cap. Returns the new
-- expiry, or null if the caller no longer holds the world (their turn was voided).
-- ---------------------------------------------------------------------------

create function public.heartbeat(world uuid) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  cfg public.settings;
  w public.worlds;
begin
  select * into cfg from public.settings where id = 1;
  update public.worlds x
  set lock_expires_at = least(
        greatest(x.lock_expires_at, now() + make_interval(secs => cfg.lock_grace_seconds)),
        x.locked_at + public.lock_ttl(x) + make_interval(secs => cfg.heartbeat_cap_seconds))
  where x.id = world and x.locked_by = auth.uid() and x.lock_expires_at > now()
  returning * into w;
  return w.lock_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- commit_turn_write: step 4 of commit-turn, in one transaction. Only the Edge Function (service
-- role) may call it, after re-running the turn through the engine.
-- ---------------------------------------------------------------------------

create function public.commit_turn_write(
  p_world uuid,
  p_player uuid,
  p_turn int,
  p_actions jsonb,
  p_transitions jsonb,
  p_snapshot jsonb,
  p_journal_text text,
  p_drawing jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
begin
  select * into w from public.worlds where id = p_world for update;
  if not found then raise exception 'World not found'; end if;
  if w.locked_by is distinct from p_player or w.lock_expires_at <= now() then
    raise exception 'Your turn has expired' using errcode = 'P0001';
  end if;
  if w.current_turn <> p_turn then raise exception 'Turn % was already committed', p_turn; end if;

  insert into public.turns (world_id, turn, player_id) values (p_world, p_turn, p_player);

  insert into public.actions (id, world_id, turn, actor_id, type, plot_id, target_effect_id, eat,
                              committed_turn, committed_t, due_turn, due_t, seq)
  select a ->> 'id', p_world, p_turn, p_player, a ->> 'type', a ->> 'plotId', a ->> 'targetEffectId',
         coalesce((a ->> 'eat')::boolean, false),
         (a -> 'committedAt' ->> 'turn')::int, (a -> 'committedAt' ->> 't')::real,
         (a -> 'dueAt' ->> 'turn')::int, (a -> 'dueAt' ->> 't')::real,
         (a ->> 'seq')::int
  from jsonb_array_elements(p_actions) a;

  insert into public.transitions (id, world_id, turn, t, target, before, after, delta, causes, seq)
  select x ->> 'id', p_world, coalesce((x -> 'at' ->> 'turn')::int, p_turn), (x -> 'at' ->> 't')::real,
         x -> 'target', x -> 'before', x -> 'after', (x ->> 'delta')::real, x -> 'causes', n::int
  from jsonb_array_elements(p_transitions) with ordinality as e(x, n);

  insert into public.snapshots (world_id, turn, state) values (p_world, p_turn, p_snapshot);

  insert into public.journal_pages (world_id, turn, author_id, text, drawing)
  values (p_world, p_turn, p_player, coalesce(p_journal_text, ''), p_drawing);

  update public.worlds
  set current_turn = current_turn + 1, locked_by = null, lock_expires_at = null, locked_at = null,
      status = case when current_turn + 1 > generation_count then 'complete' else status end,
      completed_at = case when current_turn + 1 > generation_count then now() else completed_at end
  where id = p_world;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Gallery + replay reads. security invoker, so the RLS read policies decide what's visible.
-- ---------------------------------------------------------------------------

create function public.list_completed_worlds() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'world_id', w.id, 'seed', w.seed, 'biome', w.biome, 'generation_count', w.generation_count,
    'completed_at', w.completed_at,
    'players', coalesce((select jsonb_agg(p.username order by t.turn)
                         from public.turns t join public.profiles p on p.id = t.player_id
                         where t.world_id = w.id), '[]'::jsonb))
    order by w.completed_at desc), '[]'::jsonb)
  from public.worlds w where w.status = 'complete';
$$;

create function public.get_replay(world uuid) returns jsonb
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
  from public.worlds w where w.id = world and w.status = 'complete';
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (10: force-assign, configure turn length/generations, skip to replay)
-- ---------------------------------------------------------------------------

create function public.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
end;
$$;

-- Nulls keep the current value.
create function public.admin_set_settings(
  inherit_ratio numeric default null,
  default_turn_seconds int default null,
  default_generation_count int default null,
  journal_allowance_seconds int default null,
  lock_grace_seconds int default null,
  heartbeat_cap_seconds int default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.settings s set
    inherit_ratio = coalesce(admin_set_settings.inherit_ratio, s.inherit_ratio),
    default_turn_seconds = coalesce(admin_set_settings.default_turn_seconds, s.default_turn_seconds),
    default_generation_count = coalesce(admin_set_settings.default_generation_count, s.default_generation_count),
    journal_allowance_seconds = coalesce(admin_set_settings.journal_allowance_seconds, s.journal_allowance_seconds),
    lock_grace_seconds = coalesce(admin_set_settings.lock_grace_seconds, s.lock_grace_seconds),
    heartbeat_cap_seconds = coalesce(admin_set_settings.heartbeat_cap_seconds, s.heartbeat_cap_seconds)
  where s.id = 1;
end;
$$;

-- Changes apply from the next claim; the current lock keeps its deadline.
create function public.admin_set_world(world uuid, turn_seconds int default null, generation_count int default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.worlds w set
    turn_seconds = coalesce(admin_set_world.turn_seconds, w.turn_seconds),
    generation_count = coalesce(admin_set_world.generation_count, w.generation_count)
  where w.id = world and w.status = 'open';
  if not found then raise exception 'No open world %', world; end if;
end;
$$;

-- The world goes to `username` on their next claim. Doesn't break a lock someone else holds.
create function public.admin_force_assign(world uuid, username text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  target uuid;
begin
  perform public.require_admin();
  select id into target from public.profiles where profiles.username = lower(admin_force_assign.username);
  if target is null then raise exception 'No player %', username; end if;
  update public.worlds set forced_for = target where id = world and status = 'open';
  if not found then raise exception 'No open world %', world; end if;
end;
$$;

-- Skip to replay: ends the world after its committed turns. Voids any turn in progress.
create function public.admin_complete_world(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.worlds
  set status = 'complete', completed_at = now(), locked_by = null, lock_expires_at = null,
      locked_at = null, forced_for = null
  where id = world and status = 'open';
  if not found then raise exception 'No open world %', world; end if;
end;
$$;

-- A world from a chosen seed (the demo world, 10). Settings defaults fill what's left out.
create function public.admin_create_world(
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
  return new_id;
end;
$$;

-- Admin world list (any status), for the admin screen.
create function public.admin_list_worlds() returns setof public.worlds
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select * from public.worlds order by created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants execute to public by default; take it back and grant per role.
-- ---------------------------------------------------------------------------

revoke execute on function public.claim_payload(public.worlds) from public, anon, authenticated;
revoke execute on function public.lock_ttl(public.worlds) from public, anon, authenticated;
revoke execute on function public.require_admin() from public, anon, authenticated;
revoke execute on function public.commit_turn_write(uuid, uuid, int, jsonb, jsonb, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_turn_write(uuid, uuid, int, jsonb, jsonb, jsonb, text, jsonb)
  to service_role;

revoke execute on function public.claim_world(uuid) from public, anon;
revoke execute on function public.heartbeat(uuid) from public, anon;
grant execute on function public.claim_world(uuid) to authenticated;
grant execute on function public.heartbeat(uuid) to authenticated;

grant execute on function public.list_completed_worlds() to anon, authenticated;
grant execute on function public.get_replay(uuid) to anon, authenticated;

revoke execute on function public.admin_set_settings(numeric, int, int, int, int, int) from public, anon;
revoke execute on function public.admin_set_world(uuid, int, int) from public, anon;
revoke execute on function public.admin_force_assign(uuid, text) from public, anon;
revoke execute on function public.admin_complete_world(uuid) from public, anon;
revoke execute on function public.admin_list_worlds() from public, anon;
revoke execute on function public.admin_create_world(bigint, text, text, int, int) from public, anon;
grant execute on function public.admin_create_world(bigint, text, text, int, int) to authenticated;
grant execute on function public.admin_set_settings(numeric, int, int, int, int, int) to authenticated;
grant execute on function public.admin_set_world(uuid, int, int) to authenticated;
grant execute on function public.admin_force_assign(uuid, text) to authenticated;
grant execute on function public.admin_complete_world(uuid) to authenticated;
grant execute on function public.admin_list_worlds() to authenticated;
