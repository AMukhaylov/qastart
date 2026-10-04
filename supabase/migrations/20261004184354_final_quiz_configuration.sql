create table public.final_quiz_settings (
  id boolean primary key default true check (id),
  questions_per_attempt integer not null default 30 check (questions_per_attempt between 1 and 90),
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 240),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  passing_percent integer not null default 70 check (passing_percent between 1 and 100),
  bank_questions jsonb,
  intro_video_url text,
  updated_at timestamptz not null default now()
);

insert into public.final_quiz_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.final_quiz_settings enable row level security;
revoke all on table public.final_quiz_settings from anon, authenticated;
grant select, insert, update on table public.final_quiz_settings to service_role;

create policy "No direct browser access to final quiz settings"
  on public.final_quiz_settings for all to authenticated
  using (false)
  with check (false);

create trigger final_quiz_settings_set_updated_at
  before update on public.final_quiz_settings
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'final-quiz-author',
  'final-quiz-author',
  true,
  536870912,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
