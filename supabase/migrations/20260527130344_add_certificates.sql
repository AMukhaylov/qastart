create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  certificate_number text not null unique,
  verification_code text not null unique,
  course_title text not null default 'Инженер по тестированию ПО',
  student_name text not null,
  mentor_name text not null default 'Артур Мухайлов',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists certificates_active_user_course_idx
  on public.certificates (user_id, course_title)
  where revoked_at is null;

create index if not exists certificates_user_id_idx on public.certificates (user_id);
create index if not exists certificates_issued_at_idx on public.certificates (issued_at desc);

drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

alter table public.certificates enable row level security;

drop policy if exists "Students can view their certificates" on public.certificates;
create policy "Students can view their certificates"
  on public.certificates
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can manage certificates" on public.certificates;
create policy "Admins can manage certificates"
  on public.certificates
  for all
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

grant select on public.certificates to authenticated;
grant select, insert, update, delete on public.certificates to service_role;
