-- A student may have one active (including admin-reserved) final quiz attempt at a time.
-- This closes the race between two simultaneous "Start test" requests.
create unique index if not exists quiz_attempts_one_active_per_lesson_idx
  on public.quiz_attempts (user_id, lesson_id)
  where finished_at is null;
