# Предрелизный регресс QA START

## Итог reconciliation 0.5.0 — 2026-10-09

- Источник истины — работающий PROD 0.5.0. Старые миграции на production не исполнялись; schema/data tables не менялись.
- Migration ledger и активная локальная цепочка теперь совпадают: 66 production entries и 66 локальных файлов, все пары version/name совпали. Шесть подтверждённых локальных исторических изменений внесены как applied ledger markers с пустым statements array; это только метаданные истории, не исполнение SQL. Ещё 16 local-only SQL перенесены в supabase/legacy-migrations с пофайловой классификацией.
- Production-only destructive migration 20260922132011_restore_day_one_base_sequence восстановлена в активный каталог из точного сохранённого SQL; исходный migration SQL не запускался повторно.
- SHA-256 сверка deployed `/var/www/qastart` с локальной копией: совпали 163/163 production-файлов исходников, публичных ресурсов и сборочных манифестов/конфигурации.
- Read-only каталог PROD: 23 таблицы, 196 колонок, 63 индекса, 99 constraints, 2 enum, 39 policies, 14 функций, 17 пользовательских triggers; RLS включён на 23/23 public tables. Generated app types совпадают по 23/23 public tables и 196 имёнам колонок. RPC определения, execute grants, ключевые таблицы, policies и triggers проверены отдельно.
- Критичные оценки/progress записи запрещены authenticated, public.has_role недоступна anon/authenticated, Archie reservation доступна только service_role; public import wrapper — invoker, privileged implementation — в private с role check.
- После архивации миграций и обновления тестовых путей: Python regression — 106 passed / 4 deselected; TypeScript unit — 74 passed; lint, typecheck, production build — passed. Повторный PROD read-only smoke — passed.
- Ограничения: linked Supabase CLI migration list/db diff недоступны без CLI token/project link; вместо этого локальные 66 filenames сверены с MCP production ledger 66/66. Полный локальный DDL shadow diff и clean reset не выполнены без Docker. Это ограничение воспроизводимости, но не blocker текущего работающего PROD. Авторизованный mutation smoke по ученическим данным не проводился.
- Воспроизведение БД с абсолютного нуля через локальный Supabase stack не проверялось из-за отсутствия Docker.
- Остаются некритичные рекомендации: leaked-password protection выключена; существует PostgreSQL TRUNCATE grant для anon на отдельные таблицы, но такой метод не экспонируется через PostgREST Data API (требует отдельной проверяемой least-privilege очистки); private.lesson_import_requests не имеет RLS, но закрыта для anon/authenticated grants и private schema не доступна в Data API.

Ниже сохранены записи предыдущих этапов регресса; если они противоречат этому разделу, актуальным считать именно этот итог.

## Актуальный результат после production deployment

- Production app сейчас отдаёт package version 0.5.0; PM2 online. Production smoke после выкладки успешен: публичные/auth/admin-login/legal routes 200, удалённые routes 404, Supabase Auth 200, unauthenticated REST 401, CORS и приватный homework storage проверены.
- В production применены четыре адресные миграции: 20261009142157_secure_student_assessment_progress, 20261009142249_archie_atomic_rate_limit, 20261009142334_secure_admin_import_rpc, 20261009151349_revoke_excess_assessment_privileges. Effective grants подтверждают: anon/authenticated не могут писать или выполнять TRUNCATE/TRIGGER/REFERENCES на lesson_block_progress/sql_sandbox_attempts; authenticated сохраняет SELECT, service_role — нужные серверные права. Public import RPC — invoker; private implementation — definer с пустым search_path и admin-role guard. Rate reservation RPC доступен только service_role.
- Supabase-generated types сравнили с локальным `src/integrations/supabase/types.ts`: совпадают 23/23 public tables и все имена columns. Это не покрывает полный DDL diff функций, индексов и всех политик. `npx supabase db diff --linked` не запустить: CLI не связан (`ProjectRefNotLinkedError`), локальных Supabase access token и DB password нет.
- Регресс после deployment: Python safe suite 106 passed / 4 deselected; npm run test:unit 74 passed; lint, typecheck и production build прошли. Четыре mutation/API tests не запускались, чтобы не расходовать реальные quiz attempts и не мутировать чужие production fixtures.
- Первая deploy-попытка автоматически откатилась после краткого 502 сразу после PM2 restart; позже read-only health вернулся к 200. В smoke добавлен ограниченный retry для 502/503/504. Вторая попытка завершилась успешно. Файловый rollback snapshot: /var/backups/qastart/qastart-predeploy-20261009T144918Z-527771.tar.gz; nginx backup сохранён рядом. По просьбе пользователя DB backup не создавался.
- Актуальный production migration ledger — 60 записей; локально 81 файл. 44 filenames с совпадающим точным migration name приведены к version IDs production; `homework_messages` сопоставлен с production `create_homework_messages`. Теперь 59 migrations совпадают по точным version/name. Остаются 22 local-only и 1 remote-only migration; local-only содержат baseline/DDL и course-content DML/reset. Они не применялись и не отмечались applied. Полный DDL diff недоступен без linked CLI/DB credentials; `db push` не запускался.
- package.json установлен на 0.5.0; release commit/tag/push пока не создавались из-за незакрытого migration reconciliation. Владелец указал публиковать обычным git без `gh`. Production source files проверены побайтно: все 160 файлов `src/` и `public/`, а также `package.json` совпадают с локальным checkout.
- Повторный `npm run smoke:prod` после последней grants migration прошёл для public/auth/admin routes, Supabase Auth, CORS и REST 401; приватное Storage bucket в этом запуске пропущено, потому что локально нет `SUPABASE_SERVICE_ROLE_KEY`. Предыдущий production deploy smoke проверил bucket с server-side ключом.
- Открытые security findings: leaked-password protection в Supabase Auth выключена (отдельная рекомендация). Advisor помечает private.lesson_import_requests как RLS-disabled; проверка Data API вернула 406 и anon/authenticated не имеют table grants, поэтому таблица не доступна через клиентский Data API. Автоматически RLS не включал.
- DB snapshot не создан по указанию владельца. Все три применённые изменения — grants/functions; DML по учебным строкам не выполнялся.

