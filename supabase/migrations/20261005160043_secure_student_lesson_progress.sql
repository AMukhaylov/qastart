-- Course completion unlocks later lessons and the final exam. Students may read
-- their own progress, but only trusted server actions may create/update it.
drop policy if exists "Users insert own progress" on public.lesson_progress;
drop policy if exists "Users update own progress" on public.lesson_progress;
revoke insert, update on public.lesson_progress from authenticated;
