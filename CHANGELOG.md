# Changelog

Все заметные изменения QA START будут фиксироваться здесь.

## 0.5.0 — production deployment and migration reconciliation, 2026-10-09

- Production 0.5.0 остаётся источником истины; в этой сверке схема и учебные данные production не менялись.
- Сверен production PostgreSQL catalog: 23 public tables, 196 columns, 63 indexes, 99 constraints, 2 enums, 39 policies, 14 public/private functions, 17 triggers; RLS включён на 23/23 public tables. Имена таблиц/колонок совпадают с application type contract (23/23).
- Финальная сверка исходников с работающим сервером: SHA-256 совпал для 163/163 файлов `src`, `public` и сборочных манифестов/конфигурации.
- Финальные проверки 2026-10-09: Python regression 106 passed / 4 deselected; TypeScript unit 74 passed; lint, typecheck, production build и read-only PROD smoke прошли.
- Migration history согласована: 66/66 локальных активных миграций совпадают с production ledger по version/name. Шесть подтверждённых local-only миграций помечены применёнными только в ledger (пустые statements; SQL не запускался); 16 устаревших/дублирующих миграций перенесены в supabase/legacy-migrations. Их причины перечислены в README архива.
- Точная production-only миграция 20260922132011_restore_day_one_base_sequence восстановлена в active history из сохранённого production SQL; повторно не выполнялась. Это разрушительный исторический reset Day 1, не запускайте её на уже заполненной production БД.
- Полный локальный shadow schema diff и clean reset не выполнялись без Docker и linked CLI DB credentials. Это техническое ограничение аудита, не блокер для уже работающего PROD 0.5.0. Leaked-password protection оставлена отдельной рекомендацией.
- Воспроизведение БД с абсолютного нуля через локальный Supabase stack не проверялось из-за отсутствия Docker; это ограничение проверки, а не блокер запуска текущего PROD.

- Production-приложение обновлено до package version 0.5.0; PM2 online, публичный smoke после выкладки прошёл.
- В production применены и проверены security migrations: 20261009142157_secure_student_assessment_progress, 20261009142249_archie_atomic_rate_limit, 20261009142334_secure_admin_import_rpc.
- Дополнительно применена 20261009151349_revoke_excess_assessment_privileges: отозваны неиспользуемые TRUNCATE/TRIGGER/REFERENCES для anon/authenticated на progress и SQL attempts; чтение authenticated и серверные права сохранены.
- Сверка с production-generated TypeScript schema: 23/23 public tables и все имена колонок совпали. Это не полный PostgreSQL schema diff: локальный Supabase CLI не связан с проектом и нет DB password/access token для linked diff.
- Прямые authenticated INSERT/UPDATE для lesson_block_progress и sql_sandbox_attempts закрыты; service_role запись сохранил. Public import RPC теперь SECURITY INVOKER, реализация перемещена в private с admin-role проверкой. Archie reservation RPC доступен только service_role.
- Первая deploy-попытка поймала краткий 502 сразу после PM2 restart; автоматический rollback восстановил предыдущие файлы и nginx. Добавлен ограниченный retry transient gateway responses; повторный deploy и smoke прошли.
- После production-сборки: Python safe suite 106 passed / 4 deselected; TypeScript unit 74 passed; lint, typecheck, production build и production smoke passed. Mutation tests не запускались.
- DB snapshot не создавался по указанию владельца. Deploy snapshots приложения и nginx сохранены в /var/backups/qastart; rollback приложения фактически сработал после неуспешной первой попытки.
- 44 локальных migration-файла переименованы на version IDs из production ledger по точному имени; `homework_messages` сопоставлен с production `create_homework_messages`. SQL этих миграций повторно не запускался.
- Проверки перед фиксацией 0.5.0: Python regression 106 passed / 4 skipped (mutating opt-in), TypeScript unit 74 passed, lint/typecheck/build прошли; production smoke прошёл по публичным/Auth/REST checks. Авторизованные end-to-end student/admin транзакции в production намеренно не выполнялись.
- Release commit/tag/push фиксируют проверенный checkout 0.5.0 обычным git; удалённый release UI и `gh` не используются.
- Supabase leaked-password protection выключена. Advisor также сообщает об RLS-disabled таблице private.lesson_import_requests; Data API probe с Accept-Profile: private вернул 406, поэтому таблица не доступна через Data API. RLS finding оставлен без автоматического включения.

## Unreleased — предрелизный регресс 2026-10-09

### Исправления по замечаниям повторного pre-prod аудита

- Добавлена migration `20261009134047_secure_admin_import_rpc.sql`: SECURITY DEFINER реализация импорта уходит в `private`, защищается фиксированным пустым `search_path` и явной admin-role проверкой; публичным остаётся SECURITY INVOKER wrapper.
- Обновлён контрактный тест импорта: он больше не требует небезопасный публичный SECURITY DEFINER RPC; добавлены проверки wrapper/private implementation.
- PROD deploy теперь вызывает отдельный проверяемый скрипт `deploy/remote-deploy.sh`; до замены создаётся root-only архив приложения (включая `.env`), проверяются архивы и сохраняются nginx config/link.
- При ошибке deploy автоматически восстанавливаются приложение и nginx, выполняются PM2 restart и smoke; удалён `pm2 flush`, typecheck выполняется до перезапуска приложения вместе с lint/build.
- Добавлены три regression-теста deploy rollback contract; целевые миграционные и deploy contract проверки: 8 passed.
- Изменения DB не применены: staging branch отклонена пользователем; production migration ledger не reconciled. Auth leaked-password protection остаётся отдельной Dashboard-настройкой, к которой нет доступных credentials/API.
- Повторный safe suite после обновления: `python -m pytest autotests -m "not mutation" -q --tb=short` — 106 passed, 4 deselected; lint, typecheck и build прошли; Bash/PowerShell syntax checks и targeted 8 regression tests прошли.

