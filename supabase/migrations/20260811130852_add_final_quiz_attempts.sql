create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_order jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  score integer,
  percentage integer,
  passed boolean,
  timed_out boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_attempts_score_range check (score is null or score between 0 and 30),
  constraint quiz_attempts_percentage_range check (percentage is null or percentage between 0 and 100),
  constraint quiz_attempts_finished_state check (
    (finished_at is null and score is null and percentage is null and passed is null)
    or (finished_at is not null and score is not null and percentage is not null and passed is not null)
  )
);

create index quiz_attempts_user_lesson_started_idx
  on public.quiz_attempts (user_id, lesson_id, started_at desc);

alter table public.quiz_attempts enable row level security;

-- Attempts are read and graded only through authenticated server functions.
-- No browser role receives direct access to question order or answer payloads.
revoke all on table public.quiz_attempts from anon, authenticated;
grant select, insert, update on table public.quiz_attempts to service_role;

create policy "No direct browser access to quiz attempts"
  on public.quiz_attempts for all to authenticated
  using (false)
  with check (false);

create trigger quiz_attempts_set_updated_at before update on public.quiz_attempts
  for each row execute function public.set_updated_at();
