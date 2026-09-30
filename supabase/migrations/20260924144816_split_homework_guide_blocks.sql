-- The guide shown before homework used to live inside the homework JSON.
-- Make it a real, independently sortable lesson block while preserving every existing lesson.
do $$
begin
  -- Move all current positions to free an integer slot immediately before each homework block.
  -- The temporary offset avoids the unique (lesson_id, position) constraint during the rewrite.
  update public.lesson_blocks
  set position = position + 1000000;

  update public.lesson_blocks
  set position = (position - 1000000) * 2;

  insert into public.lesson_blocks (lesson_id, block_type, position, content)
  select
    homework.lesson_id,
    'guide',
    homework.position - 1,
    jsonb_build_object(
      'variant', coalesce(nullif(homework.content->>'guideVariant', ''), 'task'),
      'title', coalesce(nullif(homework.content->>'guideTitle', ''), 'Самостоятельная практика'),
      'text', coalesce(
        nullif(homework.content->>'guideText', ''),
        'Здесь можно применить знания на своей задаче. Обязательность домашнего задания настраивается в редакторе урока.'
      ),
      'visible', true,
      'required', false,
      'blocksNext', false,
      'legacyHomeworkGuide', true
    )
  from public.lesson_blocks as homework
  where homework.block_type = 'homework';
end;
$$;