### Изменено

- Добавлена команда `npm run typecheck`.
- Исправлена подмена результата SQL: запрос выполняется на сервере по конфигурации из БД, а результат и pass-state сохраняются только доверенным backend.
- Эталонные SQL-столбцы/строки и `verificationQuery` скрыты из ученического payload; ученический SQL запускается только на сервере (admin preview не менялся).
- Прямые клиентские записи SQL-попыток и прогресса блоков закрыты новой Supabase migration; completion теперь повторно валидирует assessment-результаты и очищает невалидные исторические маркеры.
- Добавлены security regression contracts для прямого REST обхода, серверной проверки SQL/вопросов и отсутствия answer key в клиентском payload; все 3 проходят.
- Неверные ответы обязательных промежуточных вопросов не засчитывают блок, при этом ученик может попробовать снова.
- SQL sandbox блокирует `WITH RECURSIVE`, чтобы не исполнять неограниченную рекурсию в серверном evaluator.
- Mutation UI tests теперь пропускаются без явного `--run-mutation`; env-переменные больше не запускают расходующие попытки тесты сами по себе.
- E2E проверка Арчи больше не привязана к фиксированной подписи: использует админ-настраиваемый subtitle.
- Исправлены только типовые ошибки настроек Арчи и avatar row, без изменения поведения продукта.
- Обновлены два устаревших security/progress source-contract теста под серверное оценивание и новое required-block completion.
- Добавлен `npm run test:load:local`: bounded 500-request local SSR smoke с localhost-only guard и без нагрузочных запросов к production.
- Лимит запросов Арчи перенесён на атомарный `reserve_archie_request` RPC с per-user advisory lock; reservation записывается до вызова AI, а ошибка RPC блокирует вызов провайдера. Для schema добавлена отдельная migration, production не менялся.
- Добавлены opt-in staging integration tests: 12 параллельных Archie reservations при лимите 3 и межпользовательские profile read/update с двумя student-токенами; оба теста требуют явного staging target и пропускаются в обычном safe suite.

### Регресс

- TypeScript unit: 74 passed.
- Security contracts: 3 passed; серверный evaluator отдельно проверен валидным и неверным запросами.
- Lint, typecheck и production build прошли после исправлений.
- Production smoke выявил и помог исправить устаревшее ожидание UI; повторный тест прошёл.
- Предыдущий safe E2E выявил 2 устаревших source-contract теста: оба обновлены; полный повтор safe API/UI + checkout contracts прошёл (98 passed, 2 mutation tests deselected).
- Read-only Supabase MCP проверка выполнена: production всё ещё имеет authenticated write grants/policies; local/remote ledger versions расходятся (78 local, 56 remote, 10 совпадений). Массовый migration push небезопасен без reconcile.
- Последний полный safe Python API/UI/contract набор: 100 passed, 4 mutation tests deselected (278.56 s).
- `npm run test:unit`: 74 passed; `npm run lint`, `npm run typecheck` и `npm run build` прошли.
- Локальный preview load smoke: 500 GET + warm-up, concurrency 20, ~215 req/s, p95 ~106 ms, ошибок нет; production нагрузка не проводилась.
- Лимит Арчи: SQL/source contract tests проходят; конкурентный RPC test без выделенного staging пропущен. DB reservation migration не применена.
- Cross-user API regression добавлен; тест с двумя student tokens пропускается без подтверждённого staging и не запускался на production.
- Повторный read-only список migrations через Supabase MCP: remote ledger по-прежнему 56 записей; local/remote reconciliation не завершена, поэтому migration push по-прежнему небезопасен.

## Повторная проверка — 2026-10-09

- После последних изменений повторно прошли: TypeScript unit 74/74; Python safe suite 101 passed / 4 mutation cases deselected; lint, typecheck, production build.
- Повторный production-preview load smoke (только localhost): 500 GET, concurrency 20, 0 ошибок, 251 req/s; маршруты `/`, `/auth`, `/privacy`, `/lessons/1` p95 101–103 ms.
- `lesson-guide-pending` переведён на WebP, 1,163.25 kB → 53.69 kB; два компонента используют оптимизированный ресурс, исходник PNG сохранён.
- Rate-limit RPC migration переведена на `SECURITY INVOKER` + фиксированный пустой `search_path`; static contract test проверяет эти ограничения.
- Read-only production smoke успешен для публичных маршрутов и Auth. Приватный storage check пропущен без service-role key.
- Повторный DB ledger показывает 56 production migrations; обе локальные migrations от 2026-10-09 не применены. Production advisor сохраняет Critical/P1 risk вокруг direct assessment/progress writes.
- PROD deployment остановлен: migration drift не reconciled и deploy script не гарантирует rollback (удаляет текущие файлы до выкладки). Версия, commit, tag и push не создавались; текущая ветка не считается готовой к PROD.

### Релиз

- Версия не зафиксирована: существующие git tags, release commit и `package.json` расходятся. Предложение после устранения blockers — `0.5.0`.
- Commit, git tag, push и remote release не создавались.
- Миграция и приложение ещё не применялись к production; для production fix требуется согласованная выкладка обоих компонентов.
