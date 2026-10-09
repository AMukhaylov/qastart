# Найденные проблемы

## Актуальный PROD 0.5.0 — повторная сверка 2026-10-09

Подтверждённых Blocker/Critical дефектов по доступным read-only проверкам не выявлено. Старая запись ниже о migration drift и о TRUNCATE-grants была создана до этой reconciliation и superseded текущим разделом.

- **Medium / P2 — Auth leaked-password protection выключена.** Не мешает текущим сессиям/основным сценариям, но снижает защиту при новых/меняемых паролях. Рекомендация: включить в Supabase Auth settings и проверить signup/password update.
- **Medium / P2 — избыточный PostgreSQL TRUNCATE privilege на отдельных public tables для anon.** Catalog показывает ACL; TRUNCATE не предоставляется как операция PostgREST Data API и RLS защищает обычные row operations, поэтому удалённое использование через штатный клиентский HTTP не подтверждено. Рекомендация: снять grant через отдельную минимальную migration после проверки has_table_privilege всех ролей и использования функций.
- **Low / P3 — private.lesson_import_requests без RLS.** У anon/authenticated нет table grants, private schema не открыта через Data API, однако включить RLS и зафиксировать это в будущей миграции стоит.
- **Ограничение — полный db diff и clean reset не запускались.** Без Docker и CLI link/database credentials локальную shadow schema поднять не удалось; это не blocker для текущего работающего PROD, но ограничивает воспроизводимость.
- **Ограничение — mutation live integration tests не запускались на production.** Cross-user и rate-limit tests есть, но требуют отдельной среды с disposable student tokens.

Migration ledger сверена: production и активная локальная цепочка — 66/66 version/name. Изменялись только production migration-ledger metadata для шести подтверждённых уже выполненных изменений; migration SQL и учебные данные не исполнялись/не менялись.

Ниже приведён исторический список предыдущего статуса до reconciliation; его оценки не являются актуальным состоянием.

## Текущий статус production, 2026-10-09

Исправлены и подтверждены в PROD:
- **Critical/P1 direct assessment/progress write:** применена 20261009142157_secure_student_assessment_progress; authenticated INSERT/UPDATE на прогресс и SQL-попытки запрещён, service_role доступ сохранён.
- **High/P1 Archie race limiter:** применена 20261009142249_archie_atomic_rate_limit; reservation атомарный и доступен только service_role.
- **Medium/P2 public SECURITY DEFINER RPC:** применена 20261009142334_secure_admin_import_rpc; public wrapper invoker, implementation в private с admin check.
- **High/P1 deploy rollback:** реальный rollback восстановил snapshot приложения и nginx; после устранения краткого startup-502 повторный deploy прошёл.

Остаются ограничения:
- **Migration-history drift / release blocker:** 81 локальный файл vs 60 remote entries; 59 migration versions приведены к точным production IDs (включая homework message migration alias). Остаются 22 local-only и 1 remote-only; local-only включают bootstrap/DDL и content DML/reset. Ничего из них не применялось/не отмечалось applied. Полный linked DDL diff недоступен без CLI link/DB credentials; `db push` не запускался.
- **Дополнительные assessment grants:** обнаруженные у authenticated права TRUNCATE/TRIGGER/REFERENCES устранены миграцией 20261009151349; повторная effective-privilege проверка подтвердила deny для client roles и сохранение service_role.
- **Medium/P2 Auth:** leaked-password protection выключена; нужна настройка в Supabase Dashboard.
- **Medium/P2 private RLS lint:** Advisor сообщает, что private.lesson_import_requests без RLS. Data API probe для private вернул 406, у anon/authenticated нет table grants; автоматическое включение RLS не выполнялось.
- **Release traceability:** package и PROD version 0.5.0, но commit/tag/push не сделаны; checkout остаётся dirty.

Подробности — в QA_REGRESSION_REPORT.md.

Ниже сохранены исторические записи предыдущего регресса. Их статусы описывают checkout/production до адресных миграций и выкладки 0.5.0; актуальный статус приведён выше.

## Исправлено в checkout; требуется выкладка миграции и приложения

