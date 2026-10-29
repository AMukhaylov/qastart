-- Feedback policy is attached to a cohort, not inferred from group membership.
-- Students without a group continue to use the explicit default-cohort settings.
alter table public.student_groups
  add column if not exists lesson_feedback_required boolean not null default false,
  add column if not exists course_feedback_required boolean not null default false;

alter table public.lesson_feedback_course_settings
  add column if not exists enabled_by_default boolean not null default true,
  add column if not exists course_feedback_required_by_default boolean not null default true;

-- Keep the existing ungrouped / zero-cohort behavior, while allowing admins to
-- independently disable lesson forms and to configure the final course survey.
update public.lesson_feedback_course_settings
set enabled_by_default = true,
    course_feedback_required_by_default = true
where id = true;

create or replace function public.default_course_feedback_questions()
returns jsonb language sql immutable set search_path = '' as $$
  select '[
    {"id":"course_rating","type":"rating","label":"Оцени курс в целом","required":true},
    {"id":"most_useful","type":"textarea","label":"Что было самым полезным на курсе?","required":true},
    {"id":"course_unclear","type":"textarea","label":"Что осталось непонятным?","required":true},
    {"id":"course_improve","type":"textarea","label":"Что стоит улучшить в курсе?","required":true},
    {"id":"recommend","type":"radio","label":"Порекомендовал(а) бы ты курс?","required":true,"options":[{"label":"Да","value":"yes"},{"label":"Не уверен(а)","value":"unsure"},{"label":"Нет","value":"no"}]},
    {"id":"course_comment","type":"textarea","label":"Дополнительный комментарий","required":false}
  ]'::jsonb;
$$;
revoke all on function public.default_course_feedback_questions() from public, anon, authenticated;
grant execute on function public.default_course_feedback_questions() to service_role;

create table if not exists public.course_feedback_templates (
  id boolean primary key default true check (id),
  questions jsonb not null default public.default_course_feedback_questions(),
  updated_at timestamptz not null default now(),
  constraint course_feedback_template_questions_array check (jsonb_typeof(questions) = 'array')
);
insert into public.course_feedback_templates (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.course_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  answers jsonb not null,
  status text not null default 'completed' check (status = 'completed'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_feedback_answers_object check (jsonb_typeof(answers) = 'object')
);
create index if not exists course_feedback_created_idx
  on public.course_feedback (created_at desc);

alter table public.course_feedback_templates enable row level security;
alter table public.course_feedback enable row level security;
revoke all on public.course_feedback_templates, public.course_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.course_feedback_templates to service_role;
grant select, insert, update, delete on public.course_feedback to service_role;

drop trigger if exists course_feedback_template_updated_at on public.course_feedback_templates;
create trigger course_feedback_template_updated_at
  before update on public.course_feedback_templates
  for each row execute function public.set_lesson_feedback_updated_at();
drop trigger if exists course_feedback_updated_at on public.course_feedback;
create trigger course_feedback_updated_at
  before update on public.course_feedback
  for each row execute function public.set_lesson_feedback_updated_at();
