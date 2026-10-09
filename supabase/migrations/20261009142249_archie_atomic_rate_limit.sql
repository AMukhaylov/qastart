-- Reserve an Archie request atomically before contacting the AI provider.
-- The per-user transaction advisory lock serializes concurrent instances.
create or replace function public.reserve_archie_request(
  p_user_id uuid,
  p_lesson_id uuid,
  p_provider text,
  p_model text,
  p_limit integer
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request_id bigint;
  v_recent_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Archie request reservations require the trusted server role';
  end if;
  if p_user_id is null or p_limit is null or p_limit < 1 or p_limit > 60 then
    raise exception 'Invalid Archie request reservation parameters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select count(*)::integer into v_recent_count
  from public.archie_request_stats
  where user_id = p_user_id
    and created_at >= pg_catalog.clock_timestamp() - interval '60 seconds';

  if v_recent_count >= p_limit then
    return null;
  end if;

  insert into public.archie_request_stats (
    user_id, lesson_id, provider, model, status, created_at
  ) values (
    p_user_id, p_lesson_id, p_provider, p_model, 'error', pg_catalog.clock_timestamp()
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.reserve_archie_request(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_archie_request(uuid, uuid, text, text, integer)
  to service_role;

notify pgrst, 'reload schema';
