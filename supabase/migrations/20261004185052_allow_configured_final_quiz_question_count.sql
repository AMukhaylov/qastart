alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_score_range;

alter table public.quiz_attempts
  add constraint quiz_attempts_score_range check (score is null or score between 0 and 90);
