-- 07 Backend: schema, RLS and username auth.
-- Append-only tables (actions, transitions, turns, snapshots, journal_pages) get no UPDATE/DELETE policy.
-- Clients never write directly: every write goes through security definer functions (claim_world, commit-turn, admin RPCs).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  inherit_ratio numeric not null default 0.7 check (inherit_ratio between 0 and 1),
  default_turn_seconds int not null default 600 check (default_turn_seconds > 0), -- decision 007
  default_generation_count int not null default 6 check (default_generation_count > 0), -- decision 007
  journal_allowance_seconds int not null default 300, -- lock TTL part; 07 open question 2
  lock_grace_seconds int not null default 120
);
insert into public.settings (id) values (1);

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  name text,
  seed bigint not null,
  biome text not null check (biome in ('forest', 'island')),
  preset text not null default 'default', -- worldgen preset (decision 001)
  turn_seconds int not null check (turn_seconds > 0),
  generation_count int not null check (generation_count > 0),
  current_turn int not null default 1, -- next generation to be played
  status text not null default 'open' check (status in ('open', 'complete')),
  locked_by uuid references public.profiles (id),
  lock_expires_at timestamptz,
  forced_for uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index worlds_open_unlocked on public.worlds (status) where status = 'open';
create index worlds_locked_by on public.worlds (locked_by) where locked_by is not null;

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id),
  turn int not null,
  player_id uuid not null references public.profiles (id),
  committed_at timestamptz not null default now(),
  unique (world_id, turn)
);

create table public.actions (
  id text primary key, -- engine id / ulid
  world_id uuid not null references public.worlds (id),
  turn int not null,
  actor_id uuid not null references public.profiles (id),
  type text not null check (type in ('harvest', 'plantCrops', 'plantOrchard', 'repairReservoir',
                                     'digWell', 'fishHunt', 'maintain', 'fastTrack')),
  plot_id text,
  target_effect_id text,
  eat boolean not null default false, -- harvest only (decision 003)
  committed_turn int not null,
  committed_t real,
  due_turn int not null,
  due_t real,
  seq int not null
);
create index actions_world_turn on public.actions (world_id, turn, seq);

create table public.transitions (
  id text primary key,
  world_id uuid not null references public.worlds (id),
  turn int not null,
  t real,
  target jsonb not null,
  before jsonb,
  after jsonb,
  delta real,
  causes jsonb not null check (jsonb_typeof(causes) = 'array' and jsonb_array_length(causes) >= 1)
);
create index transitions_world_turn on public.transitions (world_id, turn);

create table public.snapshots (
  world_id uuid not null references public.worlds (id),
  turn int not null,
  state jsonb not null,
  primary key (world_id, turn)
);

create table public.journal_pages (
  world_id uuid not null references public.worlds (id),
  turn int not null,
  author_id uuid not null references public.profiles (id),
  text text not null default '' check (char_length(text) <= 2000),
  drawing jsonb, -- strokes JSON (05)
  created_at timestamptz not null default now(),
  primary key (world_id, turn)
);

-- ---------------------------------------------------------------------------
-- Helpers for policies
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- A world's history is readable once it's complete, by whoever holds its lock, and by admins.
create function public.can_read_world(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.worlds
    where id = w
      and (status = 'complete'
           or (locked_by = auth.uid() and lock_expires_at > now())
           or public.is_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: read policies only. No insert/update/delete policies on any table.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.worlds enable row level security;
alter table public.turns enable row level security;
alter table public.actions enable row level security;
alter table public.transitions enable row level security;
alter table public.snapshots enable row level security;
alter table public.journal_pages enable row level security;

-- Usernames show on gravestones and in the replay, so profiles are public.
create policy "profiles are public" on public.profiles for select using (true);
create policy "settings are public" on public.settings for select using (true);
create policy "worlds readable when complete, held or admin" on public.worlds for select
  using (public.can_read_world(id));
create policy "turns readable with their world" on public.turns for select using (public.can_read_world(world_id));
create policy "actions readable with their world" on public.actions for select using (public.can_read_world(world_id));
create policy "transitions readable with their world" on public.transitions for select using (public.can_read_world(world_id));
create policy "snapshots readable with their world" on public.snapshots for select using (public.can_read_world(world_id));
create policy "journal pages readable with their world" on public.journal_pages for select using (public.can_read_world(world_id));

-- ---------------------------------------------------------------------------
-- Auth: username signup via synthetic emails (07)
-- Client: signUp({ email: `${username}@players.temporal.local`, password, options: { data: { username } } })
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- For the signup screen: is this username free? Callable before login.
create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(name) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(name));
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
