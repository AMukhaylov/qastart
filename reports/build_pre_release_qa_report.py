from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reports" / "qa-start-pre-release-audit-2026-10-05.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

INK = colors.HexColor("#15233D")
MUTED = colors.HexColor("#53627A")
BLUE = colors.HexColor("#3C43F5")
PALE = colors.HexColor("#F2F5FB")
RED = colors.HexColor("#B42318")
AMBER = colors.HexColor("#8A4B08")
GREEN = colors.HexColor("#087443")
GRID = colors.HexColor("#D6DEEB")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleRU", fontName="Arial-Bold", fontSize=23, leading=29, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleRU", fontName="Arial", fontSize=11, leading=16, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="H1RU", fontName="Arial-Bold", fontSize=16, leading=20, textColor=INK, spaceBefore=5, spaceAfter=9))
styles.add(ParagraphStyle(name="H2RU", fontName="Arial-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=4, spaceAfter=3))
styles.add(ParagraphStyle(name="BodyRU", fontName="Arial", fontSize=9, leading=13, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallRU", fontName="Arial", fontSize=7.4, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="TableRU", fontName="Arial", fontSize=7.2, leading=9.4, textColor=INK))
styles.add(ParagraphStyle(name="TableHeadRU", fontName="Arial-Bold", fontSize=7.3, leading=9.2, textColor=colors.white))
styles.add(ParagraphStyle(name="CardLabelRU", fontName="Arial-Bold", fontSize=8, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="CardTextRU", fontName="Arial", fontSize=8.4, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="CenterRU", fontName="Arial", fontSize=9, leading=13, textColor=MUTED, alignment=TA_CENTER))


def P(text, style="BodyRU"):
    return Paragraph(text, styles[style])


def footer(canvas, doc):
    canvas.saveState()
    width, _ = landscape(A4)
    canvas.setStrokeColor(GRID)
    canvas.line(14 * mm, 13 * mm, width - 14 * mm, 13 * mm)
    canvas.setFont("Arial", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(14 * mm, 8 * mm, "QA Start · Предрелизный аудит · 05.10.2026")
    canvas.drawRightString(width - 14 * mm, 8 * mm, f"Страница {doc.page}")
    canvas.restoreState()


def make_table(headers, rows, widths, font="TableRU"):
    data = [[P(str(value), "TableHeadRU") for value in headers]]
    data.extend([[P(str(value), font) for value in row] for row in rows])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ]))
    return table


def finding(number, title, severity, priority, steps, expected, actual, recommendation, tone=RED):
    heading = P(f"{number}. {title} <font color='{tone.hexval()}'><b>· {severity} / {priority}</b></font>", "H2RU")
    rows = [
        [P("Шаги", "CardLabelRU"), P(steps, "CardTextRU")],
        [P("Expected", "CardLabelRU"), P(expected, "CardTextRU")],
        [P("Actual", "CardLabelRU"), P(actual, "CardTextRU")],
        [P("Рекомендация", "CardLabelRU"), P(recommendation, "CardTextRU")],
    ]
    table = Table(rows, colWidths=[26 * mm, 235 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, GRID),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return KeepTogether([heading, table, Spacer(1, 5 * mm)])


story = [
    Spacer(1, 14 * mm),
    P("ПРЕДРЕЛИЗНЫЙ QA-АУДИТ", "SubtitleRU"),
    P("QA Start", "TitleRU"),
    P("Регресс · безопасность · производительность · готовность к запуску", "SubtitleRU"),
    Spacer(1, 7 * mm),
    P("Итог: <font color='#B42318'><b>NO-GO</b></font> до устранения обхода прогресса и проверки/обновления уязвимых зависимостей.", "H1RU"),
    P("Проверялся репозиторий проекта на коммите <b>551d782</b> (релиз v0.4.1), Supabase-проект и безопасные production smoke-проверки. Аудит выполнен 5 октября 2026 года.", "BodyRU"),
    Spacer(1, 3 * mm),
    make_table(
        ["Область", "Результат"],
        [
            ["Регресс", "TypeScript, lint, production build и 50 Node unit-тестов — успешно."],
            ["Python / Playwright", "68 passed, 3 skipped, 1 failed, 1 error; полный прогон 243.8 с."],
            ["Production smoke", "Публичные страницы, auth, CORS и REST прошли; проверка приватного Storage пропущена без service-role секрета."],
            ["База и доступы", "Все 19 таблиц схемы public имеют RLS. Найдено разрешение ученику самому записывать завершение урока."],
            ["Зависимости", "npm audit --omit=dev: 31 advisories; среди high — DOMPurify, используемый при выводе HTML урока."],
            ["Нагрузка", "Не запускалась: подтверждённой изолированной staging/test-БД нет; production под нагрузку не подвергался."],
        ],
        [42 * mm, 219 * mm],
    ),
    Spacer(1, 6 * mm),
    P("Решение по запуску", "H2RU"),
    P("В текущем состоянии запускать рискованно: self-service запись в lesson_progress обходит учебные ограничения и позволяет открыть итоговый тест. Одновременно production-зависимости содержат high advisories. Полный browser-run также поймал страницу «Что-то пошло не так» при загрузке входа ученика; одиночный повтор прошёл, поэтому это плавающий, но не закрытый сбой.", "BodyRU"),
    PageBreak(),
    P("Покрытие автотестами", "H1RU"),
    P("Матрица отражает найденные типы тестов и что реально было исполнено. UI-тесты итогового теста, которые расходуют попытку, намеренно не запускались на рабочей production-учётке.", "BodyRU"),
    make_table(
        ["Функциональная область", "Нынешнее покрытие", "Оценка / пробел"],
        [
            ["Публичные страницы / вход", "Playwright: landing, мобильный viewport, форма и валидация; smoke HTTP.", "Среднее. Один full-run поймал generic error screen на /auth; isolated повтор прошёл."],
            ["Уроки / блоки / импорт", "Unit: экспорт/импорт и схемы; UI: редактор, preview/import, responsive admin.", "Хорошее на формат/клиенте; фактическую запись/rollback проверять только на staging."],
            ["Прогресс и доступность уроков", "Unit: очередь сохранения/offline retry; SQL-контракт миграций.", "Критический пробел: live RLS разрешает self-write completed; добавлен failing regression test."],
            ["Вопросы / SQL-практика", "Unit: банк итогового теста, sandbox SQL whitelist, CRUD verifier и импорт-конфиги.", "Хорошо в unit; нет отдельного API negative test от ученика к чужому block_id."],
            ["Домашние задания", "Unit: статусы / SQL completion; admin UI smoke очереди и отзывчивости.", "Частично. Нет безопасного E2E submit → review → approved/rejected на disposable backend."],
            ["Итоговый тест", "Unit: 90 вопросов, schema validation, completion; UI settings smoke.", "Механика selection/timer/attempt mutation покрыта условно, 3 mutation-теста пропущены."],
            ["Админка / роли", "UI: students, lesson editor, groups/meetings; миграции и live policies.", "Частично. Нет систематического student-vs-admin negative API/RLS matrix."],
            ["Безопасность / производительность", "npm audit, Supabase advisors, live RLS metadata, bundle audit.", "Нет DAST role matrix, browser XSS payload suite, query-plan SLO или staging load test."],
        ],
        [38 * mm, 105 * mm, 118 * mm],
    ),
    Spacer(1, 5 * mm),
    P("Следующий правильный слой тестов — локальная Supabase/staging integration: две роли и два ученика для проверки RLS/IDOR, конечная проверка сохранения ДЗ/прогресса, а затем ограниченный k6/Locust прогон с фиксированным профилем нагрузки. Не размножать E2E для банков, схем и валидации, которые уже быстро покрыты unit-тестами.", "BodyRU"),
    PageBreak(),
    P("Дефекты: блокируют запуск", "H1RU"),
    finding(1, "Ученик может самостоятельно отметить любые уроки пройденными", "Critical", "P0 — blocker",
            "Под ученическим JWT выполнить INSERT/UPDATE в <b>/rest/v1/lesson_progress</b> с собственным user_id, lesson_id предыдущего урока и <b>completed=true</b>; затем вызвать старт итогового теста. В аудитe это не эксплуатировалось на аккаунте; возможность подтверждена текущими production RLS-политиками и серверной проверкой unlock.",
            "Только доверенная серверная операция после валидного завершения должна создавать завершённый прогресс; произвольная запись клиента отклоняется.",
            "Live policies Users insert own progress / Users update own progress допускают auth.uid()=user_id без ограничения completed; read-only проверка подтвердила для authenticated прямые INSERT=true и UPDATE=true. Серверный <b>assertFinalQuizUnlocked</b> считает такие строки доказательством прохождения 13 уроков. Failing regression test: <b>test_students_cannot_write_course_completion_directly</b>.",
            "Закрыть прямые INSERT/UPDATE для authenticated (оставить чтение своей записи; сервисную запись выполнять серверным service-role/безопасной функцией); проверить дневной лимит и unlock через двух тестовых пользователей; зафиксировать negative API/RLS tests."),
    finding(2, "Уязвимые runtime-пакеты, включая DOMPurify", "High", "P1 — до запуска",
            "Сверить lockfile и выполнить <b>npm audit --omit=dev</b>; пройти вывод advisory для прямых runtime-зависимостей.",
            "Продакшн-зависимости без применимых High/Critical advisory; вывод урокового HTML покрыт XSS regression tests.",
            "Audit нашёл <b>31 advisory</b>, в том числе High для DOMPurify <b>3.4.13</b> и Tiptap/Browserslist/js-yaml зависимостей. DOMPurify реально используется перед dangerouslySetInnerHTML. Известный XSS-advisory DOMPurify ограничен сочетанием IN_PLACE и hook, которого в просмотренной функции не видно; эксплуатируемость именно текущей конфигурации не подтверждена.",
            "Обновить lockfile до исправленных совместимых версий, проверить release notes; добавить payload regression cases (script/event handlers/javascript URLs/SVG); повторить npm audit и build. Не считать advisory доказанным эксплойтом."),
    finding(3, "В full regression вход ученика показал экран неожиданной ошибки", "Medium", "P1 — закрыть до go/no-go",
            "Запустить <b>test_student_can_open_dashboard_and_first_lesson</b> вместе с остальным набором; дождаться marker гидратации /auth.",
            "Маршрут остаётся гидратированным, ученик попадает в dashboard; ошибок загрузки нет.",
            "Один раз full suite упал на setup: /auth отрисовал «Что-то пошло не так». Изолированный повтор сразу прошёл (17.4 с). HTTP smoke для /auth возвращал 200. Сбой плавающий, статус причины неизвестен.",
            "Проверить worker/server logs и browser console за timestamp прогона, записывать correlation/request id; повторить сценарий на staging; считать блокером, если подтверждается на пользовательском трафике или staging."),
    PageBreak(),
    P("Дефекты: после запуска / backlog", "H1RU"),
    finding(4, "Password leaked protection отключена в Supabase Auth", "Medium", "P2 — включить перед ростом аудитории",
            "Supabase Security Advisor → Auth settings; текущая конфигурация сообщена live advisor.",
            "Слабые/утекшие пароли отклоняются, особенно при invite/password setup.",
            "Advisor сообщает, что защита от leaked passwords выключена. Это усиливает риск reuse/credential stuffing, но само по себе не является доказательством захвата аккаунта.",
            "Включить Password Strength/Leaked Password Protection согласно тарифу; протестировать reset и смену пароля; не журналировать пароль или полный JWT.", tone=AMBER),
    finding(5, "Не проверена восстановимость бэкапов и файлов Storage", "Medium", "P2 — до накопления ценных данных",
            "Проверить Database → Backups/PITR и выполнить восстановление копии проекта; отдельно проверить резервирование Storage objects.",
            "Известны RPO/RTO; БД и пользовательские вложения можно восстановить и сверить.",
            "В этой сессии метаданные бэкапов/restore drill не доступны. Production smoke пропустил приватный bucket check, поскольку не было service-role credentials. Документация Supabase уточняет: DB backups не включают сами Storage-файлы.",
            "Подтвердить план Supabase, retention и PITR; расписать off-site logical exports для бесплатного тарифа при необходимости; отдельный Storage backup; квартальный restore drill." , tone=AMBER),
    finding(6, "Frontend-аналитика и сигнализация продуктовых ошибок не обнаружены", "Medium", "P2 — ближайший продуктовый этап",
            "В репозитории отсутствуют SDK/настройки Sentry и PostHog; нет определённой схемы событий обучения.",
            "Операторы узнают о росте ошибок/недоступности; команда видит шаги курса, drop-off и конверсию до успешного теста.",
            "Ошибки приходится ловить через пользовательские сообщения и ручной smoke; воронки и retention по событиям продукта не доступны.",
            "Внедрить Sentry для client/server errors + release health, минимальный ручной event schema в PostHog; не включать autocapture по умолчанию и исключить PII, ответы/текст ДЗ и токены.", tone=AMBER),
    finding(7, "Нет role-based API/RLS negative integration suite", "Medium", "P2",
            "Запустить проверки попыток читать/менять чужой профиль, ДЗ, группы, прогресс и quiz attempt под student JWT против admin JWT.",
            "Каждая таблица и server function проверены на owner/admin/unauthenticated границах.",
            "Тесты в основном статические по SQL и UI smoke; отрицательная RLS матрица на двух аккаунтах отсутствует. Новый progress policy test найденное нарушение сейчас фиксирует как красное.",
            "Добавить API/integration набор с изолированной Supabase test project; не проводить probing с чужими записями в production.", tone=AMBER),
    finding(8, "Семь внешних ключей без индексов", "Low", "P3 — наблюдать и оптимизировать",
            "Supabase Performance Advisor перечисляет FK course_invites(created_by, used_by), lesson_block_progress(block_id, lesson_id), quiz_attempts(lesson_id), sql_sandbox_attempts(block_id, lesson_id).",
            "Частые joins/deletes фильтруют через подходящие индексы при росте данных.",
            "Advisor сообщает 7 unindexed FK; query plan/slow query data в аудите не получены, поэтому фактическое замедление не измерено.",
            "Сначала проверить cardinality и реальные запросы/EXPLAIN; добавить только индексы для hot paths и измерить до/после.", tone=AMBER),
    P("Backlog без release-risk", "H2RU"),
    P("Есть advisor-сообщения о семи неиспользованных индексах и нескольких permissive RLS policies. Не удалять/сливать автоматически: usage может быть низким за период статистики, а policies могут выполнять разные задачи. Отложить до проверки query statistics и RLS matrix.", "BodyRU"),
    PageBreak(),
    P("Технические проверки и ограничения", "H1RU"),
    make_table(
        ["Проверка", "Результат / границы"],
        [
            ["npm run lint", "PASS"],
            ["npx tsc --noEmit", "PASS (до обновления только Python-тестов; TS-файлы не менялись)."],
            ["npm run build", "PASS; client transformed 2,224 modules. Основные generated outputs: app JS ~310 KB; SQL WASM ~658 KB raw (~326 KB gzip); lesson-guide PNG ~1.16 MB raw."],
            ["Node unit suite", "50 passed / 0 failed."],
            ["Python suite", "68 passed, 3 skipped, 1 failed (ожидаемый security regression), 1 error (плавающий /auth generic error screen). Общий процесс завершился exit 1."],
            ["Isolated repros", "Authentication dashboard scenario после error — PASS; mobile homepage сценарий после предыдущего full-run timeout — PASS."],
            ["Production smoke", "Публичные страницы — 200; retirеd callback/invite routes — ожидаемые 404; Auth 200; RPC CORS 200; REST без токена 401. Private Storage object/bucket check skipped."],
            ["RLS live inventory", "19/19 таблиц public имеют RLS включённым. Дополнительно прочитаны policy definitions. RLS включён ≠ политики автоматически безопасны: self-write progress — реальное исключение."],
            ["Supabase security advisor", "1 authenticated SECURITY DEFINER warning; код функции проверяет private.has_role(auth.uid(), 'admin'), search_path ограничен. Другой alert — leaked password protection disabled."],
            ["SQLi / XSS / IDOR", "Проверена поверхность кода и политик; пользовательский SQL выполняется локально в seeded SQLite sandbox с allowlist. SQLi не подтверждён. IDOR/self-service progress bypass подтверждён как misconfiguration. Runtime DOMPurify dependency flagged by audit; эксплуатационный payload не отправлялся."],
            ["Нагрузка и БД latency", "Не выполнялись: для безопасного профиля нужен isolated staging/DB. Нет достоверных p95/p99 API/DB latency или нагрузки, не было измерений production query plans."],
        ],
        [42 * mm, 219 * mm],
    ),
    Spacer(1, 5 * mm),
    P("Политика SECURITY DEFINER import function имеет grant только authenticated, но внутри сначала проверяет админа и задаёт фиксированный search_path; это предупреждение advisor само по себе не доказывает privilege escalation. По Storage объектам, приватным бакетам и restore backup необходим отдельный staging/секретный service-role smoke.", "BodyRU"),
    PageBreak(),
    P("Минимальный разумный стек улучшений", "H1RU"),
    make_table(
        ["Когда", "Инструмент", "Что включить"],
        [
            ["Сейчас", "Sentry (TanStack Start React)", "Клиентские + server-function exceptions, release/environment, source maps, performance samples. Redact auth headers, query/body и student PII; сначала включить только ошибки и health."],
            ["Сейчас", "PostHog Product Analytics", "Только ручные события: course_started, lesson_started/completed, block_completed, homework_submitted/reviewed, final_quiz_started/passed/failed, course_completed. Воронка enrol/start → уроки 1–13 → итоговый тест → course complete."],
            ["Сейчас", "Uptime / synthetic checks + существующие Supabase/Cloudflare dashboards", "Проверять landing/auth/admin-login публично, отдельным тестовым аккаунтом — вход и чтение урока. Алерты на availability/error rate, но не выводить персональные ответы/контент."],
            ["Сейчас", "Структурированные logs", "Добавить request/correlation id, route/function, duration_ms, status/error class; редактировать email, JWT, пароль, файлы и ДЗ. Хранить ограниченный retention."],
            ["Позже / рост", "OpenTelemetry + Grafana Cloud/Prometheus", "Когда понадобится корреляция frontend/API/DB, SLO и p95/p99; не строить self-hosted Grafana stack на текущем масштабе без эксплуатационной причины."],
            ["Позже", "AI-помощник курса", "Только после аналитики и privacy review: ответы по утверждённым материалам, явные границы, контроль стоимости, feedback/evaluation set; не передавать стороннему LLM профили, ответы теста и тексты ДЗ."],
        ],
        [29 * mm, 53 * mm, 179 * mm],
    ),
    Spacer(1, 5 * mm),
    P("Метрики обучения, которые стоит определить до установки SDK", "H2RU"),
    P("• Воронка: первый вход → старт урока → завершение 1–13 → старт теста → pass → завершение курса.<br/>• Drop-off по уроку и блоку: started/completed events с lesson_id, block_id/type и course cohort; сравнивать когорты, не людей.<br/>• Время урока: elapsed time между стартом/завершением с учётом visibility/idle; считать диагностической метрикой, а не рейтингом ученика.<br/>• Сложные вопросы: агрегировать частоту неверных ответов по question_id/topic, не экспортируя конкретный ответ.<br/>• Retention: возвращение по неделе когорты; сначала определить, что означает «активный» пользователь для 14-дневного курса.", "BodyRU"),
    P("У PostHog есть встроенные funnels и retention insights; OpenTelemetry задаёт переносимую модель traces/metrics/logs. Supabase DB backups не включают сами Storage objects — план восстановления должен охватывать оба контура.", "BodyRU"),
    PageBreak(),
    P("Источники и следующие действия", "H1RU"),
    P("Ссылки ниже использованы для проверки рекомендаций и advisory remediation. Архитектурные выводы и результаты проекта основаны на репозитории и live read-only проверках.", "BodyRU"),
    P("• Supabase Security Advisor: <link href='https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable' color='#3C43F5'>SECURITY DEFINER advisory</link><br/>• Supabase password security: <link href='https://supabase.com/docs/guides/auth/password-security' color='#3C43F5'>leaked-password protection</link><br/>• Supabase backups: <link href='https://supabase.com/docs/guides/platform/backups' color='#3C43F5'>database backups and PITR</link><br/>• PostHog: <link href='https://posthog.com/docs/product-analytics/funnels' color='#3C43F5'>funnels</link> и <link href='https://posthog.com/docs/product-analytics/retention' color='#3C43F5'>retention</link><br/>• TanStack Start observability: <link href='https://tanstack.com/start/latest/docs/framework/react/guide/observability' color='#3C43F5'>Sentry/structured logging patterns</link><br/>• OpenTelemetry: <link href='https://opentelemetry.io/docs/concepts/signals/' color='#3C43F5'>signals — traces, metrics, logs</link><br/>• Sentry TanStack Start: <link href='https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/tracing/span-metrics/performance-metrics/' color='#3C43F5'>performance/span metrics</link>", "BodyRU"),
    Spacer(1, 6 * mm),
    P("Что зафиксировано в рабочей копии", "H2RU"),
    P("Добавлен автотест-контракт <b>autotests/unit/test_progress_access_policy.py</b>, который краснеет на текущих разрешениях. Для flaky mobile homepage smoke добавлен одиночный повтор навигации. Новая failing проверка намеренно не помечена skip/xfail: она должна оставаться видимой до исправления политик. Код не коммитился и не публиковался.", "BodyRU"),
    P("Критичный следующий шаг: ограничить клиентские записи lesson_progress, затем прогнать полный regression повторно в disposable/staging среде и проверить RLS матрицу. Только после этого имеет смысл финализировать go/no-go.", "H1RU"),
]

doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=landscape(A4),
    rightMargin=14 * mm, leftMargin=14 * mm,
    topMargin=13 * mm, bottomMargin=18 * mm,
    title="QA Start — предрелизный QA-аудит",
    author="OpenAI Codex",
    subject="Регресс, безопасность, производительность и рекомендации",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
