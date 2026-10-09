create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
  on public.user_roles
  for select
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can manage roles" on public.user_roles;
create policy "Admins can manage roles"
  on public.user_roles
  for all
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can insert lessons" on public.lessons;
create policy "Admins can insert lessons"
  on public.lessons
  for insert
  to authenticated
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can update lessons" on public.lessons;
create policy "Admins can update lessons"
  on public.lessons
  for update
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can delete lessons" on public.lessons;
create policy "Admins can delete lessons"
  on public.lessons
  for delete
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Users view own progress or admin" on public.lesson_progress;
create policy "Users view own progress or admin"
  on public.lesson_progress
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Users view own homework or admin" on public.homework_submissions;
create policy "Users view own homework or admin"
  on public.homework_submissions
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Admins review homework" on public.homework_submissions;
create policy "Admins review homework"
  on public.homework_submissions
  for update
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can read all homework messages" on public.homework_messages;
create policy "Admins can read all homework messages"
  on public.homework_messages
  for select
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

notify pgrst, 'reload schema';
