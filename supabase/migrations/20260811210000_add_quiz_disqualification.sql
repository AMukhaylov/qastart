alter table public.quiz_attempts
  add column if not exists disqualified boolean not null default false;
