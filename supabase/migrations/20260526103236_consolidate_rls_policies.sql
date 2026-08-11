drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Users can view own profile or admins view all"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Users can view their own roles" on public.user_roles;
drop policy if exists "Admins can view all roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;

create policy "Users can view own roles or admins view all"
  on public.user_roles
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

create policy "Admins can insert roles"
  on public.user_roles
  for insert
  to authenticated
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "Admins can update roles"
  on public.user_roles
  for update
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "Admins can delete roles"
  on public.user_roles
  for delete
  to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Users update own pending homework" on public.homework_submissions;
drop policy if exists "Admins review homework" on public.homework_submissions;
create policy "Users update own pending homework or admins review"
  on public.homework_submissions
  for update
  to authenticated
  using (
    (
      (select auth.uid()) = user_id
      and status = 'pending'::public.homework_status
    )
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  )
  with check (
    (
      (select auth.uid()) = user_id
      and status = 'pending'::public.homework_status
      and reviewed_by is null
      and reviewed_at is null
      and feedback is null
    )
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Students can read their homework messages" on public.homework_messages;
drop policy if exists "Admins can read all homework messages" on public.homework_messages;
create policy "Users can read own homework messages or admins read all"
  on public.homework_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.homework_submissions hs
      where hs.id = homework_messages.submission_id
        and hs.user_id = (select auth.uid())
    )
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

notify pgrst, 'reload schema';
