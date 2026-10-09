-- Keep client access limited to the operations the application actually uses.
-- In particular, TRUNCATE, REFERENCES and TRIGGER bypass row-level policies
-- and are not needed by the student-facing API.
revoke all privileges on table public.lesson_block_progress
  from public, anon, authenticated;
grant select on table public.lesson_block_progress to authenticated;

revoke all privileges on table public.sql_sandbox_attempts
  from public, anon, authenticated;
grant select on table public.sql_sandbox_attempts to authenticated;

notify pgrst, 'reload schema';
