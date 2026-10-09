# Автотесты QA Start

Набор разделён на безопасный публичный регресс и сценарии с авторизацией. HTTP-граница проверяется библиотекой `requests`, пользовательские сценарии - `pytest` + Playwright.

## Быстрый запуск

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r autotests\requirements.txt
.venv\Scripts\python -m playwright install chromium
Copy-Item .env.autotests.example .env.autotests
```

Для локального прогона в отдельном окне запусти приложение:

```powershell
npm run dev
```

После этого:

```powershell
.venv\Scripts\python -m pytest
# либо
npm run test:autotests
```

Команда по умолчанию безопасна: сценарии с `mutation` пропускаются без явного `--run-mutation`. Для полноценного локального E2E защищённых страниц также нужны серверные переменные `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`; одних браузерных `VITE_SUPABASE_*` ключей недостаточно.

Публичный smoke-прогон продакшена не меняет данные:

```powershell
$env:QA_BASE_URL = "https://startqa.ru"
.venv\Scripts\python -m pytest -m "not authenticated and not mutation"
```

## Авторизованные сценарии

В `.env.autotests` укажи отдельные учётные данные:

```ini
QA_STUDENT_LOGIN=...
QA_STUDENT_PASSWORD=...
QA_ADMIN_EMAIL=...
QA_ADMIN_PASSWORD=...
```

Без этих переменных соответствующие проверки будут явно отмечены как `SKIPPED`, а не как успешные.

## Межпользовательская изоляция API

`autotests/api/test_cross_user_rls.py` проверяет чтение и обновление чужого профиля с двух
независимых student-токенов. Это сценарий с попыткой записи, поэтому он запускается только
с `--run-mutation`, двумя отдельными staging-учётками и точным подтверждением ожидаемых
хостов (`QA_CROSS_USER_EXPECTED_APP_HOST`, `QA_CROSS_USER_EXPECTED_SUPABASE_HOST`) плюс
`QA_CROSS_USER_STAGING_CONFIRM=true`. Production (`startqa.ru`) будет отклонён. Без полного
набора staging-переменных проверка будет `SKIPPED`.

`autotests/api/test_archie_rate_limit_concurrency.py` проверяет SQL RPC при 12 одновременных
запросах с лимитом 3. Нужны выделенный staging student/lesson, service-role key, пустое
60-секундное окно, project ref и точное имя staging-хоста с `QA_ARCHIE_RATE_LIMIT_STAGING_CONFIRM=true`.
Тест удаляет зарезервированные строки после прогона; production запрещён.

## Сценарии, меняющие данные

Запуск итогового теста расходует попытку. Поэтому такой сценарий помечен `mutation` и выключен без явного параметра командной строки. Он требует **одноразовую** учётную запись и два флага:

```powershell
$env:QA_ALLOW_MUTATION = "true"
$env:QA_RUN_PROD_MUTATION = "true" # только при осознанном прогоне на startqa.ru
.venv\Scripts\python -m pytest -m mutation --run-mutation
```

Скриншоты упавших Playwright-проверок сохраняются в `autotests/artifacts/` и не попадают в Git.

## Что покрыто

- доступность основных публичных, ученических и административных маршрутов;
- отсутствие самостоятельной регистрации и email-поля у ученика;
- валидация логина и переключатель видимости пароля;
- VK-ссылка и программа из 14 уроков на лендинге;
- мобильный smoke главной страницы;
- вход ученика, кабинет, первый урок и профиль (при наличии данных);
- вход администратора, ученики и редактор уроков (при наличии данных);
- старт итогового теста, число вопросов, таймер и отсутствие кнопки возврата (только одноразовая учётка);
- защита от 5xx на Supabase proxy и production security headers.

Дальше можно добавлять сценарии создания/удаления ученика и проверки попыток через отдельный тестовый API или изолированную базу: тестировать эти операции на общей production-базе небезопасно.