| Название | Severity / Priority | Компонент | Как воспроизвести | Expected | Actual | Рекомендация |
|---|---|---|---|---|---|---|
| Подмена успешного SQL результата | Critical / P1 | SQL sandbox, Supabase RLS | До исправления: отправить напрямую в `sql_sandbox_attempts` строку с `passed=true`. Live exploit не выполнялся | Только серверная проверка реального SQL результата создаёт `passed=true` | **Исправлено в checkout:** сервер загружает задание из БД, выполняет SQL в свежей SQLite и сам записывает результат; UI и завершение урока перепроверяют сохранённые запросы. Клиентские INSERT/UPDATE/DELETE закрыты миграцией | Перед production использовать миграцию `20261009102314_secure_student_assessment_progress.sql`, затем выложить приложение; подтвердить запрет прямого REST write на staging |
| Подделка обязательного прогресса блока | Critical / P1 | Уроки / RLS | До исправления: прямой upsert собственной строки в `lesson_block_progress`. Live mutation не выполнялся | Только серверно подтверждённый результат отмечает проверяемый шаг; урок завершён только при выполнении требований | **Исправлено в checkout:** прямой клиентский upsert и массовая запись перед completion удалены; серверный endpoint проверяет расписание, правильный ответ, SQL-попытки и итоговый тест. Существующие старые assessment-маркеры проверяются и очищаются при загрузке | Перед production применить ту же миграцию и проверить запрет REST insert/update/delete, а также корректность server-role записи на staging |
| SQL ключи ответов видны в клиентской конфигурации | High / P1 | SQL sandbox / content API | До исправления: открыть Network/React payload урока и посмотреть `expectedRows`, `expectedColumns` или `verificationQuery` | Ожидаемые результаты остаются только на сервере | **Исправлено в checkout:** loader удаляет эти поля из ученческого блока; обычный ученический SQL выполняется только серверным evaluator, admin preview сохраняет локальную проверку | Проверить отсутствие полей в ответе staging API и завершить выкладку |

Оба пункта покрыты зелёными static security contracts в `autotests/unit/test_student_assessment_security.py` (3 passed, включая проверку, что SQL answer key не уходит в браузер). Read-only запросы к production через Supabase MCP подтвердили, что эти права и старый trigger там ещё активны; миграция не применена.

## Исправить перед широким запуском тестов

| Название | Severity / Priority | Компонент | Воспроизведение | Expected | Actual | Рекомендация |
|---|---|---|---|---|---|---|
| Production mutation-тесты запускались обычной командой | High / P1 | Test infrastructure | В `.env.autotests` оба mutation-флага были включены; обычный `pytest` выбирал тесты экзамена, которые расходуют попытки | Общий регресс безопасен и никогда не меняет реальные данные | Два final-quiz сценария могли выполниться на production при обычном полном прогоне | Исправлено в этой работе: collection skip без явного `--run-mutation`; env-флаги сами по себе недостаточны. Проверено: два теста skipped |
| Авторизованный E2E текущего локального checkout не изолирован | Medium / P2 | Dev/test environment | Локальный `npm run dev`, затем защищённые SSR/admin/student экраны | Локальные проверки работают на отдельной disposable Supabase | Нет локального `SUPABASE_SERVICE_ROLE_KEY`, Supabase CLI и Docker; read-only E2E можно выполнить на deployed site, но он не проверяет незадеплоенный checkout | Создать staging branch/project и тестовые роли/seed; секреты хранить только в CI, не использовать production DB |
| Версии не согласованы | Medium / P2 | Release engineering | Сравнить tags, release commits, package.json | Одна последовательная версия | Последний tag `v0.3.27`; history содержит commit `Release QA Start v0.4.1`, tag отсутствует; `package.json` — `0.1.1` | До commit согласовать версию; предложен 0.5.0 после исправления блокеров |

## Желательно исправить после blocker'ов

| Название | Severity / Priority | Компонент | Как воспроизвести | Expected | Actual | Рекомендация |
|---|---|---|---|---|---|---|
| Rate limit Арчи не атомарен | Medium / P2 | Archie API / стоимость AI | Параллельно послать несколько запросов с одной учёткой в начале 60-секундного окна | Не больше configured cap принимает провайдер | **Исправлено в checkout:** server-side RPC сериализует reservation advisory lock-ом и записывает её до вызова AI; при недоступности RPC Арчи fail-closed. Migration ещё не применена к production | На staging запустить конкурентный integration test: 12 запросов при cap=3; выкладывать миграцию и backend только вместе |
| Migration ledger локальной ветки расходится с production | High / P1 | Supabase DB / release | Сравнить локальные migration versions с remote history | Понятный безопасный upgrade без повторного DDL | Read-only через MCP до этой задачи: 79 локальных файлов, 56 remote entries, только 10 совпадений; новая локальная migration увеличила count до 80. Staging branch отклонена; прямой `db push` может переиграть изменения | Не применять migrations к production. Нужен отдельный disposable staging или ручное reconciled plan по каждой версии и schema diff |
| Нет adversarial cross-user API regression | Medium / P2 | API security / QA | Запустить `autotests/api/test_cross_user_rls.py` с двумя student tokens на disposable staging | Чужой профиль нельзя прочитать или обновить | **Покрытие добавлено, но live regression ещё не запускался:** нет отдельного staging с двумя fixtures; production не трогали | Поднять staging, задать явные expected hosts и прогнать тест с `--run-mutation`; затем добавить student/admin boundary checks |

