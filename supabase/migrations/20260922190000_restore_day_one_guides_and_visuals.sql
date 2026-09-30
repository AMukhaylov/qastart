-- Restore the Day 1 teaching cards after removing the accidental duplicate copy.
do $$
declare
  lesson_uuid uuid;
  guide_count integer;
begin
  select id into lesson_uuid from public.lessons where day_number = 1;
  if lesson_uuid is null then raise exception 'Day 1 is missing'; end if;
  select count(*) into guide_count from public.lesson_blocks where lesson_id = lesson_uuid and block_type = 'guide';
  if guide_count > 0 then return; end if;

  update public.lesson_blocks set position = position + 100000 where lesson_id = lesson_uuid;
  update public.lesson_blocks set position = (position - 100000 + 1) * 10 where lesson_id = lesson_uuid;

  insert into public.lesson_blocks (lesson_id, block_type, position, content) values
    (lesson_uuid, 'guide', 20, '{"variant":"intro","title":"Как проходит проверка продукта","text":"Тестирование сопровождает разработку продукта. Команда заранее проверяет важные сценарии, находит риски и получает информацию для решений до выхода к пользователям.","visible":true,"required":false,"blocksNext":false}'::jsonb),
    (lesson_uuid, 'important', 90, '{"title":"Что здесь значит качество","text":"Качество показывает, насколько продукт соответствует ожиданиям и подходит для своей задачи. Банковское приложение должно не только открываться, но и правильно переводить деньги, понятно сообщать результат и не создавать опасных ситуаций.","required":false}'::jsonb),
    (lesson_uuid, 'guide', 105, '{"variant":"question","title":"Проверь себя","text":"Выбери ответ после объяснения. Ошибка не блокирует обучение, а помогает понять, какую мысль стоит повторить.","visible":true,"required":false,"blocksNext":false}'::jsonb),
    (lesson_uuid, 'guide', 145, '{"variant":"explain","title":"Сначала разберись с ожиданием","text":"Прежде чем искать проблему, убедись, что понимаешь, как система должна работать. Если правило неясно, сначала уточни его.","visible":true,"required":false,"blocksNext":false}'::jsonb),
    (lesson_uuid, 'guide', 175, '{"variant":"question","title":"Проверь себя","text":"QA-инженер помогает команде не только искать ошибки, но и предупреждать их ещё до выпуска функции.","visible":true,"required":false,"blocksNext":false}'::jsonb),
    (lesson_uuid, 'important', 245, '{"title":"Дефект может быть не только в коде","text":"Причина проблемы может находиться в требовании, данных, настройке или коде. Сначала фиксируем наблюдаемое поведение, а затем команда ищет источник.","required":false}'::jsonb),
    (lesson_uuid, 'image', 265, '{"src":"/assets/lesson-guide-sheet-Ch5HD7kA.jpg","alt":"Форма входа для визуальной проверки","caption":"Посмотри на форму глазами пользователя и найди ситуации для проверки.","required":false}'::jsonb),
    (lesson_uuid, 'guide', 275, '{"variant":"question","title":"Вопрос, который помогает искать риски","text":"Посмотри на форму глазами пользователя и спроси себя, что изменится при других условиях.","visible":true,"required":false,"blocksNext":false}'::jsonb),
    (lesson_uuid, 'guide', 285, '{"variant":"question","title":"Проверь себя","text":"Выбери правильные утверждения по материалу первого дня.","visible":true,"required":false,"blocksNext":false}'::jsonb);
end;
$$;
