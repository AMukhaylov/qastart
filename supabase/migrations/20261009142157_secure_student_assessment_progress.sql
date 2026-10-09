-- Student clients may read their own progress/attempts, but cannot write the
-- records that unlock required steps. Trusted server actions use service_role.
revoke insert, update, delete on public.lesson_block_progress from public, anon, authenticated;
grant select on public.lesson_block_progress to authenticated;

drop policy if exists "Users create own block progress" on public.lesson_block_progress;
drop policy if exists "Users update own block progress" on public.lesson_block_progress;
drop policy if exists "Record progress in available lesson" on public.lesson_block_progress;
drop policy if exists "Update progress in available lesson" on public.lesson_block_progress;

revoke insert, update, delete on public.sql_sandbox_attempts from public, anon, authenticated;
grant select on public.sql_sandbox_attempts to authenticated;

drop policy if exists "Students insert own SQL sandbox attempts" on public.sql_sandbox_attempts;
drop policy if exists "Students update own SQL sandbox attempts" on public.sql_sandbox_attempts;
drop policy if exists "Insert SQL attempt in available lesson" on public.sql_sandbox_attempts;
drop policy if exists "Update SQL attempt in available lesson" on public.sql_sandbox_attempts;

-- Passed state is set only by the trusted server role, after it evaluates the
-- student's query against the authoritative task config. This protects against
-- accidental future grants as well as current RLS/GRANT restrictions.
create or replace function public.preserve_sql_task_passed_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'SQL assessment attempts can only be written by the trusted server';
  end if;

  if tg_op = 'UPDATE' and old.passed_at is not null and new.passed then
    new.passed_at := old.passed_at;
  else
    new.passed_at := case when new.passed then now() else null end;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
