export type FinalQuizQuestion = {
  id: string;
  topic: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
};

export const FINAL_QUIZ_QUESTIONS: FinalQuizQuestion[] = [
  {
    id: "qa-purpose",
    topic: "Основы QA",
    text: "Какая главная цель тестирования?",
    options: [
      { id: "a", text: "Доказать полное отсутствие ошибок" },
      { id: "b", text: "Снизить риски и дать информацию о качестве продукта" },
      { id: "c", text: "Заменить работу разработчика" },
      { id: "d", text: "Сделать приложение красивее" },
    ],
    correctOptionId: "b",
    explanation:
      "Тестирование помогает находить риски и давать команде информацию о качестве; полностью доказать отсутствие дефектов нельзя.",
  },
  {
    id: "qa-responsibility",
    topic: "Основы QA",
    text: "Что из этого обычно входит в задачи QA Engineer?",
    options: [
      { id: "a", text: "Проверять требования и поведение продукта" },
      { id: "b", text: "Утверждать бюджет компании" },
      { id: "c", text: "Писать дизайн-макеты вместо дизайнера" },
      { id: "d", text: "Единолично выпускать релиз" },
    ],
    correctOptionId: "a",
    explanation:
      "QA участвует в проверке требований, подготовке проверок, тестировании и коммуникации о рисках.",
  },
  {
    id: "team-role",
    topic: "Команда",
    text: "Кто обычно формулирует бизнес-потребность и приоритет задачи?",
    options: [
      { id: "a", text: "QA Engineer" },
      { id: "b", text: "Product Owner" },
      { id: "c", text: "Системный администратор" },
      { id: "d", text: "Пользователь DevTools" },
    ],
    correctOptionId: "b",
    explanation: "Product Owner отвечает за ценность продукта и приоритизацию задач для команды.",
  },
  {
    id: "task-flow",
    topic: "Команда",
    text: "Какой порядок ближе всего к обычному пути задачи?",
    options: [
      { id: "a", text: "Релиз -> идея -> разработка -> проверка" },
      { id: "b", text: "Идея и требования -> разработка -> тестирование -> релиз" },
      { id: "c", text: "Тестирование -> идея -> релиз -> разработка" },
      { id: "d", text: "Разработка -> релиз -> требования -> тестирование" },
    ],
    correctOptionId: "b",
    explanation:
      "Требования направляют разработку, затем команда проверяет результат перед выпуском.",
  },
  {
    id: "checklist-purpose",
    topic: "Тестовая документация",
    text: "Когда особенно удобен чек-лист?",
    options: [
      { id: "a", text: "Когда нужен подробный сценарий с шагами и ожидаемым результатом" },
      { id: "b", text: "Когда нужна короткая карта областей для проверки" },
      { id: "c", text: "Когда надо хранить пароль" },
      { id: "d", text: "Когда нужно написать SQL-миграцию" },
    ],
    correctOptionId: "b",
    explanation: "Чек-лист кратко перечисляет, что проверить; он легче и быстрее тест-кейса.",
  },
  {
    id: "test-case-structure",
    topic: "Тестовая документация",
    text: "Какой элемент обязателен для хорошего тест-кейса?",
    options: [
      { id: "a", text: "Ожидаемый результат" },
      { id: "b", text: "Фото автора" },
      { id: "c", text: "Название компании" },
      { id: "d", text: "Ссылка на личный чат" },
    ],
    correctOptionId: "a",
    explanation: "Без ожидаемого результата нельзя однозначно понять, пройдена проверка или нет.",
  },
  {
    id: "bug-definition",
    topic: "Баги",
    text: "Что точнее всего описывает баг?",
    options: [
      { id: "a", text: "Любое изменение в задаче" },
      { id: "b", text: "Несоответствие фактического результата ожидаемому" },
      { id: "c", text: "Любой вопрос к аналитику" },
      { id: "d", text: "Запись в консоли браузера" },
    ],
    correctOptionId: "b",
    explanation:
      "Дефект фиксируется, когда результат работы продукта не соответствует ожиданию или требованию.",
  },
  {
    id: "severity",
    topic: "Severity и Priority",
    text: "Что отражает Severity?",
    options: [
      { id: "a", text: "Срочность исправления для бизнеса" },
      { id: "b", text: "Степень влияния дефекта на работу продукта" },
      { id: "c", text: "Количество комментариев в задаче" },
      { id: "d", text: "Срок жизни бага" },
    ],
    correctOptionId: "b",
    explanation:
      "Severity показывает техническую тяжесть и влияние дефекта; Priority определяет срочность работы с ним.",
  },
  {
    id: "priority",
    topic: "Severity и Priority",
    text: "Какой дефект может иметь высокий Priority и низкий Severity?",
    options: [
      { id: "a", text: "Кнопка оплаты не работает" },
      { id: "b", text: "Неверный текст в рекламном баннере перед запуском кампании" },
      { id: "c", text: "Приложение не запускается" },
      { id: "d", text: "Потеря данных пользователей" },
    ],
    correctOptionId: "b",
    explanation:
      "Текстовая ошибка обычно мало влияет на систему, но может быть очень срочной для бизнеса.",
  },
  {
    id: "bug-report",
    topic: "Баги",
    text: "Что помогает разработчику воспроизвести дефект?",
    options: [
      { id: "a", text: "Шаги, фактический и ожидаемый результат" },
      { id: "b", text: "Только заголовок бага" },
      { id: "c", text: "Только Severity" },
      { id: "d", text: "Только имя тестировщика" },
    ],
    correctOptionId: "a",
    explanation:
      "Воспроизводимые шаги и ясное сравнение expected/actual делают баг-репорт полезным.",
  },
  {
    id: "smoke",
    topic: "Виды тестирования",
    text: "Для чего проводят smoke-тестирование?",
    options: [
      { id: "a", text: "Проверить ключевые функции перед глубоким тестированием" },
      { id: "b", text: "Проверить только цвет кнопок" },
      { id: "c", text: "Проверить все возможные сценарии" },
      { id: "d", text: "Удалить старые баги" },
    ],
    correctOptionId: "a",
    explanation: "Smoke проверяет, что сборка в принципе пригодна для дальнейшего тестирования.",
  },
  {
    id: "regression",
    topic: "Виды тестирования",
    text: "Когда особенно нужен regression-тест?",
    options: [
      { id: "a", text: "После изменений, чтобы убедиться, что старое не сломалось" },
      { id: "b", text: "Только до написания требований" },
      { id: "c", text: "Только при создании дизайна" },
      { id: "d", text: "Только после удаления проекта" },
    ],
    correctOptionId: "a",
    explanation:
      "Регрессия нужна для поиска побочных эффектов изменений в уже работающем функционале.",
  },
  {
    id: "integration",
    topic: "Виды тестирования",
    text: "Что проверяет интеграционное тестирование?",
    options: [
      { id: "a", text: "Взаимодействие компонентов или сервисов" },
      { id: "b", text: "Только отдельную функцию без окружения" },
      { id: "c", text: "Только орфографию" },
      { id: "d", text: "Скорость печати тестировщика" },
    ],
    correctOptionId: "a",
    explanation:
      "Интеграционные проверки показывают, корректно ли обмениваются данными части системы.",
  },
  {
    id: "equivalence",
    topic: "Тест-дизайн",
    text: "Поле принимает возраст от 18 до 65. Какое значение относится к классу эквивалентности «валидный возраст»?",
    options: [
      { id: "a", text: "17" },
      { id: "b", text: "18" },
      { id: "c", text: "66" },
      { id: "d", text: "-1" },
    ],
    correctOptionId: "b",
    explanation: "Диапазон от 18 до 65 включительно является валидным классом эквивалентности.",
  },
  {
    id: "boundary",
    topic: "Тест-дизайн",
    text: "Для диапазона 18-65 какой набор лучше проверяет граничные значения?",
    options: [
      { id: "a", text: "20, 30, 40" },
      { id: "b", text: "17, 18, 65, 66" },
      { id: "c", text: "1, 100, 1000" },
      { id: "d", text: "Только 18" },
    ],
    correctOptionId: "b",
    explanation: "Пограничные значения и соседние с ними числа чаще всего выявляют ошибки условий.",
  },
  {
    id: "frontend",
    topic: "Клиент-сервер",
    text: "Что обычно относится к frontend?",
    options: [
      { id: "a", text: "Интерфейс, который видит пользователь" },
      { id: "b", text: "Таблицы базы данных" },
      { id: "c", text: "Серверная бизнес-логика" },
      { id: "d", text: "Резервные копии" },
    ],
    correctOptionId: "a",
    explanation:
      "Frontend работает в браузере и отвечает за отображение и пользовательское взаимодействие.",
  },
  {
    id: "http-request",
    topic: "Клиент-сервер",
    text: "Что происходит после нажатия кнопки «Сохранить» в веб-приложении?",
    options: [
      { id: "a", text: "Браузер обычно отправляет запрос на сервер" },
      { id: "b", text: "База данных сама открывает браузер" },
      { id: "c", text: "Сервер выключается" },
      { id: "d", text: "Всегда создаётся новый пользователь" },
    ],
    correctOptionId: "a",
    explanation: "Интерфейс формирует HTTP-запрос, сервер обрабатывает его и возвращает ответ.",
  },
  {
    id: "devtools-network",
    topic: "DevTools",
    text: "В какой вкладке DevTools удобнее всего смотреть HTTP-запросы и ответы?",
    options: [
      { id: "a", text: "Elements" },
      { id: "b", text: "Network" },
      { id: "c", text: "Sources" },
      { id: "d", text: "Application" },
    ],
    correctOptionId: "b",
    explanation: "Network показывает запросы, статусы, headers, payload и response.",
  },
  {
    id: "devtools-console",
    topic: "DevTools",
    text: "Где обычно видны JavaScript-ошибки страницы?",
    options: [
      { id: "a", text: "Console" },
      { id: "b", text: "Elements" },
      { id: "c", text: "Performance" },
      { id: "d", text: "Lighthouse" },
    ],
    correctOptionId: "a",
    explanation: "Console выводит сообщения приложения, предупреждения и ошибки JavaScript.",
  },
  {
    id: "http-get",
    topic: "HTTP и API",
    text: "Какой HTTP-метод обычно используют для получения данных?",
    options: [
      { id: "a", text: "GET" },
      { id: "b", text: "POST" },
      { id: "c", text: "DELETE" },
      { id: "d", text: "PATCH" },
    ],
    correctOptionId: "a",
    explanation: "GET запрашивает представление ресурса без изменения его состояния.",
  },
  {
    id: "http-status",
    topic: "HTTP и API",
    text: "Что означает HTTP-статус 404?",
    options: [
      { id: "a", text: "Успешный ответ" },
      { id: "b", text: "Нет доступа" },
      { id: "c", text: "Ресурс не найден" },
      { id: "d", text: "Ошибка сервера" },
    ],
    correctOptionId: "c",
    explanation: "404 Not Found означает, что сервер не нашёл запрошенный ресурс или маршрут.",
  },
  {
    id: "http-status-500",
    topic: "HTTP и API",
    text: "К какой группе относится статус 500?",
    options: [
      { id: "a", text: "Информационные ответы" },
      { id: "b", text: "Успешные ответы" },
      { id: "c", text: "Ошибки клиента" },
      { id: "d", text: "Ошибки сервера" },
    ],
    correctOptionId: "d",
    explanation: "Коды 5xx означают, что ошибка произошла на стороне сервера.",
  },
  {
    id: "json",
    topic: "HTTP и API",
    text: "Какой формат чаще всего используют для тела REST API-запроса?",
    options: [
      { id: "a", text: "JSON" },
      { id: "b", text: "PNG" },
      { id: "c", text: "MP3" },
      { id: "d", text: "EXE" },
    ],
    correctOptionId: "a",
    explanation:
      "JSON - распространённый текстовый формат обмена структурированными данными в API.",
  },
  {
    id: "postman-body",
    topic: "Postman",
    text: "Где в Postman обычно передают JSON для POST-запроса?",
    options: [
      { id: "a", text: "Во вкладке Body" },
      { id: "b", text: "Во вкладке Tests" },
      { id: "c", text: "В названии коллекции" },
      { id: "d", text: "В истории браузера" },
    ],
    correctOptionId: "a",
    explanation: "Тело запроса задаётся во вкладке Body, обычно в режиме raw JSON.",
  },
  {
    id: "postman-headers",
    topic: "Postman",
    text: "Для чего в Postman нужна вкладка Headers?",
    options: [
      { id: "a", text: "Передавать метаданные запроса, например Content-Type" },
      { id: "b", text: "Создавать таблицы в базе" },
      { id: "c", text: "Просматривать DOM страницы" },
      { id: "d", text: "Рисовать макеты" },
    ],
    correctOptionId: "a",
    explanation:
      "Headers передают служебные данные запроса: тип содержимого, авторизацию и другие параметры.",
  },
  {
    id: "sql-select",
    topic: "SQL",
    text: "Какой SQL-запрос выбирает все столбцы из таблицы users?",
    options: [
      { id: "a", text: "SELECT * FROM users;" },
      { id: "b", text: "GET users;" },
      { id: "c", text: "FIND users;" },
      { id: "d", text: "OPEN users;" },
    ],
    correctOptionId: "a",
    explanation: "SELECT читает данные, а * означает все столбцы таблицы.",
  },
  {
    id: "sql-where",
    topic: "SQL",
    text: "Как добавить условие к SQL-запросу?",
    options: [
      { id: "a", text: "Использовать WHERE" },
      { id: "b", text: "Использовать GROUP" },
      { id: "c", text: "Использовать FROM дважды" },
      { id: "d", text: "Использовать JSON" },
    ],
    correctOptionId: "a",
    explanation: "WHERE фильтрует строки по заданному условию.",
  },
  {
    id: "sql-join",
    topic: "SQL",
    text: "Для чего используют JOIN?",
    options: [
      { id: "a", text: "Соединить данные связанных таблиц" },
      { id: "b", text: "Удалить таблицу" },
      { id: "c", text: "Переименовать базу" },
      { id: "d", text: "Запустить браузер" },
    ],
    correctOptionId: "a",
    explanation: "JOIN позволяет получить данные из нескольких связанных таблиц в одном запросе.",
  },
  {
    id: "scrum-sprint",
    topic: "Agile и Scrum",
    text: "Что такое спринт в Scrum?",
    options: [
      { id: "a", text: "Короткий фиксированный цикл работы команды" },
      { id: "b", text: "Срочная ошибка в продакшене" },
      { id: "c", text: "Тип SQL-запроса" },
      { id: "d", text: "Вкладка DevTools" },
    ],
    correctOptionId: "a",
    explanation:
      "Спринт - ограниченный по времени отрезок, за который команда создаёт полезный инкремент продукта.",
  },
  {
    id: "jira-status",
    topic: "Agile и Scrum",
    text: "Зачем QA следить за статусами задач в Jira?",
    options: [
      { id: "a", text: "Чтобы понимать, что и когда можно тестировать" },
      { id: "b", text: "Чтобы заменить планирование команды" },
      { id: "c", text: "Чтобы не читать требования" },
      { id: "d", text: "Чтобы изменить роль пользователя" },
    ],
    correctOptionId: "a",
    explanation:
      "Статус задачи помогает QA вовремя взять готовую к тестированию работу и сообщить результат команде.",
  },
];

if (FINAL_QUIZ_QUESTIONS.length !== 30) {
  throw new Error("Итоговый тест должен содержать 30 вопросов");
}
