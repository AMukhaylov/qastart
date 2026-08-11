create table if not exists public.course_meetings (
  id uuid primary key default gen_random_uuid(),
  position integer not null unique check (position between 1 and 2),
  title text not null default '',
  description text not null default '',
  meeting_url text not null default '',
  starts_at timestamptz null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists course_meetings_set_updated_at on public.course_meetings;
create trigger course_meetings_set_updated_at
  before update on public.course_meetings
  for each row execute function public.set_updated_at();

alter table public.course_meetings enable row level security;

drop policy if exists "Students can view published course meetings" on public.course_meetings;
create policy "Students can view published course meetings"
  on public.course_meetings
  for select
  to authenticated
  using (is_published = true);

drop policy if exists "Admins can manage course meetings" on public.course_meetings;
create policy "Admins can manage course meetings"
  on public.course_meetings
  for all
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

grant select on public.course_meetings to authenticated;
grant select, insert, update, delete on public.course_meetings to service_role;

insert into public.course_meetings (position, title, description)
values
  (1, 'Встреча 1', 'Разбор вопросов и практика по первой части курса.'),
  (2, 'Встреча 2', 'Итоговая встреча: вопросы, разбор ошибок и дальнейший план.')
on conflict (position) do nothing;
