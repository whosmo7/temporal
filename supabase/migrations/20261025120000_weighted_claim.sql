-- Decision 034: the inheritance draw is weighted, and nobody inherits the world whose latest
-- generation they played.
--   roll < highest_chance (0.5)  the open world furthest along (ties at random)
--   roll < inherit_ratio (0.9)   any other open world
--   otherwise                    a new world
-- An empty bucket falls through to the other inheriting one, then to a new world. Resuming a
-- held world and admin force-assign come first, unchanged. `avoid` (the device's last world,
-- decision 020) is no longer used: the server's own rule replaces it. It stays in the signature
-- so older clients still call it.

alter table public.settings
  add column highest_chance numeric not null default 0.5 check (highest_chance between 0 and 1);
alter table public.settings alter column inherit_ratio set default 0.9;
update public.settings set inherit_ratio = 0.9, highest_chance = 0.5 where id = 1;

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
  where forced_for = me and status = 'open' and locked_by is null
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
          where x.status = 'open' and x.locked_by is null
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
