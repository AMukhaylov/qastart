create index if not exists homework_messages_author_id_idx
  on public.homework_messages (author_id);

create index if not exists homework_submissions_lesson_id_idx
  on public.homework_submissions (lesson_id);

create index if not exists homework_submissions_reviewed_by_idx
  on public.homework_submissions (reviewed_by);

create index if not exists homework_submissions_user_id_idx
  on public.homework_submissions (user_id);

create index if not exists homework_submissions_status_created_at_idx
  on public.homework_submissions (status, created_at desc);

create index if not exists homework_submissions_user_lesson_created_at_idx
  on public.homework_submissions (user_id, lesson_id, created_at desc);

create index if not exists lesson_progress_lesson_id_idx
  on public.lesson_progress (lesson_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
  on public.user_roles
  for select
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can manage roles" on public.user_roles;
create policy "Admins can manage roles"
  on public.user_roles
  for all
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can insert lessons" on public.lessons;
create policy "Admins can insert lessons"
  on public.lessons
  for insert
  to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can update lessons" on public.lessons;
create policy "Admins can update lessons"
  on public.lessons
  for update
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins can delete lessons" on public.lessons;
create policy "Admins can delete lessons"
  on public.lessons
  for delete
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Users view own progress or admin" on public.lesson_progress;
create policy "Users view own progress or admin"
  on public.lesson_progress
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Users insert own progress" on public.lesson_progress;
create policy "Users insert own progress"
  on public.lesson_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own progress" on public.lesson_progress;
create policy "Users update own progress"
  on public.lesson_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users view own homework or admin" on public.homework_submissions;
create policy "Users view own homework or admin"
  on public.homework_submissions
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.has_role((select auth.uid()), 'admin'::public.app_role))
  );

drop policy if exists "Users submit own homework" on public.homework_submissions;
create policy "Users submit own homework"
  on public.homework_submissions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own pending homework" on public.homework_submissions;
create policy "Users update own pending homework"
  on public.homework_submissions
  for update
  to authenticated
  using ((select auth.uid()) = user_id and status = 'pending'::public.homework_status)
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'::public.homework_status
    and reviewed_by is null
    and reviewed_at is null
    and feedback is null
  );

drop policy if exists "Admins review homework" on public.homework_submissions;
create policy "Admins review homework"
  on public.homework_submissions
  for update
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students can read their homework messages" on public.homework_messages;
create policy "Students can read their homework messages"
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
  );

drop policy if exists "Admins can read all homework messages" on public.homework_messages;
create policy "Admins can read all homework messages"
  on public.homework_messages
  for select
  to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)));
