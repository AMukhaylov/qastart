-- Stores student SQL answers and checked results only. User SQL is never sent to
-- PostgreSQL; execution happens in a freshly seeded in-memory SQLite database.
create table if not exists public.sql_sandbox_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null references public.lesson_blocks(id) on delete cascade,
  task_id text not null check (length(task_id) between 1 and 80),
  query_text text not null default '' check (length(query_text) <= 4000),
  passed boolean not null default false,
  result_columns jsonb not null default '[]'::jsonb,
  result_rows jsonb not null default '[]'::jsonb,
  feedback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, block_id, task_id)
);

create index if not exists sql_sandbox_attempts_user_lesson_idx
  on public.sql_sandbox_attempts (user_id, lesson_id);

alter table public.sql_sandbox_attempts enable row level security;
revoke all on public.sql_sandbox_attempts from public, anon;
grant select, insert, update on public.sql_sandbox_attempts to authenticated;
grant select, insert, update, delete on public.sql_sandbox_attempts to service_role;

create policy "Students read own SQL sandbox attempts"
  on public.sql_sandbox_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students insert own SQL sandbox attempts"
  on public.sql_sandbox_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Students update own SQL sandbox attempts"
  on public.sql_sandbox_attempts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger sql_sandbox_attempts_set_updated_at
  before update on public.sql_sandbox_attempts
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
