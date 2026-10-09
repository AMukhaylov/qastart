-- An account can exist before its individual course begins. Dates supplied by
-- the admin are stored as midnight in the course time zone (Europe/Moscow).
alter table public.profiles add column if not exists course_start_at timestamptz;

-- Preserve access for students who were already studying before this field
-- existed. The earliest date consistent with their recorded activity is used;
-- an account with no course activity remains unscheduled.
with historical_activity as (
  select lp.user_id, l.day_number, coalesce(lp.completed_at, lp.created_at) as occurred_at
  from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
  union all
  select bp.user_id, l.day_number, bp.completed_at
  from public.lesson_block_progress bp join public.lessons l on l.id = bp.lesson_id
  union all
  select hs.user_id, l.day_number, hs.created_at
  from public.homework_submissions hs join public.lessons l on l.id = hs.lesson_id
  union all
  select sa.user_id, l.day_number, sa.created_at
  from public.sql_sandbox_attempts sa join public.lessons l on l.id = sa.lesson_id
  union all
  select qa.user_id, l.day_number, qa.started_at
  from public.quiz_attempts qa join public.lessons l on l.id = qa.lesson_id
), historical_start as (
  select user_id,
         min((occurred_at at time zone 'Europe/Moscow')::date - (day_number - 1)) as start_day
  from historical_activity
  group by user_id
)
update public.profiles p
set course_start_at = historical_start.start_day::timestamp at time zone 'Europe/Moscow'
from historical_start
where p.id = historical_start.user_id and p.course_start_at is null;

create or replace function public.protect_course_start_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.course_start_at is not null and current_user <> 'service_role' then
      raise exception 'Only the administrator can schedule the course';
    end if;
    return new;
  end if;

  if new.course_start_at is distinct from old.course_start_at then
    if current_user <> 'service_role' then
      raise exception 'Only the administrator can change the course start';
    end if;
    if old.course_start_at is not null and old.course_start_at <= now() then
      raise exception 'The course has already started; its start date cannot be edited';
    end if;
    if exists (select 1 from public.lesson_progress where user_id = old.id)
       or exists (select 1 from public.lesson_block_progress where user_id = old.id)
       or exists (select 1 from public.homework_submissions where user_id = old.id)
       or exists (select 1 from public.sql_sandbox_attempts where user_id = old.id)
       or exists (select 1 from public.quiz_attempts where user_id = old.id) then
      raise exception 'Course activity exists; use a separate reset operation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_course_start_at on public.profiles;
create trigger protect_course_start_at
before insert or update on public.profiles
for each row execute function public.protect_course_start_at();

-- A completed lesson keeps its original completion timestamp on every retry.
-- The server and this trigger both enforce the individual calendar schedule.
create or replace function public.enforce_individual_lesson_schedule()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  lesson_day integer;
  planned_start timestamptz;
begin
  if new.completed is not true then return new; end if;
  if tg_op = 'UPDATE' and old.completed is true then
    new.completed_at := old.completed_at;
    return new;
  end if;

  select day_number into lesson_day from public.lessons where id = new.lesson_id;
  select course_start_at into planned_start from public.profiles where id = new.user_id;
  if lesson_day is null then raise exception 'Lesson not found'; end if;
  if not exists (select 1 from public.user_roles where user_id = new.user_id and role = 'admin')
     and (planned_start is null or
          (now() at time zone 'Europe/Moscow')::date <
          (planned_start at time zone 'Europe/Moscow')::date + (lesson_day - 1)) then
    raise exception 'Lesson is not yet available on the individual course schedule';
  end if;
  new.completed_at := now();
  return new;
end;
$$;

drop trigger if exists lesson_progress_daily_limit on public.lesson_progress;
drop trigger if exists lesson_progress_individual_schedule on public.lesson_progress;
create trigger lesson_progress_individual_schedule
before insert or update of completed, completed_at on public.lesson_progress
for each row execute function public.enforce_individual_lesson_schedule();

-- Direct Data API reads and browser writes obey the same schedule.
drop policy if exists "Anyone authenticated can view lessons" on public.lessons;
create policy "Read lessons available on personal schedule"
on public.lessons for select to authenticated using (
  (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.course_start_at is not null
      and (now() at time zone 'Europe/Moscow')::date >=
          (p.course_start_at at time zone 'Europe/Moscow')::date + (day_number - 1)
  )
);

drop policy if exists "Authenticated users read lesson blocks" on public.lesson_blocks;
create policy "Read blocks of available lessons"
on public.lesson_blocks for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id)
);

drop policy if exists "Users create own block progress" on public.lesson_block_progress;
create policy "Record progress in available lesson"
on public.lesson_block_progress for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.lessons l where l.id = lesson_id)
  and exists (select 1 from public.lesson_blocks b where b.id = block_id and b.lesson_id = lesson_id)
);
drop policy if exists "Users update own block progress" on public.lesson_block_progress;
create policy "Update progress in available lesson"
on public.lesson_block_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.lessons l where l.id = lesson_id)
  and exists (select 1 from public.lesson_blocks b where b.id = block_id and b.lesson_id = lesson_id)
);

drop policy if exists "Students insert own SQL sandbox attempts" on public.sql_sandbox_attempts;
create policy "Insert SQL attempt in available lesson"
on public.sql_sandbox_attempts for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.lessons l where l.id = lesson_id)
  and exists (select 1 from public.lesson_blocks b where b.id = block_id and b.lesson_id = lesson_id)
);
drop policy if exists "Students update own SQL sandbox attempts" on public.sql_sandbox_attempts;
create policy "Update SQL attempt in available lesson"
on public.sql_sandbox_attempts for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.lessons l where l.id = lesson_id)
  and exists (select 1 from public.lesson_blocks b where b.id = block_id and b.lesson_id = lesson_id)
);

-- The first time every SQL task is passed is the automatic homework submission.
alter table public.sql_sandbox_attempts add column if not exists passed_at timestamptz;
update public.sql_sandbox_attempts set passed_at = updated_at
where passed and passed_at is null;

create or replace function public.preserve_sql_task_passed_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.passed_at is not null then
    new.passed := true;
    new.passed_at := old.passed_at;
  else
    new.passed_at := case when new.passed then now() else null end;
  end if;
  return new;
end;
$$;
drop trigger if exists sql_task_passed_at on public.sql_sandbox_attempts;
create trigger sql_task_passed_at before insert or update on public.sql_sandbox_attempts
for each row execute function public.preserve_sql_task_passed_at();

-- Submission times must be server-generated and immutable on resubmission.
create or replace function public.stamp_homework_submission()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists homework_submission_timestamp on public.homework_submissions;
create trigger homework_submission_timestamp
before insert or update on public.homework_submissions
for each row execute function public.stamp_homework_submission();

-- Homework is submitted through the authenticated server action, which checks
-- lesson completion and ownership before using the service role.
drop policy if exists "Users submit own homework" on public.homework_submissions;
drop policy if exists "Users update own pending homework or admins review" on public.homework_submissions;
revoke insert, update on public.homework_submissions from authenticated;

notify pgrst, 'reload schema';