Итог: **production app развернут как package 0.5.0; deployment smoke ранее успешен, повторный safe regression после исправления тестовых путей выполняется. 59 migration versions синхронизированы, но оставшийся хвост и полный DDL diff не закрыты; GitHub release поэтому не фиксировался.**

Исторические разделы ниже фиксируют состояние до разрешённого production deployment и частично устарели; для текущего статуса использовать этот раздел.

Дата проверки: 2026-10-09
Checkout: `codex/final-quiz-bank-admin`, HEAD `c098e60`. Рабочее дерево уже содержало многочисленные незакоммиченные изменения; они сохранены. Отчёт относится к этому checkout и не является подтверждением релиза.

## Итог

**P1 дефекты исправлены в текущем checkout, но production всё ещё уязвим.** Read-only проверка через подключённый Supabase MCP подтвердила в production `authenticated` INSERT/UPDATE/DELETE-права и старый SQL trigger без проверки доверенной роли. Изменения кода и блокирующая миграция готовы локально, но не применены. Local/remote migration ledgers существенно расходятся (79 файлов в checkout, 56 записей в production, совпадают только 10 версий), поэтому массовый `db push` опасен; приложение и миграции нельзя выкатывать по отдельности.

## Проверки и результаты

| Проверка | Результат | Примечание |
|---|---|---|
| Security contract tests after fix | 3 passed | Проверены отсутствие client writes, server-side SQL grading, progress checks, сокрытие эталонных SQL-ответов и migration contract |
| Archie atomic rate-limit contracts | 2 passed | Проверяют вызов reservation до AI provider, per-user DB lock, 60-second window и fail-closed path |
| Cross-user and concurrent limit integration | 2 deselected | Требуют disposable staging, двух student users / service role; production не используется |
| Remote Supabase migrations/schema | Inspected read-only | Через MCP проверено 56 записей; совпадает 10 из 79 локальных migration versions. Production пока сохраняет прямые права записи. `npx supabase migration new` доступен для создания migration; Docker/локальная БД отсутствуют |
| Server SQL evaluator smoke | Passed | На production bundle валидный query получил `passed=true`, неверный — `passed=false` |
| Latest lint/typecheck/build | passed | Запущены после изменений безопасности |
| Latest TypeScript unit | 74 passed | SQL allowlist включает отказ от `WITH RECURSIVE` |
| TypeScript unit | 74 passed | `npm run test:unit`; 0 failed |
| Production Playwright/API, до исправления stale assertion | 94 passed, 1 failed, 2 mutation deselected | Сбой был устаревшим ожиданием фиксированной подписи Арчи; assertion исправлен на проверку настраиваемого непустого subtitle |
| Исправленный production Archie E2E | 1 passed | `test_day_two_and_archie_widget_are_available_on_desktop_and_mobile` |
| Production полный safe suite до обновления contracts | 94 passed, 2 failed, 1 error, 2 mutation deselected | Два ожидаемых security gate падали по P1 дефектам; profile test один раз не дождался dashboard marker, отдельный rerun прошёл (1 passed) — flaky/auth timing остаётся наблюдением |
| Production API/UI без авторизации | 78 passed, 2 failed, 19 deselected | Два намеренно красных security contract tests фиксируют SQL/progress обходы; 19 auth/mutation сценариев не входили в этот срез |
| Последний полный safe API/UI + checkout contracts | 100 passed, 4 deselected | После добавления Archie contracts и staging-only API cases; все mutation сценарии отключены |
| Локальный bounded load smoke | 500 измеряемых запросов + по 1 warm-up на маршрут, concurrency 20; 0 ошибок | Production `vite preview` на localhost; `/`, `/auth`, `/privacy`, `/lessons/1`; 214.9 req/s, p50 ~92 ms, p95 105–106 ms, p99 117–118 ms. Скрипт строго отказывает remote/production host. Не является DB/API/load SLA или production нагрузочным тестом |
| Lint | passed | `npm run lint` |
| Typecheck | passed | `npm run typecheck`; исправлены типовые несоответствия, бизнес-логика не менялась |
| Production build | passed | `npm run build`; client + SSR bundles построены |
| Mutation regression | 2 skipped | Проверено, что оба теста экзамена пропускаются без явного `--run-mutation`, несмотря на включённые env-флаги |
| DB migrations/schema | partially verified | Remote migration list через Supabase MCP прочитан read-only; история не reconciled, migration DDL не запускался |

