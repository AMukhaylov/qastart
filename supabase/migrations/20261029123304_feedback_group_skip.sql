alter table public.student_groups
  add column if not exists allow_feedback_skip boolean not null default false;

create table if not exists public.lesson_feedback_skips (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_feedback_skips_lesson_created_idx
  on public.lesson_feedback_skips (lesson_id, created_at desc);

alter table public.lesson_feedback_skips enable row level security;
revoke all on public.lesson_feedback_skips from public, anon, authenticated;
grant select, insert, update, delete on public.lesson_feedback_skips to service_role;
