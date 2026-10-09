create table if not exists public.course_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text,
  status text not null default 'active'
    check (status in ('active', 'used', 'revoked')),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_invites_status_expires_idx
  on public.course_invites (status, expires_at);

drop trigger if exists course_invites_set_updated_at on public.course_invites;
create trigger course_invites_set_updated_at
  before update on public.course_invites
  for each row execute function public.set_updated_at();

alter table public.course_invites enable row level security;

drop policy if exists "Admins manage course invites" on public.course_invites;
create policy "Admins manage course invites"
  on public.course_invites
  for all
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

grant select, insert, update, delete on public.course_invites to authenticated;
grant select, insert, update, delete on public.course_invites to service_role;