Общий Python набор содержит 100 собранных cases: 17 API, 27 UI, остальные — contract/unit. Safe E2E использует настроенные QA учётки на развёрнутом сайте; защищённые SSR-функции именно текущего локального checkout всё ещё нельзя полноценно проверить из-за отсутствующего `SUPABASE_SERVICE_ROLE_KEY` и локальной Supabase среды. Для локального preview выполнен только ограниченный HTML route smoke-load; production не нагружался. Итоговые числа относятся к разным срезам выше и не суммируются в единый процент успешности.

## Архитектура и границы проверки

Приложение — React/TanStack Start + TypeScript/Vite; backend server functions используют Supabase Admin client, auth/access token проверяются через Supabase Auth, роли — через `user_roles`. Прогресс, домашние задания и результаты хранятся в Postgres с RLS; SQL задания теперь повторно исполняются на сервере в отдельной in-memory SQLite базе и authoritative state записывается backend. Новая миграция снимает `authenticated` права на запись этих таблиц. Supabase production доступен через MCP read-only, CLI и локальная Docker DB отсутствуют.

Проверены основные server-function access checks, RLS SQL, flow домашних заданий и экзамена статически; production grants/policies/trigger и migration history — read-only запросами через MCP. Публичные HTTP-маршруты/headers и часть авторизованных экранов — через Playwright на `startqa.ru`. Добавлены opt-in cross-user API и concurrent Archie integration tests; оба требуют disposable staging и пока не запускались. Не выполнялись destructive CRUD/экзаменационные сценарии и live DDL/migration apply.

## Безопасность, стабильность и производительность

- P1 устранены в checkout; live metadata подтверждает, что production пока уязвим. Из-за расходящихся migration ledgers сначала нужно сверить историю/schema на staging, затем согласованно выложить код и DDL.
- Rate limit Арчи исправлен в checkout атомарной БД reservation с per-user advisory lock до вызова модели. Новая migration не применена, конкурентный integration test требует disposable staging и поэтому в этой среде не выполнен.
- По просмотренному коду ключ провайдера хранится в зашифрованном виде и наружу возвращается маска; серверные функции валидируют токен и роль. Публичный production smoke проверил security headers, gzip и unauthenticated avatar API. Полного dynamic penetration test не было.
- Rich lesson markup проходит через DOMPurify; для SQL sandbox есть unit-проверки ограничений SQL и сравнения результата. Набора adversarial XSS/IDOR/API fuzz tests нет.
- Local preview load smoke на 500 GET завершился без 5xx/ошибок: 20 concurrency, ~215 req/s, p95 ~106 ms. Скрипт [`scripts/local-load-smoke.mjs`](scripts/local-load-smoke.mjs) разрешает только loopback host и максимум 1000 запросов/25 concurrent. Это только HTML SSR на localhost без пользовательских DB/API потоков, не capacity test и не SLA. Production E2E измерял доступность и заголовок gzip, не Core Web Vitals. Build показывает крупные потенциально загружаемые ресурсы: `lesson-guide-pending.png` 1.16 MB, `sql-wasm` 658 KB (326 KB gzip), entry bundle 319 KB (96 KB gzip).
- Аналитика Арчи загружает урок, расписание, прогресс, блоки, отправки и попытки несколькими параллельными запросами; при росте нагрузки имеет смысл измерить server timing и рассмотреть объединение чтений после baseline.

## Версия и release state

Версионирование неоднозначно: последний видимый tag — `v0.3.27`, в истории есть commit `Release QA Start v0.4.1`, а `package.json` всё ещё указывает `0.1.1`; корневого changelog до этого регресса не было. После устранения P1 блокеров и повторного успешного регресса предлагаю согласовать **0.5.0** как следующий minor после функциональных изменений, и синхронизировать package/tag/changelog. Сейчас version/tag не создавались, commit и push не выполнялись, remote release не создавался.

