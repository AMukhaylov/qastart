-- Expand days 2 and 3 with more guided explanations and in-lesson interactions.

do $$
declare
  day_two_id uuid;
  day_three_id uuid;
begin
  select id into day_two_id from public.lessons where day_number = 2;
  select id into day_three_id from public.lessons where day_number = 3;

  -- Day 2: insert eight learning blocks before the existing summary and test.
  if not exists (
    select 1 from public.lesson_blocks
    where lesson_id = day_two_id
      and block_type = 'heading'
      and content->>'title' = 'Кто за что отвечает'
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_two_id and position >= 7;

    insert into public.lesson_blocks (lesson_id, block_type, position, content) values
      (day_two_id, 'heading', 7, '{"title":"Кто за что отвечает"}'::jsonb),
      (day_two_id, 'definition', 8, '{"term":"Product Manager / Product Owner","text":"Отвечает за ценность продукта: какую проблему решаем, для кого и что важнее сделать первым."}'::jsonb),
      (day_two_id, 'definition', 9, '{"term":"Аналитик","text":"Превращает идею в понятные правила: сценарии, ограничения, данные и критерии готовности."}'::jsonb),
      (day_two_id, 'definition', 10, '{"term":"Дизайнер","text":"Продумывает, как пользователь будет проходить сценарий и как интерфейс объяснит ему происходящее."}'::jsonb),
      (day_two_id, 'definition', 11, '{"term":"Разработчик","text":"Реализует согласованное решение в коде, обсуждает технические ограничения и исправляет дефекты."}'::jsonb),
      (day_two_id, 'definition', 12, '{"term":"QA Engineer","text":"Помогает сделать требования проверяемыми, выбирает проверки, исследует риски и сообщает команде о результате."}'::jsonb),
      (day_two_id, 'question', 13, '{"question":"К кому QA обратится, если непонятно, должен ли пользователь получать письмо после регистрации?","options":["К аналитику или Product Manager","Только к дизайнеру","Только к DevOps","Ни к кому — это не важно"],"correctIndex":0,"explanation":"Правило поведения продукта нужно уточнить у тех, кто отвечает за требования и бизнес-логику."}'::jsonb),
      (day_two_id, 'diagram', 14, '{"title":"Команда вокруг задачи","steps":["PM формулирует цель","Аналитик уточняет правила","Дизайнер проектирует путь","Разработчик реализует","QA проверяет и сообщает о рисках","Команда выпускает и собирает обратную связь"]}'::jsonb);

    update public.lesson_blocks
    set position = position - 92
    where lesson_id = day_two_id and position >= 107;
  end if;

  -- Day 3: add the anatomy of a test case and a tool-selection exercise.
  if not exists (
    select 1 from public.lesson_blocks
    where lesson_id = day_three_id
      and block_type = 'heading'
      and content->>'title' = 'Структура тест-кейса'
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_three_id and position >= 6;

    insert into public.lesson_blocks (lesson_id, block_type, position, content) values
      (day_three_id, 'heading', 6, '{"title":"Структура тест-кейса"}'::jsonb),
      (day_three_id, 'diagram', 7, '{"title":"Из чего состоит тест-кейс","steps":["Название","Предусловия","Тестовые данные","Шаги","Ожидаемый результат","Фактический результат и статус"]}'::jsonb),
      (day_three_id, 'text', 8, '{"markdown":"Название отвечает на вопрос, что именно мы проверяем. Предусловия описывают состояние до начала проверки. Шаги должны быть достаточно точными, чтобы другой человек мог повторить сценарий без догадок."}'::jsonb),
      (day_three_id, 'important', 9, '{"title":"Проверяемый ожидаемый результат","text":"Фраза «всё работает правильно» ничего не объясняет. Лучше: «пользователь видит личный кабинет и имя в шапке страницы»."}'::jsonb),
      (day_three_id, 'question', 10, '{"question":"Что лучше написать в ожидаемом результате тест-кейса?","options":["Система работает корректно","Пользователь видит сообщение «Пароль изменён» и может войти с новым паролем","Проверить пароль","Разработчик должен исправить ошибку"],"correctIndex":1,"explanation":"Хороший ожидаемый результат описывает наблюдаемое поведение продукта."}'::jsonb),
      (day_three_id, 'heading', 11, '{"title":"Когда выбрать чек-лист, а когда тест-кейс"}'::jsonb),
      (day_three_id, 'example', 12, '{"title":"Два формата одной проверки","expected":"Для быстрого smoke-прогона нужен список ключевых сценариев. Для сложной оплаты важны точные шаги и данные.","actual":"Чек-лист: «Оплата картой проходит». Тест-кейс: предусловия, номер заказа, шаги оплаты, ожидаемый статус и данные в чеке.","conclusion":"Чек-лист экономит время, тест-кейс снижает неоднозначность в сложных и повторяемых сценариях."}'::jsonb),
      (day_three_id, 'question', 13, '{"question":"В какой ситуации подробный тест-кейс особенно полезен?","options":["Когда сценарий сложный и его должен повторять другой человек","Когда нужно записать только одну идею","Когда нет требований","Только для поиска багов в браузере"],"correctIndex":0,"explanation":"Детализация особенно важна для сложных, рискованных и часто повторяемых проверок."}'::jsonb);

    update public.lesson_blocks
    set position = position - 92
    where lesson_id = day_three_id and position >= 106;
  end if;
end;
$$;
