-- Small, focused refinements to the approved Day 1 lesson.

alter table public.lesson_blocks drop constraint if exists lesson_blocks_block_type_check;
alter table public.lesson_blocks add constraint lesson_blocks_block_type_check check (block_type in (
  'heading', 'text', 'definition', 'important', 'example', 'diagram', 'image',
  'video', 'question', 'reflection', 'visual_choice', 'code', 'summary', 'homework'
));

do $$
declare day_one_id uuid;
begin
  select id into day_one_id from public.lessons where day_number = 1;
  if day_one_id is null then raise exception 'Day 1 not found'; end if;

  update public.lesson_blocks set content = jsonb_set(content, '{markdown}', to_jsonb($text$
Меня зовут **Артур Мухайлов**. Я ведущий QA-инженер, преподаватель и наставник. В тестировании работаю с 2018 года и люблю объяснять профессию через понятные жизненные ситуации.

В QA важно не только нажать кнопку. Нужно понять, для кого сделана функция, что от неё ждут и что может пойти не так. Этому способу думать мы будем учиться в QA Start.

Курс состоит из **14 интерактивных дней**. Будут теория, примеры, вопросы и практика. Ты познакомишься с тест-кейсами, баг-репортами, DevTools, API, Postman и SQL.
$text$)) where lesson_id = day_one_id and position = 4;

  update public.lesson_blocks set position = position + 100 where lesson_id = day_one_id and position >= 5;
  update public.lesson_blocks set position = position - 99 where lesson_id = day_one_id and position >= 105;
  insert into public.lesson_blocks (lesson_id, block_type, position, content) values
    (day_one_id, 'important', 5, '{"title":"Спокойно пробуй и ошибайся","text":"Ошибки в вопросах не оценивают твои способности. Они помогают разобраться в теме и двигаться дальше.","required":false}'::jsonb);

  update public.lesson_blocks set content = '{"term":"Тестирование ПО","text":"Исследование продукта, которое помогает узнать о его качестве и заметить несоответствия между ожидаемым и фактическим поведением."}'::jsonb where lesson_id = day_one_id and position = 8;
  update public.lesson_blocks set position = position + 100 where lesson_id = day_one_id and position >= 9;
  update public.lesson_blocks set position = position - 99 where lesson_id = day_one_id and position >= 109;
  insert into public.lesson_blocks (lesson_id, block_type, position, content) values
    (day_one_id, 'important', 9, '{"title":"Что здесь значит качество","text":"Качество показывает, насколько продукт соответствует ожиданиям и подходит для своей задачи. Банковское приложение должно не только открываться, но и правильно переводить деньги, понятно сообщать результат и не создавать опасных ситуаций."}'::jsonb);

  update public.lesson_blocks set content = jsonb_set(content, '{markdown}', to_jsonb($text$
В примере со входом мы ожидали личный кабинет, а увидели сообщение об ошибке. Так тестировщик сравнивает ожидаемый и фактический результат.

**Ожидаемый результат** показывает, что должно произойти по правилу или требованию. **Фактический результат** показывает, что произошло после конкретных действий. Если правило неясно, сначала уточни его у команды.
$text$)) where lesson_id = day_one_id and position = 14;

  update public.lesson_blocks set content = '{"term":"QA и QA-инженер","text":"QA (Quality Assurance) — подход к обеспечению качества продукта в течение разработки. QA-инженер помогает команде раньше замечать риски, уточнять требования, проверять продукт и давать обратную связь."}'::jsonb where lesson_id = day_one_id and position = 18;

  update public.lesson_blocks set content = jsonb_set(content, '{markdown}', to_jsonb($text$
Даже понятные требования и хорошие проверки не исключают все проблемы. Например, магазин обещает скидку 10%, а пользователь видит 0%. Мы точно видим, что результат отличается от ожидаемого, но техническую причину пока не знаем.

Причина может быть в коде, данных, настройке, требовании или условиях акции. Сначала тестировщик точно описывает наблюдаемое поведение и условия, при которых оно произошло. Причину команда исследует отдельно.
$text$)) where lesson_id = day_one_id and position = 24;

  update public.lesson_blocks set position = position + 100 where lesson_id = day_one_id and position >= 27;
  update public.lesson_blocks set position = position - 98 where lesson_id = day_one_id and position >= 127;
  insert into public.lesson_blocks (lesson_id, block_type, position, content) values
    (day_one_id, 'reflection', 27, '{"prompt":"Представь форму входа. Что бы ты попробовал проверить кроме правильного логина и пароля?","hint":"Напиши 1–3 идеи. Ответ не оценивается и не влияет на прогресс.","feedback":"Здесь нет единственного правильного списка. Можно проверить пустые поля, неверный пароль, длинный ввод, двойное нажатие, потерю сети и другие ситуации.","required":false}'::jsonb),
    (day_one_id, 'visual_choice', 28, '{"title":"Посмотри на форму входа","prompt":"Куда бы ты посмотрел в первую очередь или что попробовал изменить, чтобы найти проблему? Выбери несколько идей.","options":["Оставить одно из полей пустым","Ввести неверный пароль","Вставить очень длинное значение","Нажать «Войти» два раза","Проверить ссылку «Забыли пароль?»"],"correctAnswers":[0,1,2,3,4],"explanation":"Тестировщик проверяет не только кнопку. Он меняет данные и условия: оставляет поле пустым, вводит неверный пароль, пробует длинный ввод, повторное нажатие, потерю сети и необычные символы.","required":false}'::jsonb);

  update public.lesson_blocks set content = jsonb_set(content, '{text}', to_jsonb('«А что будет, если…?» Оставить поле пустым, ввести неверный пароль, вставить очень длинное значение, нажать кнопку два раза или потерять соединение.')) where lesson_id = day_one_id and position = 28;
end;
$$;
