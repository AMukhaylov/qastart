-- Add the course introduction and restore the mentor block in Day 1.
do $$
declare lesson_uuid uuid;
begin
  select id into lesson_uuid from public.lessons where day_number = 1;
  if lesson_uuid is null then raise exception 'Day 1 is missing'; end if;

  -- Make room after the optional greeting video for the mentor introduction.
  -- Use a temporary range so the unique (lesson_id, position) constraint is
  -- never violated while the existing blocks move down.
  update public.lesson_blocks set position = position + 100
  where lesson_id = lesson_uuid and position >= 3;
  update public.lesson_blocks set position = position - 98
  where lesson_id = lesson_uuid and position >= 103;

  insert into public.lesson_blocks (lesson_id, block_type, position, content)
  values
    (lesson_uuid, 'heading', 3, '{"title":"Давайте познакомимся"}'::jsonb),
    (lesson_uuid, 'text', 4, '{"markdown":"Меня зовут **Артур Мухайлов**. Я ведущий QA-инженер, преподаватель и наставник. В тестировании я с 2018 года, а в QA Start собрал практический маршрут для тех, кто только знакомится с профессией. На курсе я буду объяснять не только термины, но и то, как тестировщик думает и работает в команде."}'::jsonb);

  update public.lesson_blocks
  set content = '{"markdown":"Впереди 14 дней: от самых первых понятий до работы с тест-кейсами, баг-репортами, DevTools, API, SQL и реальной учебной задачей. Не нужно заранее знать IT или уметь программировать. На каждом шаге сначала будет объяснение, затем пример и короткая проверка понимания."}'::jsonb
  where lesson_id = lesson_uuid and block_type = 'text' and position = 1;

  update public.lesson_blocks
  set content = '{"term":"Тестирование ПО","text":"Тестирование ПО — это проверка соответствия между реальным поведением программы и её ожидаемым поведением на конечном наборе тестов."}'::jsonb
  where lesson_id = lesson_uuid and block_type = 'definition' and content->>'term' = 'Тестирование ПО';

  update public.lesson_blocks
  set block_type = 'definition', content = '{"term":"QA (обеспечение качества)","text":"QA — это работа, которая помогает команде предупреждать проблемы и выпускать более надёжный продукт."}'::jsonb
  where lesson_id = lesson_uuid and block_type = 'text' and position = 15;

  update public.lesson_blocks
  set block_type = 'definition', content = '{"term":"Ожидаемый и фактический результат","text":"Ожидаемый результат — то, что должно произойти по требованию или согласованному правилу. Фактический результат — то, что произошло во время проверки."}'::jsonb
  where lesson_id = lesson_uuid and block_type = 'important' and position = 12;

  update public.lesson_blocks
  set content = '{"term":"Дефект","text":"Дефект — это проблема в требовании, коде, данных или настройке, из-за которой продукт может работать неправильно."}'::jsonb
  where lesson_id = lesson_uuid and block_type = 'definition' and content->>'term' = 'Ошибка, дефект и отказ';
end $$;
