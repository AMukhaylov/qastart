-- Interactive lesson format. Legacy lessons.content_md, video_url and homework_md remain intact.

create table if not exists public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_type text not null check (block_type in (
    'heading', 'text', 'definition', 'important', 'example', 'diagram', 'image',
    'video', 'question', 'code', 'summary', 'homework'
  )),
  position integer not null check (position >= 0),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position)
);

create index if not exists lesson_blocks_lesson_position_idx
  on public.lesson_blocks (lesson_id, position);

alter table public.lesson_blocks enable row level security;
revoke all on public.lesson_blocks from anon;
grant select, insert, update, delete on public.lesson_blocks to authenticated;
grant select, insert, update, delete on public.lesson_blocks to service_role;

create policy "Authenticated users read lesson blocks"
  on public.lesson_blocks for select to authenticated using (true);
create policy "Admins manage lesson blocks"
  on public.lesson_blocks for all to authenticated
  using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create table if not exists public.lesson_block_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null references public.lesson_blocks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, block_id)
);

create index if not exists lesson_block_progress_user_lesson_idx
  on public.lesson_block_progress (user_id, lesson_id);

alter table public.lesson_block_progress enable row level security;
revoke all on public.lesson_block_progress from anon;
grant select, insert, update on public.lesson_block_progress to authenticated;
grant select, insert, update, delete on public.lesson_block_progress to service_role;

create policy "Users read own block progress or admins read all"
  on public.lesson_block_progress for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );
create policy "Users create own block progress"
  on public.lesson_block_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own block progress"
  on public.lesson_block_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger lesson_blocks_set_updated_at before update on public.lesson_blocks
  for each row execute function public.set_updated_at();
create trigger lesson_block_progress_set_updated_at before update on public.lesson_block_progress
  for each row execute function public.set_updated_at();

