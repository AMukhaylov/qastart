-- Close the remaining Day 1 transitions after the practice questions.
do $$
declare
  lesson_uuid uuid;
begin
  select id into lesson_uuid from public.lessons where day_number = 1;
  if lesson_uuid is null then
    raise exception 'Day 1 is missing';
  end if;

  update public.lesson_blocks
  set content = jsonb_build_object('title', 'Как тестирование даёт команде информацию')
  where lesson_id = lesson_uuid and position = 11;

  update public.lesson_blocks
  set content = jsonb_build_object(
    'questionType', 'multiple_choice',
    'question', 'Для чего команда может проводить тестирование?',
    'options', jsonb_build_array('Узнать о качестве продукта и рисках', 'Найти дефекты', 'Доказать, что ошибок в продукте совсем нет', 'Проверить, выполняются ли важные ожидания'),
    'correctAnswers', jsonb_build_array(0, 1, 3),
    'explanation', 'Тестирование помогает узнать о качестве и рисках, найти дефекты и проверить важное поведение. Ограниченное число проверок не доказывает полного отсутствия ошибок.'
  )
  where lesson_id = lesson_uuid and position = 10;

  update public.lesson_blocks
  set content = jsonb_build_object('title', 'Не все проблемы удаётся предупредить')
  where lesson_id = lesson_uuid and position = 20;

  update public.lesson_blocks
  set content = jsonb_build_object('markdown', $defect$
Даже понятные требования и хорошие проверки не могут предупредить все проблемы. Когда результат не совпадает с ожиданием, одна из возможных причин — дефект. Он может находиться в расчёте, настройке акции, коде или самом требовании.

Представь магазин, где для заказа обещана скидка 10%, а на экране показана полная цена. Мы видим неправильное поведение, но пока не знаем его причину.

Полезно различать ошибку человека, дефект и его проявление. Ошибочное решение или строка кода может привести к дефекту. Неправильная сумма, которую видит пользователь, становится его проявлением. Задача тестировщика состоит в том, чтобы точно зафиксировать наблюдение, а команда затем ищет причину.
$defect$)
  where lesson_id = lesson_uuid and position = 22;

  update public.lesson_blocks
  set content = jsonb_build_object(
    'term', 'QA (обеспечение качества)',
    'text', 'QA — работа по предупреждению проблем с качеством. Она включает ясные требования, полезные проверки, обратную связь и совместную работу команды.'
  )
  where lesson_id = lesson_uuid and position = 16;

  update public.lesson_blocks
  set content = jsonb_build_object(
    'title', 'Скидка и неизвестная причина',
    'expected', 'Скидка 10% применяется к подходящему заказу.',
    'actual', 'Для такого заказа на экране показана скидка 0%.',
    'conclusion', 'Наблюдаем неправильное поведение. Причину ищем отдельно. Она может быть в расчёте, данных или условиях акции.'
  )
  where lesson_id = lesson_uuid and position = 23;
end $$;
