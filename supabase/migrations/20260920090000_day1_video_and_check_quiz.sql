-- Day 1 uses a short checking quiz instead of mentor-reviewed homework.
-- The greeting video remains optional: an admin adds its embed URL later.

update public.lesson_blocks
set position = position + 100
where lesson_id = (select id from public.lessons where day_number = 1)
  and position >= 1
  and not exists (
    select 1 from public.lesson_blocks existing
    where existing.lesson_id = lesson_blocks.lesson_id
      and existing.block_type = 'video'
  );

insert into public.lesson_blocks (lesson_id, block_type, position, content)
select id, 'video', 1,
  '{"title":"Приветствие Артура","description":"Короткое приветственное видео появится здесь. Оно не обязательно для прохождения урока."}'::jsonb
from day_one
where not exists (
  select 1 from public.lesson_blocks
  where lesson_id = day_one.id and block_type = 'video'
);

update public.lesson_blocks
set position = position - 99
where lesson_id = (select id from public.lessons where day_number = 1)
  and position >= 101;

delete from public.lesson_blocks
where lesson_id = (select id from public.lessons where day_number = 1)
  and block_type = 'homework';

update public.lesson_blocks
set position = position + 100
where lesson_id = (select id from public.lessons where day_number = 1)
  and position >= 24
  and not exists (
    select 1 from public.lesson_blocks existing
    where existing.lesson_id = lesson_blocks.lesson_id
      and existing.block_type = 'heading'
      and existing.content->>'title' = 'Проверочный тест'
  );

insert into public.lesson_blocks (lesson_id, block_type, position, content)
select id, 'heading', 24,
  '{"title":"Проверочный тест","eyebrow":"Закрепляем материал"}'::jsonb
from day_one
where not exists (
  select 1 from public.lesson_blocks
  where lesson_id = day_one.id
    and block_type = 'heading'
    and content->>'title' = 'Проверочный тест'
);

update public.lesson_blocks
set position = position - 99
where lesson_id = (select id from public.lessons where day_number = 1)
  and position >= 124;