## Повторная проверка перед PROD — 2026-10-09

| Название | Severity / Priority | Компонент | Как воспроизвести | Expected | Actual | Рекомендация |
|---|---|---|---|---|---|---|
| Production всё ещё допускает подделку assessment/progress напрямую | Critical / P1 | Supabase grants/RLS, SQL homework, lesson progress | Через production metadata видны authenticated INSERT/UPDATE/DELETE grants и старый progress trigger; фактические mutation-запросы в production не выполнялись | Записи доступны только после серверной валидации | Исправление есть в checkout, но migrations `20261009102314` и `20261009120046` отсутствуют в production ledger; старые grants остаются | **Не релизить.** На disposable staging reconciled migration upgrade, verify preservation of student data, затем выкладывать DB и backend как один релиз |
| Local/production migration ledger не согласован | High / P1 | Supabase DB / release process | Сверить 79 локальных migration files и 56 production entries | Безопасный, проверяемый upgrade и rollback | Совпадают только 10 версий; CLI/Docker staging недоступны | Не запускать `db push`; выгрузить фактическую schema/history в отдельную тестовую БД и reconcile каждую версию |
| Production deploy script не создаёт rollback snapshot | High / P1 | Deploy / availability | Ошибка сборки/health-check во время deploy | Предыдущий релиз автоматически восстанавливается и проходит smoke | **Исправлено в checkout:** перед заменой файлов создаётся проверенный root-only архив текущего приложения и резервные копии nginx; `ERR` trap восстанавливает приложение/config, перезапускает PM2 и запускает smoke. Deploy ещё не запускался | Перед production выкладкой проверить процедуру на отдельном сервере; production deployment пока заблокирован drift миграций |
| Конкурентный лимит Арчи в production пока не обеспечен новой миграцией | Medium / P2 | Archie API / стоимость AI | Параллельные запросы в окне 60 секунд; production нагрузочно не тестировался | Количество вызовов ограничено конфигурацией | Atomic reservation есть в checkout, но RPC migration отсутствует в production ledger | Тестировать конкурентность только на disposable staging после reconcile; выкладывать RPC вместе с backend |
| Authenticated `SECURITY DEFINER` RPC exposed through public API | Medium / P2 | Lesson import API | Проверить production advisor и выполнить отрицательный вызов без admin role (без изменений данных) | В Data API доступен только `SECURITY INVOKER` wrapper; privileged implementation скрыта в `private` и проверяет роль администратора | **Исправлено в checkout:** новая migration переносит implementation в `private`, задаёт пустой `search_path`, сохраняет явную admin-role проверку и оставляет invoker wrapper в `public`. Migration не применена; `pgrst.db_schemas` read-only запросом вернул `NULL`, поэтому фактический список API schemas не подтверждён | Не выкладывать migration до сверки ledger и проверки, что `private` не включена в Exposed schemas; после выкладки проверить Advisor и отрицательный auth вызов |
| Leaked password protection выключена | Medium / P2 | Supabase Auth | Production security advisor | Auth отклоняет известные скомпрометированные пароли | Настройка выключена; в этом checkout нет доступа к Supabase project Auth settings | Владелец проекта включает настройку в Supabase Dashboard → Auth settings (функция доступна на Pro+), затем безопасно проверяет signup/password update; staging в этой задаче не создавался |
| Нет покрывающих индексов у 10 foreign keys | Low / P3 | Supabase DB performance | Production performance advisor | Частые FK joins/deletes используют индексы | Advisory warning; фактическая нагрузка и query plans не собраны | Сопоставить с pg_stat_statements на staging/production read-only, добавить только подтверждённо нужные индексы миграцией |
