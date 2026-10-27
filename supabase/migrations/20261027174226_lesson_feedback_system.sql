create table if not exists public.lesson_feedback_course_settings (
  id boolean primary key default true check (id),
  required_by_default boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.lesson_feedback_course_settings (id, required_by_default)
values (true, true)
on conflict (id) do nothing;

create table if not exists public.lesson_feedback_settings (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  required_override boolean,
  use_common_template boolean not null default true,
  questions jsonb not null,
  updated_at timestamptz not null default now(),
  constraint lesson_feedback_questions_array check (jsonb_typeof(questions) = 'array')
);

create table if not exists public.lesson_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  answers jsonb not null,
  rating smallint not null check (rating between 1 and 10),
  difficulty text not null check (difficulty in ('too_easy', 'normal', 'hard', 'too_hard')),
  comment text,
  status text not null default 'completed' check (status = 'completed'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id),
  constraint lesson_feedback_answers_object check (jsonb_typeof(answers) = 'object')
);

create index if not exists lesson_feedback_lesson_created_idx
  on public.lesson_feedback (lesson_id, created_at desc);
create index if not exists lesson_feedback_user_created_idx
  on public.lesson_feedback (user_id, created_at desc);
create index if not exists lesson_feedback_rating_idx
  on public.lesson_feedback (rating);
create index if not exists lesson_feedback_difficulty_idx
  on public.lesson_feedback (difficulty);

alter table public.lesson_feedback_course_settings enable row level security;
alter table public.lesson_feedback_settings enable row level security;
alter table public.lesson_feedback enable row level security;

drop policy if exists "Admins manage course feedback settings" on public.lesson_feedback_course_settings;
create policy "Admins manage course feedback settings"
  on public.lesson_feedback_course_settings for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Admins manage lesson feedback settings" on public.lesson_feedback_settings;
create policy "Admins manage lesson feedback settings"
  on public.lesson_feedback_settings for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Students view own feedback or admins view all" on public.lesson_feedback;
create policy "Students view own feedback or admins view all"
  on public.lesson_feedback for select to authenticated
  using ((select auth.uid()) = user_id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role)));

revoke all on public.lesson_feedback_course_settings, public.lesson_feedback_settings,
  public.lesson_feedback from anon, authenticated;
grant select, insert, update, delete on public.lesson_feedback_course_settings,
  public.lesson_feedback_settings to authenticated;
grant select on public.lesson_feedback to authenticated;
grant select, insert, update, delete on public.lesson_feedback_course_settings,
  public.lesson_feedback_settings, public.lesson_feedback to service_role;

create or replace function public.set_lesson_feedback_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_lesson_feedback_updated_at() from public, anon, authenticated;
grant execute on function public.set_lesson_feedback_updated_at() to service_role;

drop trigger if exists lesson_feedback_settings_updated_at on public.lesson_feedback_settings;
create trigger lesson_feedback_settings_updated_at
  before update on public.lesson_feedback_settings
  for each row execute function public.set_lesson_feedback_updated_at();

drop trigger if exists lesson_feedback_course_settings_updated_at on public.lesson_feedback_course_settings;
create trigger lesson_feedback_course_settings_updated_at
  before update on public.lesson_feedback_course_settings
  for each row execute function public.set_lesson_feedback_updated_at();

-- Default survey template is data, not frontend hard-coding; admins can customize each lesson.
insert into public.lesson_feedback_settings (lesson_id, questions)
select l.id, '[
  {"id":"rating","type":"rating","label":"Оцени этот урок","required":true},
  {"id":"good","type":"textarea","label":"Что в уроке было хорошо?","required":true},
  {"id":"unclear","type":"textarea","label":"Что было непонятно или неудобно?","required":true},
  {"id":"improve","type":"textarea","label":"Что можно улучшить?","required":true},
  {"id":"difficulty","type":"radio","label":"Насколько сложным был урок?","required":true,"options":[{"label":"Слишком легко","value":"too_easy"},{"label":"Нормально","value":"normal"},{"label":"Сложно","value":"hard"},{"label":"Слишком сложно","value":"too_hard"}]},
  {"id":"comment","type":"textarea","label":"Дополнительный комментарий","required":false}
]'::jsonb
from public.lessons l
on conflict (lesson_id) do nothing;

create or replace function public.default_lesson_feedback_questions()
returns jsonb language sql immutable set search_path = '' as $$
  select '[
    {"id":"rating","type":"rating","label":"Оцени этот урок","required":true},
    {"id":"good","type":"textarea","label":"Что в уроке было хорошо?","required":true},
    {"id":"unclear","type":"textarea","label":"Что было непонятно или неудобно?","required":true},
    {"id":"improve","type":"textarea","label":"Что можно улучшить?","required":true},
    {"id":"difficulty","type":"radio","label":"Насколько сложным был урок?","required":true,"options":[{"label":"Слишком легко","value":"too_easy"},{"label":"Нормально","value":"normal"},{"label":"Сложно","value":"hard"},{"label":"Слишком сложно","value":"too_hard"}]},
    {"id":"comment","type":"textarea","label":"Дополнительный комментарий","required":false}
  ]'::jsonb;
$$;
revoke all on function public.default_lesson_feedback_questions() from public, anon, authenticated;
grant execute on function public.default_lesson_feedback_questions() to service_role;

create table if not exists public.lesson_feedback_templates (
  id boolean primary key default true check (id),
  questions jsonb not null default public.default_lesson_feedback_questions(),
  updated_at timestamptz not null default now(),
  constraint lesson_feedback_template_questions_array check (jsonb_typeof(questions) = 'array')
);
insert into public.lesson_feedback_templates (id)
values (true)
on conflict (id) do nothing;
alter table public.lesson_feedback_templates enable row level security;
drop policy if exists "Admins manage lesson feedback template" on public.lesson_feedback_templates;
create policy "Admins manage lesson feedback template"
  on public.lesson_feedback_templates for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
revoke all on public.lesson_feedback_templates from anon, authenticated;
grant select, insert, update, delete on public.lesson_feedback_templates to authenticated;
grant select, insert, update, delete on public.lesson_feedback_templates to service_role;

drop trigger if exists lesson_feedback_template_updated_at on public.lesson_feedback_templates;
create trigger lesson_feedback_template_updated_at
  before update on public.lesson_feedback_templates
  for each row execute function public.set_lesson_feedback_updated_at();

alter table public.lesson_feedback_settings
  alter column questions set default public.default_lesson_feedback_questions();

create or replace function public.initialize_lesson_feedback_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lesson_feedback_settings (lesson_id, questions)
  values (new.id, public.default_lesson_feedback_questions())
  on conflict (lesson_id) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_lesson_feedback_settings() from public, anon, authenticated;
grant execute on function public.initialize_lesson_feedback_settings() to service_role;

drop trigger if exists initialize_lesson_feedback_settings on public.lessons;
create trigger initialize_lesson_feedback_settings
  after insert on public.lessons
  for each row execute function public.initialize_lesson_feedback_settings();
