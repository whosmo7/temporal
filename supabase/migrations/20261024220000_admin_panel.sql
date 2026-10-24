-- 08 admin panel: match the Backend admin contract C's panel uses (listWorlds with usernames,
-- configureWorld limits, markComplete = "the generations played so far", clearLock).

-- Usernames instead of ids, plus who played and when it was made.
drop function public.admin_list_worlds();
create function public.admin_list_worlds() returns jsonb
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
    from public.worlds w);
end;
$$;
revoke execute on function public.admin_list_worlds() from public, anon;
grant execute on function public.admin_list_worlds() to authenticated;

-- The generation count can't go below the generation being played or next.
create or replace function public.admin_set_world(world uuid, turn_seconds int default null, generation_count int default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
begin
  perform public.require_admin();
  select * into w from public.worlds x where x.id = world for update;
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
end;
$$;

-- Skip to replay: the world ends at the generations played so far.
create or replace function public.admin_complete_world(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.worlds;
  played int;
begin
  perform public.require_admin();
  select * into w from public.worlds x where x.id = world for update;
  if not found then raise exception 'No such world'; end if;
  if w.status = 'complete' then return; end if;
  select count(*) into played from public.turns where world_id = world;
  if played = 0 then raise exception 'Nobody has played this world yet'; end if;
  update public.worlds
  set status = 'complete', completed_at = now(), generation_count = played,
      locked_by = null, lock_expires_at = null, locked_at = null, forced_for = null
  where id = world;
end;
$$;

-- Frees a world someone is stuck holding. Their turn is voided, as if the lock had expired.
create function public.admin_clear_lock(world uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.worlds set locked_by = null, lock_expires_at = null, locked_at = null where id = world;
  if not found then raise exception 'No such world'; end if;
end;
$$;
revoke execute on function public.admin_clear_lock(uuid) from public, anon;
grant execute on function public.admin_clear_lock(uuid) to authenticated;

-- Usernames may come with stray spaces from the panel's text field.
create or replace function public.admin_force_assign(world uuid, username text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  target uuid;
begin
  perform public.require_admin();
  select id into target from public.profiles
  where profiles.username = lower(trim(admin_force_assign.username));
  if target is null then raise exception 'No player by that name'; end if;
  update public.worlds set forced_for = target where id = world and status = 'open';
  if not found then raise exception 'This world has ended'; end if;
end;
$$;
