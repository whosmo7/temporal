-- Decision 035: backing out to Home gives the world back. The holder's day is voided (nothing was
-- written for it), the lock is cleared, and their next Play is a fresh draw. A no-op for a world
-- the caller doesn't hold.
create function public.release_world(world uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.worlds
  set locked_by = null, locked_at = null, lock_expires_at = null
  where id = world and locked_by = auth.uid();
$$;

revoke execute on function public.release_world(uuid) from public, anon;
grant execute on function public.release_world(uuid) to authenticated;
