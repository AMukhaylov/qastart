create table if not exists public.course_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  contact_type text not null check (contact_type in ('telegram', 'vk')),
  contact text not null check (char_length(btrim(contact)) between 2 and 160),
  normalized_contact text not null unique,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'confirmed', 'declined')),
  utm_source text check (utm_source is null or char_length(utm_source) <= 200),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 200),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  utm_term text check (utm_term is null or char_length(utm_term) <= 200),
  utm_content text check (utm_content is null or char_length(utm_content) <= 200),
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-11-16',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_applications_status_created_idx
  on public.course_applications (status, created_at desc);

alter table public.course_applications enable row level security;
revoke all on public.course_applications from public, anon, authenticated;
grant select, insert, update, delete on public.course_applications to service_role;

create table if not exists private.course_application_rate_limits (
  ip_hash text not null,
  bucket_start timestamptz not null,
  attempts smallint not null check (attempts between 1 and 32767),
  primary key (ip_hash, bucket_start)
);
create index if not exists course_application_rate_limits_bucket_idx
  on private.course_application_rate_limits (bucket_start);
revoke all on private.course_application_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on private.course_application_rate_limits to service_role;

create or replace function public.reserve_course_application_attempt(p_ip_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bucket_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  v_attempts smallint;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  delete from private.course_application_rate_limits
  where bucket_start < now() - interval '1 day';

  insert into private.course_application_rate_limits (ip_hash, bucket_start, attempts)
  values (p_ip_hash, v_bucket_start, 1)
  on conflict (ip_hash, bucket_start) do update
    set attempts = least(private.course_application_rate_limits.attempts + 1, 11)::smallint
  returning attempts into v_attempts;

  return v_attempts <= 10;
end;
$$;
revoke all on function public.reserve_course_application_attempt(text) from public, anon, authenticated;
grant execute on function public.reserve_course_application_attempt(text) to service_role;

drop trigger if exists course_applications_updated_at on public.course_applications;
create trigger course_applications_updated_at
  before update on public.course_applications
  for each row execute function public.set_lesson_feedback_updated_at();
