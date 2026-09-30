-- Organizational student groups and dynamic meeting audiences.
-- These tables intentionally do not reference lesson_progress, homework or certificates.

create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_students (
  group_id uuid not null references public.student_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index if not exists group_students_student_id_idx on public.group_students(student_id);

create table if not exists public.meeting_groups (
  meeting_id uuid not null references public.course_meetings(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, group_id)
);

create index if not exists meeting_groups_group_id_idx on public.meeting_groups(group_id);

create table if not exists public.meeting_students (
  meeting_id uuid not null references public.course_meetings(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, student_id)
);

create index if not exists meeting_students_student_id_idx on public.meeting_students(student_id);

drop trigger if exists student_groups_set_updated_at on public.student_groups;
create trigger student_groups_set_updated_at
  before update on public.student_groups
  for each row execute function public.set_updated_at();

alter table public.student_groups enable row level security;
alter table public.group_students enable row level security;
alter table public.meeting_groups enable row level security;
alter table public.meeting_students enable row level security;

drop policy if exists "Admins can manage student groups" on public.student_groups;
create policy "Admins can manage student groups" on public.student_groups
  for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students can view their groups" on public.student_groups;
create policy "Students can view their groups" on public.student_groups
  for select to authenticated
  using (exists (
    select 1 from public.group_students gs
    where gs.group_id = student_groups.id and gs.student_id = (select auth.uid())
  ));

drop policy if exists "Admins can manage group students" on public.group_students;
create policy "Admins can manage group students" on public.group_students
  for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students can view own group memberships" on public.group_students;
create policy "Students can view own group memberships" on public.group_students
  for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists "Admins can manage meeting groups" on public.meeting_groups;
create policy "Admins can manage meeting groups" on public.meeting_groups
  for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students can view published meeting groups" on public.meeting_groups;
create policy "Students can view published meeting groups" on public.meeting_groups
  for select to authenticated
  using (exists (
    select 1 from public.course_meetings cm
    where cm.id = meeting_groups.meeting_id and cm.is_published = true
  ));

drop policy if exists "Admins can manage meeting students" on public.meeting_students;
create policy "Admins can manage meeting students" on public.meeting_students
  for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students can view own meeting assignments" on public.meeting_students;
create policy "Students can view own meeting assignments" on public.meeting_students
  for select to authenticated
  using (student_id = (select auth.uid()));

-- Keep existing meetings available to all students when no audience was configured.
-- Once a group or individual audience is configured, access is computed dynamically.
drop policy if exists "Students can view published course meetings" on public.course_meetings;
create policy "Students can view published course meetings" on public.course_meetings
  for select to authenticated
  using (
    is_published = true
    and (
      (not exists (select 1 from public.meeting_groups mg where mg.meeting_id = course_meetings.id)
       and not exists (select 1 from public.meeting_students ms where ms.meeting_id = course_meetings.id))
      or exists (select 1 from public.meeting_students ms where ms.meeting_id = course_meetings.id and ms.student_id = (select auth.uid()))
      or exists (
        select 1
        from public.meeting_groups mg
        join public.group_students gs on gs.group_id = mg.group_id
        where mg.meeting_id = course_meetings.id and gs.student_id = (select auth.uid())
      )
    )
  );

grant select on public.student_groups, public.group_students, public.meeting_groups, public.meeting_students to authenticated;
grant select, insert, update, delete on public.student_groups, public.group_students, public.meeting_groups, public.meeting_students to service_role;