## Обязательные gates перед релизом

1. Сверить remote/local migration history и schema на тестовой базе; не выполнять массовый `db push`, пока 69 локальных и 46 remote ledger versions не объяснены.
2. Применить migration и соответствующую версию приложения на staging вместе; убедиться, что service-role trigger допускает серверную запись.
3. Через student token проверить, что REST insert/update/delete в обеих таблицах запрещены, а legit SQL attempt и viewed progress работают через server functions.
4. Создать isolated/staging Supabase для API/Playwright и две тестовые роли для negative IDOR.
5. Проверить upgrade без потери корректного прогресса; исторические SQL результаты regrade-ятся по query_text.
6. Повторить полный safe suite на целевом commit; production пока не изменён.
7. На disposable staging выполнить 12 конкурентных резервирований Арчи при cap=3 и cross-user API test с двумя student-токенами.

## Повторная проверка после последних исправлений — 2026-10-09

- `npm run test:unit`: 74 passed, 0 failed.
- `python -m pytest autotests -m "not mutation" -q --tb=no`: 101 passed, 4 deselected (249.93 s). Staging-only API mutations и изменяющие сценарии намеренно не запускались.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- Повторный build подтверждает WebP иллюстрацию `lesson-guide-pending.webp`: 53.69 kB вместо исходных 1,163.25 kB.
- Повторный localhost-only load smoke на готовом production preview: 500 GET, concurrency 20, 0 ошибок; 251 req/s; `/`, `/auth`, `/privacy`, `/lessons/1` p95 101–103 ms. Записанный предыдущий прогон: 214.9 req/s, p95 105–106 ms. Это сравнение локальных прогонов, не гарантия причинного ускорения HTML и не замер БД.
- Read-only production smoke: публичные страницы и auth HTTP 200, Supabase Auth 200, REST без авторизации 401, CORS preflight 200. Проверка приватного storage пропущена: service-role key отсутствует.
- Read-only Supabase MCP: production Postgres 17.6.1.111, 56 записей migration ledger; обе локальные миграции `20261009102314` и `20261009120046` отсутствуют в production. Production security advisor подтверждает старые permissive write grants/policies на assessment/progress (см. предыдущую секцию); migrations не применялись.
- Production advisor дополнительно сообщает о leaked-password protection выключенной, одной authenticated `SECURITY DEFINER` функции и 10 FK без покрывающих индексов (INFO). DDL/настройки не менялись.
- Релизный gate закрыт: тестовая схема/staging отсутствуют, история миграций не reconciled, а `deploy/deploy-prod.ps1` удаляет содержимое app directory до раскладки и не создаёт rollback snapshot. Commit/tag/push/deploy не выполнялись; production smoke проверил текущую старую версию, не этот checkout.

## Работа по замечаниям pre-prod аудита — 2026-10-09

- PROD deploy script переподключён к `deploy/remote-deploy.sh`: он проверяет фиксированный real path и `.env`, создаёт и проверяет root-only snapshot до очистки app dir, сохраняет nginx config/link и при ошибке восстанавливает их, перезапускает PM2 и выполняет smoke. Добавлен runbook [`deploy/ROLLBACK_RU.md`](deploy/ROLLBACK_RU.md). Это проверка кода/контрактов, не rehearsal на сервере.
- Admin import RPC получил локальную migration `20261009134047_secure_admin_import_rpc.sql`: public invoker wrapper вызывает SECURITY DEFINER implementation в `private`; implementation имеет пустой `search_path` и исходную admin-role проверку. Migration не применяется к PROD.
- Обновлён прогресс security-contract и добавлены deploy rollback regression checks: targeted 8 passed. `remote-deploy.sh` прошёл Bash syntax check, PowerShell launcher — parser check.
- После этих исправлений полный safe Python suite: **106 passed, 4 deselected** (mutation сценарии не запускались); `npm run lint`, `npm run typecheck`, `npm run build` — passed.
- Staging branch по запросу пользователя не создавалась. Migration ledger остался 80 local files против 56 production entries (10 exact matches); `db push`, DDL в PROD и PROD deploy не запускались. Поэтому assessment/progress fixes и новый RPC hardening остаются только checkout, production сейчас по-прежнему не готов к широкому запуску.
- Leaked-password protection не включена: её можно переключить в Supabase Auth settings при поддерживаемом плане, но подключённые инструменты не дают доступа к изменению project Auth settings. `current_setting('pgrst.db_schemas', true)` в production вернул `NULL`, поэтому фактическую настройку Exposed schemas этим способом проверить нельзя.
