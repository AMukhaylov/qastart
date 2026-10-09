# Матрица автопокрытия QA START

**Повторная проверка после reconciliation 0.5.0 (2026-10-09):** Python regression — 106 passed / 4 skipped; TypeScript unit — 74 passed; lint, typecheck, production build и read-only production smoke — passed. Четыре mutation tests намеренно пропущены: они требуют --run-mutation и реальных авторизованных тестовых токенов; их нельзя запускать на PROD-учётках. Cross-user API integration test добавлен, но live прогон с двумя student tokens не выполнен без отдельной test-среды. Smoke подтверждает public/Auth/REST поведение, но не заменяет полный signed-in student/admin E2E.

После сверки 66/66 локальных активных migration filenames с production ledger исторические contract tests перенаправлены на supabase/legacy-migrations, а рабочие user-flow tests остались на текущих компонентах и server functions.

Обозначения: **Да** — автоматизировано; **Частично** — есть unit/static/smoke, но не критичный полный flow; **Нет** — надёжного автотеста нет. Пути относительные от корня.

| Функция | Сценарий | Покрытие | Тип | Файл теста |
|---|---|---:|---|---|
| Public pages | Главная, legal, контакты, login, lesson/admin маршруты отвечают | Да | API | `autotests/api/test_public_http.py` |
| Security headers/compression | CSP/HSTS/CORP/COOP, gzip | Да | API smoke | `autotests/api/test_public_http.py` |
| Login validation | Недопустимый логин/email, visibility toggle, recovery | Да | UI | `autotests/ui/test_auth_validation.py`, `test_public_pages.py` |
| Session / student auth | Вход, dashboard, lesson 1, profile PII | Частично | UI, credentials needed | `autotests/ui/test_authenticated_student.py` |
| Admin auth / roles | Админские страницы и доступ к основным панелям | Частично | UI, credentials needed | `autotests/ui/test_admin_smoke.py` |
| Cross-role authorization / IDOR | Admin-only server functions и student A/B boundaries | Частично | Static API/security contract; live 2-token API integration не запускался | autotests/unit/test_admin_import_rpc_security.py, autotests/api/test_cross_user_rls.py |
| Dashboard / course schedule | Расчёт прогресса, индивидуальный график, TZ/date boundary | Да | Unit | `autotests/unit/course-analytics.test.ts`, `course-schedule.test.ts`, `course-completion.test.ts` |
| Lesson access | Расписание и недоступность будущего урока | Частично | Unit + static policy | `course-schedule.test.ts`, `autotests/unit/test_progress_access_policy.py` |
| Lesson content | Package import/export, block types, validation, legacy upgrade | Да | Unit | `autotests/unit/lesson-package.test.ts`, `test_interactive_lesson_contract.py` |
| Lesson UX desktop/mobile | Урок 2, floating Archie, mobile viewport | Частично | Production UI smoke | `autotests/ui/test_day_two_lesson.py` |
| Required block progress | Идемпотентный retry/offline outbox, answer normalization | Частично | Unit | `lesson-progress.test.ts`, `lesson-question-answer.test.ts` |
| Required block API authorization | Прямой REST write запрещён, server action проверяет assessment | Да, contract; live DB ещё не проверена | Static security contract | `autotests/unit/test_student_assessment_security.py` |
| Questions / intermediate checks | Выбор, серверная оценка, duplicate/malformed answers; Archie remains available | Да | Unit + contract | `lesson-question-answer.test.ts`, `archie.test.ts`, `test_interactive_lesson_contract.py` |
| Human homework | Schedule counts, SQL/manual distinctions, status classification | Частично | Unit | `course-homework.test.ts`, `homework-status.test.ts` |
| Homework end-to-end | Submit attachments, mentor review/rejection, notifications, resubmission | Частично | UI smoke/logic unit; полный workflow нет | `test_authenticated_student.py`, `test_admin_groups_meetings.py`, `homework-status.test.ts` |
| SQL sandbox execution | SELECT/write allowlist, SQL equivalence, result matching, feedback, reset | Да | Unit | `autotests/unit/sql-sandbox.test.ts` |
| SQL sandbox persistence integrity | Запрос и expected result проверяются на сервере; answer key скрыт; клиент не задаёт `passed` | Да, contract + evaluator smoke | Static security contract, unit/runtime smoke | `autotests/unit/test_student_assessment_security.py`, `autotests/unit/sql-sandbox.test.ts` |
| Final quiz bank | Question integrity, duplicate/rejection/import, configurable question count | Да | Unit | `final-quiz-bank.test.ts`, `lesson-package.test.ts` |
| Final quiz runtime | Timer, start/resume/exit/attempt exhaustion/pass/fail | Частично | Mutation E2E opt-in; не запускался | `autotests/ui/test_final_quiz_mutation.py` |
| Archie modes / safe context | Homework/assessment lock, self-check availability, no hidden answers in prompt | Да | Unit + source contracts | `archie.test.ts`, `autotests/unit/test_archie_security_contract.py` |
| Archie achievements | De-dup, priority, completed lesson/course events, copy config | Частично | Static contracts + unit picks; no full event E2E | `archie.test.ts`, `test_archie_security_contract.py` |
| Archie AI security / rate limits | API mode recheck, old history bypass, atomic reservation; 12-way concurrent cap=3 | Контракт: да; staging integration не запускался | Static + opt-in concurrent API integration | `test_archie_security_contract.py`, `test_archie_atomic_rate_limit.py`, `autotests/api/test_archie_rate_limit_concurrency.py` |
| Cross-user IDOR | Student A attempts to read/update Student B profile | Реальный staging прогон не запускался; доступен opt-in API тест | API integration with two student tokens | `autotests/api/test_cross_user_rls.py` |
| Admin Archie | Collapse persistence, settings save/provider, messages | Частично | UI smoke + static contracts | `autotests/ui/test_admin_smoke.py`, `test_archie_security_contract.py` |
| Admin students / avatar | Student list and avatar flow | Частично | UI + source contract | `test_admin_smoke.py`, `test_admin_student_avatars.py` |
| Groups / meetings | Admin views and RLS policy shape | Частично | UI + static SQL | `test_admin_groups_meetings.py`, `test_groups_meetings_rls.py` |
| Admin lesson editor/import | Preview, export/import format, lesson switch, mobile toolbar | Частично | UI + unit; save-to-DB flow incomplete | `test_admin_smoke.py`, `lesson-package.test.ts` |
| Admin analytics | Aggregates and hide/show preference | Частично | Unit + UI | `course-analytics.test.ts`, `test_admin_smoke.py` |
| Import XSS / unsafe markup | DOMPurify implementation; malicious-package browser rendering | Частично | Source review, no adversarial test | `lesson-package.test.ts` (schema only) |
| Avatar API | Unauthenticated read/upload rejected | Да | API | `autotests/api/test_public_http.py` |
| Mobile | Landing, admin editor, Archie widget | Частично | UI smoke | `test_public_pages.py`, `test_admin_smoke.py`, `test_day_two_lesson.py` |
| Migrations/schema | Production history and assessment ACL inspected; added private admin-import implementation migration; ledger reconciliation and migration apply not done | Частично | Supabase MCP read-only; before latest change 79 local versions, 56 remote, 10 exact matches; current local count 80 | `QA_REGRESSION_REPORT.md`, `supabase/migrations/20261009102314_secure_student_assessment_progress.sql`, `supabase/migrations/20261009120046_archie_atomic_rate_limit.sql`, `supabase/migrations/20261009134047_secure_admin_import_rpc.sql` |
| Production deploy rollback | Backup-before-replacement, snapshot validation, nginx state restore and failure smoke contract | Покрыто static контрактами; фактический rollback rehearsal нет | `test_prod_deploy_rollback.py` (3 tests); Bash syntax check; no staging/server deployment | `autotests/unit/test_prod_deploy_rollback.py`, `deploy/remote-deploy.sh`, `deploy/ROLLBACK_RU.md` |
| Admin import RPC hardening | Public invoker wrapper, private definer implementation and admin ACL guard | Покрыто source-contract; database apply/auth negative integration отсутствуют | `test_admin_import_rpc_security.py`, updated access-policy contract | `autotests/unit/test_admin_import_rpc_security.py`, `autotests/unit/test_progress_access_policy.py` |
| Performance | Bounded 500-request local HTML preview test; no production stress, DB/API load, route budgets or CWV | Частично | Local smoke-load, localhost-only runner | `scripts/local-load-smoke.mjs`, `QA_REGRESSION_REPORT.md` |

