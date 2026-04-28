
-- helper: updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- LESSONS table
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  day_number int not null unique check (day_number between 1 and 30),
  title text not null,
  description text not null default '',
  video_url text,
  content_md text not null default '',
  homework_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

create policy "Anyone authenticated can view lessons"
  on public.lessons for select to authenticated using (true);
create policy "Admins can insert lessons"
  on public.lessons for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update lessons"
  on public.lessons for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete lessons"
  on public.lessons for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- LESSON PROGRESS
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "Users view own progress or admin"
  on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users insert own progress"
  on public.lesson_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own progress"
  on public.lesson_progress for update to authenticated using (auth.uid() = user_id);

-- HOMEWORK SUBMISSIONS
create type public.homework_status as enum ('pending', 'approved', 'rejected');

create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  content text not null default '',
  status public.homework_status not null default 'pending',
  feedback text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.homework_submissions enable row level security;

create policy "Users view own homework or admin"
  on public.homework_submissions for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users submit own homework"
  on public.homework_submissions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own homework"
  on public.homework_submissions for update to authenticated using (auth.uid() = user_id);
create policy "Admins review homework"
  on public.homework_submissions for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
create trigger lessons_set_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();
create trigger lesson_progress_set_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();
create trigger homework_set_updated_at before update on public.homework_submissions
  for each row execute function public.set_updated_at();

-- SEED 14 lessons
insert into public.lessons (day_number, title, description, content_md, homework_md) values
(1, 'Что такое тестирование', 'Знакомство с профессией QA, базовые понятия и роль тестировщика в продукте.',
'## Введение в QA

Тестирование — это проверка соответствия продукта ожиданиям. В этом уроке разберём:

- Кто такой QA Engineer
- Зачем нужно тестирование
- Чем отличается QA, QC и Tester',
'Опиши своими словами: зачем компании нанимают тестировщиков? Приведи 2 примера из жизни, где не хватило тестирования.'),
(2, 'Как работает IT-команда', 'Роли в команде разработки и место QA в процессах.',
'## Состав команды

- Product Manager
- Designer
- Frontend / Backend Developer
- QA Engineer
- DevOps',
'Нарисуй схему взаимодействия ролей в команде. Где в процессе подключается QA?'),
(3, 'Тест-кейсы и чек-листы', 'Учимся описывать проверки понятно и структурно.',
'## Структура тест-кейса

1. Заголовок
2. Предусловия
3. Шаги
4. Ожидаемый результат',
'Напиши 5 тест-кейсов для формы логина (email + пароль).'),
(4, 'Баг-репорты', 'Как правильно оформить найденную ошибку.',
'## Хороший баг-репорт

- Заголовок
- Шаги воспроизведения
- Фактический результат
- Ожидаемый результат
- Окружение, скриншоты',
'Найди баг на любом сайте и оформи полноценный баг-репорт.'),
(5, 'Виды тестирования', 'Функциональное, регрессионное, smoke и другие.',
'## Виды

- Функциональное
- Регрессионное
- Smoke / Sanity
- UI / Usability
- Performance',
'Подбери для каждого вида по 1 примеру задачи из реального продукта.'),
(6, 'Тест-дизайн и техники', 'Классы эквивалентности и граничные значения.',
'## Техники

- Классы эквивалентности
- Граничные значения
- Pairwise',
'Примени технику граничных значений к полю «Возраст» (от 18 до 99).'),
(7, 'Клиент-серверная архитектура', 'Как устроены приложения изнутри.',
'## Архитектура

- Клиент (браузер / приложение)
- Сервер (API)
- База данных
- HTTP запросы и ответы',
'Опиши, что происходит, когда ты нажимаешь «Войти» на сайте — от клика до ответа сервера.'),
(8, 'Основы API тестирования', 'REST, методы, статусы ответов.',
'## REST API

- GET, POST, PUT, DELETE
- Статус-коды: 200, 201, 400, 401, 404, 500
- JSON формат',
'Какие статус-коды и методы используются для: создания пользователя, получения списка, удаления?'),
(9, 'Postman для новичков', 'Первые запросы и коллекции.',
'## Postman

Устанавливаем, делаем первый GET-запрос к публичному API.',
'Сделай GET-запрос к https://jsonplaceholder.typicode.com/users и сохрани коллекцию.'),
(10, 'SQL для тестировщика', 'SELECT, JOIN, проверка данных в БД.',
'## SQL базово

- SELECT, WHERE
- JOIN (INNER, LEFT)
- GROUP BY',
'Напиши SQL-запрос: получить всех пользователей, у которых есть хотя бы один заказ.'),
(11, 'Работа с DevTools', 'Network, Console, проверка фронтенда.',
'## DevTools

- Network — смотрим запросы
- Console — ошибки JS
- Elements — HTML/CSS',
'Открой любой сайт, найди в Network 1 запрос и опиши его метод, статус и тело ответа.'),
(12, 'Agile / Scrum / Jira', 'Командные процессы и трекеры задач.',
'## Agile

- Спринты
- Стендапы
- Backlog, Sprint, Done
- Jira',
'Опиши своими словами, что такое спринт и для чего нужен ежедневный стендап.'),
(13, 'Повторение и разбор ошибок', 'Закрепляем сложные темы на примерах.',
'## Повторение

Возвращаемся к самым сложным темам: API, SQL, тест-дизайн.',
'Выбери 1 тему, которая даётся сложнее всего, и напиши краткий конспект.'),
(14, 'Итоговая практика', 'Собираем всё вместе на мини-проекте.',
'## Финал

Тебе даётся реальное приложение. Нужно:

1. Составить чек-лист
2. Найти 3 бага
3. Оформить баг-репорты
4. Проверить 1 API-метод в Postman',
'Выполни итоговый проект и прикрепи ссылку на свой документ с результатами.');