-- Day 1 is the reference interactive lesson. Insert only when the day has not already been migrated.
insert into public.lesson_blocks (lesson_id, block_type, position, content)
select lesson.id, seed.block_type, seed.position, seed.content
from public.lessons lesson
cross join (
  values
    ('heading', 0, '{"title":"Добро пожаловать в QA Start","eyebrow":"День 1 из 14"}'::jsonb),
    ('text', 1, '{"markdown":"QA Start — это 14-дневный интенсив для знакомства с профессией QA. Здесь вы разберёте основные направления работы тестировщика, увидите инструменты и попробуете типичные задачи. Цель курса — помочь понять, хотите ли вы развиваться в тестировании дальше."}'::jsonb),
    ('important', 2, '{"title":"Как проходить урок","text":"Видео — дополнительный формат. Основной материал, примеры и задания доступны прямо на этой странице."}'::jsonb),
    ('heading', 3, '{"title":"Давайте познакомимся"}'::jsonb),
    ('text', 4, '{"markdown":"Меня зовут **Артур Мухайлов**. Я ведущий QA-инженер, работаю в тестировании с 2018 года и более шести лет занимаюсь преподаванием и наставничеством. За это время я работал в Яндексе, РТ МИС, ЭР-Телекоме, Ак Барс Диджитал и Банке 131, а также помог почти 2 000 студентам сделать первые шаги в QA."}'::jsonb),
    ('heading', 5, '{"title":"Что такое тестирование"}'::jsonb),
    ('text', 6, '{"markdown":"Тестирование помогает команде понять, как ведёт себя продукт в разных ситуациях и соответствует ли это ожиданиям пользователя и требованиям."}'::jsonb),
    ('definition', 7, '{"term":"Тестирование ПО","text":"Процесс исследования продукта, который помогает получить информацию о его качестве и выявить несоответствия между ожидаемым и фактическим поведением."}'::jsonb),
    ('example', 8, '{"title":"Пример: вход в систему","expected":"Пользователь вводит правильный логин и пароль и открывает личный кабинет.","actual":"После нажатия «Войти» система возвращает ошибку 500.","conclusion":"Ожидаемый и фактический результат расходятся. Команде нужно разобраться в причине."}'::jsonb),
    ('diagram', 9, '{"title":"Как рождается вывод","steps":["Ожидание","Действие","Фактический результат","Сравнение","Вывод"]}'::jsonb),
    ('question', 10, '{"question":"Какое поведение можно считать проблемой?","options":["Кнопка стала синей вместо фиолетовой без согласованного требования","Пользователь ввёл верные данные, но не смог войти в личный кабинет","Форма показывает подсказку, если обязательное поле пустое","Приложение успешно сохраняет корректно заполненную форму"],"correctIndex":1,"explanation":"Пользователь выполнил условия для входа, но не получил ожидаемый результат. Это повод исследовать дефект."}'::jsonb),
    ('heading', 11, '{"title":"Зачем нужен QA"}'::jsonb),
    ('text', 12, '{"markdown":"Разработчики тоже проверяют свой код. QA смотрит на продукт с другой точки зрения: изучает путь пользователя, задаёт вопросы к требованиям, выбирает важные проверки и помогает команде раньше увидеть риски."}'::jsonb),
    ('important', 13, '{"title":"QA не только ищет баги","text":"QA помогает команде понимать состояние качества продукта и предупреждать проблемы до того, как они попадут к пользователям."}'::jsonb),
    ('heading', 14, '{"title":"Кто такой QA-инженер"}'::jsonb),
    ('diagram', 15, '{"title":"Типичный путь работы","steps":["Требования","Анализ","Проверки","Тестирование","Дефекты","Повторная проверка","Результат"]}'::jsonb),
    ('text', 16, '{"markdown":"В реальной работе QA-инженер анализирует требования, проектирует проверки, тестирует продукт, описывает дефекты и повторно проверяет исправления. Он участвует в обеспечении качества вместе со всей командой."}'::jsonb),
    ('heading', 17, '{"title":"QA задаёт вопросы ещё до кода"}'::jsonb),
    ('example', 18, '{"title":"Неполное требование","expected":"Пароль должен быть достаточно сложным.","actual":"Неясно, какая длина нужна, обязательны ли цифры и заглавные буквы, допустимы ли пробелы.","conclusion":"QA уточнит правила до разработки. Так проблему можно предотвратить раньше."}'::jsonb),
    ('question', 19, '{"question":"Какой вопрос QA задаст к правилу «пароль должен быть достаточно сложным»?","options":["Какого цвета должна быть кнопка?","Какая минимальная длина пароля?","Кто написал требование?","Когда выйдет новая версия браузера?"],"correctIndex":1,"explanation":"Минимальная длина делает требование проверяемым и понятным для команды."}'::jsonb),
    ('definition', 20, '{"term":"Баг, или дефект","text":"Недостаток продукта, из-за которого он не соответствует требованию или важной потребности пользователя."}'::jsonb),
    ('text', 21, '{"markdown":"Качество ПО — это не академическая формула. Для пользователя это возможность решить свою задачу: войти в систему, оформить заказ, увидеть понятную ошибку и не потерять данные. Разные дефекты влияют на качество по-разному."}'::jsonb),
    ('important', 22, '{"title":"Как мыслит тестировщик","text":"«А что будет, если…?» Оставить поле пустым, ввести длинное значение, нажать кнопку дважды, обновить страницу, потерять интернет или использовать необычные символы."}'::jsonb),
    ('question', 23, '{"question":"Что сравнивает тестировщик во время проверки?","options":["Ожидаемый и фактический результат","Стоимость разных смартфонов","Только имена разработчиков","Количество пользователей в интернете"],"correctIndex":0,"explanation":"Основа проверки — понять, совпадает ли то, что произошло, с тем, что должно было произойти."}'::jsonb),
    ('question', 24, '{"question":"Когда QA может помочь найти проблему?","options":["Только после релиза","Только когда найден баг","Ещё при обсуждении требований","Только после написания автотестов"],"correctIndex":2,"explanation":"Неясность в требованиях можно заметить и уточнить до разработки."}'::jsonb),
    ('question', 25, '{"question":"Какой вопрос отражает тестировочное мышление?","options":["Кто написал код?","А что будет, если оставить поле пустым?","Сколько стоит ноутбук?","Когда закончится встреча?"],"correctIndex":1,"explanation":"Тестировщик рассматривает разные условия и последствия действий пользователя."}'::jsonb),
    ('summary', 26, '{"title":"Главное из урока","items":[["Тестирование","Исследование продукта для оценки качества и поиска несоответствий."],["QA","Работа по обеспечению качества и предупреждению проблем в команде."],["QA-инженер","Специалист, который анализирует требования, проверяет продукт и сообщает о рисках."],["Качество ПО","Способность продукта соответствовать требованиям и помогать пользователю решать задачу."],["Баг / дефект","Подтверждённое несоответствие важному ожиданию."],["Ожидаемый результат","То, что должно произойти по правилу."],["Фактический результат","То, что произошло в конкретной проверке."]],"points":["QA работает не только с готовым продуктом.","Чем раньше найдена проблема, тем проще её исправить.","Тестировщик сравнивает ожидаемое и фактическое поведение.","Один из главных навыков QA — вопрос «А что будет, если?»."]}'::jsonb),
    ('homework', 27, '{"title":"Домашнее задание","instruction":"Выберите знакомое приложение или сайт и одну функцию. Опишите, что должен сделать пользователь, какой результат он ожидает и пять разных ситуаций, которые вы бы попробовали проверить.","submitHint":"Отправьте ответ текстом. При желании приложите файл или ссылку."}'::jsonb)
) as seed(block_type, position, content)
where lesson.day_number = 1
  and not exists (select 1 from public.lesson_blocks existing where existing.lesson_id = lesson.id);
