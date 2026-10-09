-- A student can complete at most three new lessons during one calendar day
-- in the course time zone. Existing completed lessons remain available for review.
create or replace function public.enforce_daily_new_lesson_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  course_day_start timestamptz;
  completed_count integer;
begin
  if new.completed is not true then
    return new;
  end if;

  -- Trusted server actions perform the same check in application code. This keeps
  -- mentor approval of older homework from being blocked by a student's daily limit.
  if current_user = 'service_role' then
    return new;
  end if;

  -- A student cannot backdate a completion or edit a previously recorded one.
  if tg_op = 'UPDATE' and old.completed is true then
    new.completed_at := old.completed_at;
    return new;
  end if;

  new.completed_at := now();

  -- Serialise attempts for one student so parallel browser requests cannot exceed the limit.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  course_day_start := date_trunc('day', now() at time zone 'Asia/Yekaterinburg')
    at time zone 'Asia/Yekaterinburg';

  select count(*)
    into completed_count
    from public.lesson_progress
   where user_id = new.user_id
     and completed is true
     and completed_at >= course_day_start
     and completed_at < course_day_start + interval '1 day';

  if completed_count >= 3 then
    raise exception 'Daily lesson limit reached: three new lessons per course day';
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_progress_daily_limit on public.lesson_progress;
create trigger lesson_progress_daily_limit
before insert or update of completed, completed_at on public.lesson_progress
for each row execute function public.enforce_daily_new_lesson_limit();
