-- Store one authoritative response per student and lesson question for analytics.
-- Snapshot question/options so historical results remain understandable after edits.
create table if not exists public.lesson_question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null references public.lesson_blocks(id) on delete cascade,
  question_text text not null,
  options text[] not null,
  selected_indexes integer[] not null check (cardinality(selected_indexes) > 0),
  correct_indexes integer[] not null check (cardinality(correct_indexes) > 0),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (user_id, block_id)
);

create index if not exists lesson_question_answers_lesson_block_idx
  on public.lesson_question_answers (lesson_id, block_id);
create index if not exists lesson_question_answers_user_answered_idx
  on public.lesson_question_answers (user_id, answered_at desc);

alter table public.lesson_question_answers enable row level security;
revoke all on public.lesson_question_answers from public, anon, authenticated;
grant select, insert on public.lesson_question_answers to service_role;