## Тестовый инвентарь

- TypeScript: 74 Node unit tests (`autotests/unit/*.test.ts`).
- Python: 105 collected cases; 4 cases marked `mutation` (2 quiz mutation, 2 staging API integrations). Current exact category counts can shift as the suite grows; use `pytest --collect-only` for file-level inventory.
- `mutation` tests теперь пропускаются на collection без отдельного `--run-mutation`; `QA_ALLOW_MUTATION` и `QA_RUN_PROD_MUTATION` остаются дополнительными предохранителями.
- Три SQL/progress security contract tests проходят после исправления backend/RLS contract. Production grants/trigger уже проверены read-only через Supabase MCP; для безопасного migration/integration теста нужен согласованный staging.

## Повторный прогон 2026-10-09

- TypeScript: `npm run test:unit` — 74 passed, 0 failed.
- Python: `python -m pytest autotests -m "not mutation" -q --tb=no` — 101 passed, 4 deselected (249.93 s): 2 расходующих попытку quiz UI tests и 2 staging-only API integrations.
- Добавлен guard в `test_archie_atomic_rate_limit.py`: reservation RPC должна быть `SECURITY INVOKER` с фиксированным пустым `search_path`, помимо проверки атомарного лимита и fail-closed поведения.
- Lint, typecheck и production build прошли на тех же изменениях.
- Полный DB integration по migrations, два cross-user student tokens, concurrent RPC test и авторизованный E2E именно против текущего локального server build не запускались: нет disposable staging/service-role ключа. Production использовался только для ограниченного read-only smoke.
