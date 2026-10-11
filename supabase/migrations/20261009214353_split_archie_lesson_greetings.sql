alter table public.archie_settings
  add column first_lesson_greetings jsonb not null default '[
    {"text":"Привет! Я Арчи, твой ИИ-помощник курса 👋 Если что-то будет непонятно, помогу разобраться в материале урока. Смело обращайся!","enabled":true},
    {"text":"Привет! Я Арчи, ИИ-помощник курса 👋 Буду рядом во время обучения. Если что-то покажется сложным или непонятным, просто напиши мне.","enabled":true},
    {"text":"Привет! Меня зовут Арчи 👋 Я ИИ-помощник курса. Если появятся вопросы по материалу, помогу во всём разобраться.","enabled":true}
  ]'::jsonb,
  add column regular_lesson_greetings jsonb not null default '[
    {"text":"Привет! Рад тебя видеть 👋 Если появятся вопросы по этому уроку, смело обращайся.","enabled":true},
    {"text":"Привет! Я рядом 👋 Если что-то в этом уроке окажется непонятным, напиши мне.","enabled":true},
    {"text":"Привет! Продолжаем обучение 🙂 Если понадобится помощь с материалом урока, обращайся.","enabled":true},
    {"text":"Привет! Если по ходу урока появятся вопросы, я здесь и помогу разобраться.","enabled":true}
  ]'::jsonb;

-- Preserve the messages previously configured by admins for the first lesson.
-- The old shared greeting set often introduced Archie on every lesson, so it is
-- intentionally not copied to the new regular-lesson set.
update public.archie_settings
set first_lesson_greetings = (
  select jsonb_agg(jsonb_build_object('text', greeting, 'enabled', true) order by position)
  from unnest(greeting_messages) with ordinality as legacy(greeting, position)
  where nullif(btrim(greeting), '') is not null
)
where cardinality(greeting_messages) > 0;
