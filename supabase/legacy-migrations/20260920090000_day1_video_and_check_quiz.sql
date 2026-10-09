-- Day 1 uses a short checking quiz instead of mentor-reviewed homework.
-- The greeting video remains optional: an admin adds its embed URL later.

do $$
declare
  day_one_id uuid;
begin
  select id into day_one_id
  from public.lessons
  where day_number = 1;

  if day_one_id is null then
    raise exception 'Lesson for day 1 was not found';
  end if;

  -- Repair positions if an earlier interrupted run left its temporary offset.
  update public.lesson_blocks
  set position = position - 100
  where lesson_id = day_one_id
    and position >= 100;

  if not exists (
    select 1
    from public.lesson_blocks
    where lesson_id = day_one_id
      and block_type = 'video'
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_one_id
      and position >= 1;

    insert into public.lesson_blocks (lesson_id, block_type, position, content)
    values (
      day_one_id,
      'video',
      1,
      '{"title":"Приветствие Артура","description":"Короткое приветственное видео появится здесь. Оно не обязательно для прохождения урока."}'::jsonb
    );

    update public.lesson_blocks
    set position = position - 99
    where lesson_id = day_one_id
      and position >= 101;
  end if;

  delete from public.lesson_blocks
  where lesson_id = day_one_id
    and block_type = 'homework';

  if not exists (
    select 1
    from public.lesson_blocks
    where lesson_id = day_one_id
      and block_type = 'heading'
      and content->>'title' = 'Проверочный тест'
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_one_id
      and position >= 24;

    insert into public.lesson_blocks (lesson_id, block_type, position, content)
    values (
      day_one_id,
      'heading',
      24,
      '{"title":"Проверочный тест","eyebrow":"Закрепляем материал"}'::jsonb
    );

    update public.lesson_blocks
    set position = position - 99
    where lesson_id = day_one_id
      and position >= 124;
  end if;
end;
$$;
