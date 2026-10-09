from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260919000000_interactive_lesson_blocks.sql"
DAY_ONE_UPDATE = ROOT / "supabase/legacy-migrations/20260920090000_day1_video_and_check_quiz.sql"
ASSESSMENT_FORMAT = ROOT / "supabase/legacy-migrations/20260920100000_course_assessment_format.sql"
INTERACTIVE_LESSONS = ROOT / "supabase/legacy-migrations/20260920110000_seed_interactive_lessons_2_to_13.sql"
EXPANDED_LESSONS = ROOT / "supabase/legacy-migrations/20260920120000_expand_interactive_lessons_2_and_3.sql"
DAY_THREE_ORDER = ROOT / "supabase/legacy-migrations/20260920130000_reorder_day3_question_after_material.sql"
DAY_TWO_REBUILD = ROOT / "supabase/migrations/20260921204851_rebuild_day_two_team_lesson.sql"
RESET_PROGRESS = ROOT / "supabase/migrations/20260925063647_reset_all_account_progress.sql"
RENDERER = ROOT / "src/components/interactive-lesson.tsx"
LESSON_PAGE = ROOT / "src/routes/lessons.$day.tsx"
ADMIN = ROOT / "src/routes/admin.lessons.tsx"
GUIDE = ROOT / "src/components/lesson-guide.tsx"
DASHBOARD = ROOT / "src/routes/dashboard.tsx"
ADMIN_HOMEWORK = ROOT / "src/routes/admin.homework.tsx"
HOMEWORK_FUNCTIONS = ROOT / "src/server/homework.functions.ts"
SQL_SANDBOX_MIGRATION = ROOT / "supabase/migrations/20260930163256_sql_sandbox_attempts.sql"


def test_interactive_lesson_migration_has_all_mvp_block_types_and_rls():
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "create table if not exists public.lesson_blocks" in sql
    assert "create table if not exists public.lesson_block_progress" in sql
    assert "enable row level security" in sql
    for block_type in (
        "heading",
        "text",
        "definition",
        "important",
        "example",
        "diagram",
        "image",
        "video",
        "question",
        "code",
        "summary",
        "homework",
    ):
        assert f"'{block_type}'" in sql


def test_day_one_is_seeded_with_interactive_content_and_mini_quiz():
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "where lesson.day_number = 1" in sql
    assert "Добро пожаловать в QA Start" in sql
    assert sql.count("('question'") >= 5
    assert "Главное из урока" in sql
    assert "Домашнее задание" in sql


def test_student_question_shows_feedback_without_a_redundant_continue_button():
    source = RENDERER.read_text(encoding="utf-8")

    assert "function QuestionBlock" in source
    assert "Верно!" in source
    assert "Посмотри разбор ответа." in source
    assert "Продолжить урок" not in source


def test_lesson_steps_unlock_in_order_and_progress_is_saved_automatically():
    renderer = RENDERER.read_text(encoding="utf-8")
    page = LESSON_PAGE.read_text(encoding="utf-8")

    assert "createSteps" in renderer
    assert "steps.slice(0, visibleThrough + 1)" in renderer
    assert "onBlocksCompleted" in renderer
    assert "Я посмотрел видео — продолжить" in renderer
    assert "markBlocksCompleted" in page
    assert ".filter(isBlockRequired)" in page
    assert "Завершить урок" not in page


def test_state_diagram_editor_and_canvas_are_loaded_on_demand():
    renderer = RENDERER.read_text(encoding="utf-8")
    admin = ADMIN.read_text(encoding="utf-8")

    assert 'import("@/components/state-diagram")' in renderer
    assert 'import("@/components/state-diagram")' in admin
    assert 'from "@/components/state-diagram"' not in renderer
    assert 'from "@/components/state-diagram"' not in admin


def test_blocks_have_configurable_completion_rules_and_lesson_has_a_guide():
    renderer = RENDERER.read_text(encoding="utf-8")
    page = LESSON_PAGE.read_text(encoding="utf-8")
    admin = ADMIN.read_text(encoding="utf-8")
    guide = GUIDE.read_text(encoding="utf-8")

    assert "isBlockRequired" in renderer
    assert "blocksNext" in renderer
    assert "homeworkRequiredForCompletion" in admin
    assert "completionCondition" in admin
    assert "requiredBlocks" in page
    # Финальная карточка после ДЗ настраивается в редакторе, поэтому вариант
    # персонажа передаётся из данных блока, а не фиксируется как success.
    assert "completionVariant" in page
    assert "variant={displayedCompletionVariant}" in page
    assert "LessonGuide" in guide
    assert 'backgroundSize: variant === "pending" ? "cover" : "300% 200%"' in guide


def test_homework_and_guide_are_independent_sortable_blocks():
    lesson = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    interactive = (ROOT / "src/components/interactive-lesson.tsx").read_text(encoding="utf-8")
    admin = (ROOT / "src/routes/admin.lessons.tsx").read_text(encoding="utf-8")
    migration = (ROOT / "supabase/migrations/20260924145420_split_homework_guide_blocks.sql").read_text(
        encoding="utf-8"
    )

    assert "renderHomework" in interactive
    assert "renderHomework={(block)" in lesson
    assert "legacyHomeworkGuide" in migration
    assert "Вводная плашка проводника — отдельный блок" in admin
    assert "guideTitle" not in admin


def test_admin_builder_exposes_all_block_types_and_order_controls():
    source = ADMIN.read_text(encoding="utf-8")

    assert "lessonBlockTypes" in source
    assert ".filter((type) => type !== \"final_quiz\" || lessonDay === 14)" in source
    assert ".map((type) => (" in source
    assert "createLessonBlock(type)" in source
    assert "onUp" in source and "onDown" in source and "onDelete" in source
    assert "onDelete={() => setBlocks((all) => all.filter" in source
    assert 'value={positionValue}' in source
    assert 'setPositionValue(String(index + 1))' in source
    assert 'const lineList = (label: string, key: string' in source
    assert 'value={stringList(c, key).join("\\n")}' in source
    assert 'e.target.value.split(/\\r?\\n/)' in source
    assert 'event.key !== "Enter"' in source
    assert 'event.preventDefault()' in source


def test_video_block_description_is_editable_in_admin():
    source = ADMIN.read_text(encoding="utf-8")

    assert 'simple("Описание", "description", true)' in source


def test_example_section_titles_are_free_text_and_have_fallbacks():
    admin = ADMIN.read_text(encoding="utf-8")
    interactive = (ROOT / "src/components/interactive-lesson.tsx").read_text(encoding="utf-8")
    package = (ROOT / "src/lib/lesson-package.ts").read_text(encoding="utf-8")

    assert 'simple("Заголовок первой секции", "expectedTitle")' in admin
    assert 'simple("Заголовок второй секции", "actualTitle")' in admin
    assert 'simple("Заголовок третьей секции", "conclusionTitle")' in admin
    assert 'simple("Описание первой секции", "expected", true)' in admin
    assert 'simple("Описание второй секции", "actual", true)' in admin
    assert 'simple("Описание третьей секции", "conclusion", true)' in admin
    assert 'stringValue(c, "expectedTitle", "Ожидание")' in interactive
    assert 'stringValue(c, "actualTitle", "Фактический результат")' in interactive
    assert 'stringValue(c, "conclusionTitle", "Вывод")' in interactive
    assert 'name: "expectedTitle"' in package
    assert 'name: "actualTitle"' in package
    assert 'name: "conclusionTitle"' in package


def test_important_thought_renders_markdown_content():
    source = (ROOT / "src/components/interactive-lesson.tsx").read_text(encoding="utf-8")

    assert 'case "important"' in source
    assert '<LessonRichContent content={stringValue(c, "text")} />' in source


def test_homework_instruction_renders_markdown_in_preview_and_lesson():
    interactive = (ROOT / "src/components/interactive-lesson.tsx").read_text(encoding="utf-8")
    lesson = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")

    assert '<LessonRichContent content={stringValue(c, "instruction")} />' in interactive
    assert '<LessonRichContent content={instruction} />' in lesson


def test_sql_sandbox_attempts_are_owner_scoped_and_user_sql_is_only_saved_as_data():
    migration = SQL_SANDBOX_MIGRATION.read_text(encoding="utf-8")
    lockdown = next((ROOT / "supabase/migrations").glob("*_secure_student_assessment_progress.sql"))
    lockdown_sql = lockdown.read_text(encoding="utf-8").lower()
    worker = (ROOT / "src/lib/sql-sandbox.worker.ts").read_text(encoding="utf-8")
    lesson = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    server_action = (ROOT / "src/server/sql-sandbox-assessment.functions.ts").read_text(encoding="utf-8")
    student_ui = (ROOT / "src/components/sql-sandbox-homework.tsx").read_text(encoding="utf-8")
    admin_ui = (ROOT / "src/components/admin-sql-sandbox-editor.tsx").read_text(encoding="utf-8")

    assert "enable row level security" in migration.lower()
    assert "revoke all on public.sql_sandbox_attempts from public, anon" in migration.lower()
    assert "(select auth.uid()) = user_id" in migration
    assert "grant select, insert, update on public.sql_sandbox_attempts to authenticated" in migration.lower()
    assert "revoke insert, update, delete on public.sql_sandbox_attempts from public, anon, authenticated" in lockdown_sql
    assert "seedSandboxDatabase(database, config.tables)" in worker
    assert "runSandboxTask(database, sql, task, config)" in worker
    assert '.from("sql_sandbox_attempts")' not in lesson
    assert "submitSqlSandboxAttempt" in lesson
    assert "evaluateSqlTask(config, task, data.query)" in server_action
    assert "passed: result.passed" in server_action
    assert "onAttemptSaved\n        ? await onAttemptSaved(task.id, query)" in student_ui
    assert "database.exec(sql)" not in worker
    assert "Проверочный SQL (только для наставника/админа" in admin_ui
    assert "Ученику этот запрос не показывается" in admin_ui
    assert "verificationQuery" not in student_ui


def test_lesson_preview_preserves_scroll_position_per_lesson():
    source = (ROOT / "src/routes/admin.lessons.tsx").read_text(encoding="utf-8")
    interactive = (ROOT / "src/components/interactive-lesson.tsx").read_text(encoding="utf-8")

    assert "usePreviewScrollPosition" in source
    assert 'activeId ? `lesson:${activeId}` : null' in source
    assert 'preview ? `import:${preview.previewId}` : null' in source
    assert "lastScrollTopRef.current = event.currentTarget.scrollTop" in source
    assert 'document.addEventListener("visibilitychange", restore)' in source
    assert 'window.addEventListener("focus", restore)' in source
    assert "if (previewMode) return;" in interactive


def test_lesson_header_reuses_notification_bell_and_hides_it_during_final_quiz():
    source = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")

    assert 'import { NotificationBell } from "@/components/notification-bell";' in source
    assert "<NotificationBell />" in source
    assert "lesson.day_number === 14 && finalQuizActive" in source


def test_day_one_update_reserves_video_and_removes_homework_block():
    sql = DAY_ONE_UPDATE.read_text(encoding="utf-8")

    assert "Приветствие Артура" in sql
    assert "Проверочный тест" in sql
    assert "and block_type = 'homework'" in sql


def test_course_assessment_format_keeps_homework_only_for_selected_practice_days():
    sql = ASSESSMENT_FORMAT.read_text(encoding="utf-8")

    assert "Приветствие Артура" in sql
    assert "position = 4" in sql
    assert "not in (3, 4, 5, 6, 8, 10, 11, 13)" in sql


def test_remaining_teaching_days_have_interactive_blocks_and_no_extra_videos():
    sql = INTERACTIVE_LESSONS.read_text(encoding="utf-8")

    for day in range(2, 14):
        assert f"({day}, 'heading', 0" in sql
    assert sql.count("'homework'") == 8
    assert sql.count("Проверочный тест") == 4
    assert "'video'" not in sql


def test_days_two_and_three_have_expanded_interactive_material():
    sql = EXPANDED_LESSONS.read_text(encoding="utf-8")

    assert "Кто за что отвечает" in sql
    assert "Структура тест-кейса" in sql
    assert sql.count("'question'") >= 3
    assert "'video'" not in sql


def test_day_two_tells_one_connected_story_about_a_team_task():
    sql = DAY_TWO_REBUILD.read_text(encoding="utf-8")

    assert "Как работает IT-команда" in sql
    assert "В сервисе доставки" in sql
    assert "Почему QA подключается ещё до готовой функции" in sql
    assert "После разработки задача не заканчивается" in sql
    assert sql.count('"blocksNext":true') == 4
    assert "Главное из урока" in sql
    assert "questionType\":\"multiple_choice" in sql


def test_day_three_question_follows_the_test_case_explanation():
    sql = DAY_THREE_ORDER.read_text(encoding="utf-8")

    assert "Что обычно содержит тест-кейс?" in sql
    assert "position = 9" in sql


def test_dashboard_distinguishes_homework_waiting_from_completed_lessons():
    source = DASHBOARD.read_text(encoding="utf-8")

    assert "homeworkStatusByLessonId" in source
    assert 'submission.status === "approved"' in source
    assert 'submission.status === "rejected"' in source
    assert '"pending"' in source
    assert "Clock3" in source
    assert "ДЗ на проверке" in source
    assert "ДЗ на доработке" in source
    assert "RotateCcw" in source
    assert 'text-amber-500' in source
    assert "ДЗ принято" in source
    assert "Урок доступен" in source
    assert 'className="inline-flex text-primary' in source
    assert "Урок пока недоступен" in source
    assert "TooltipContent" in source


def test_dashboard_does_not_render_redundant_course_conditions_card():
    source = DASHBOARD.read_text(encoding="utf-8")

    assert "Условия курса" not in source


def test_archie_is_a_compact_floating_lesson_widget_on_all_screen_sizes():
    lesson = LESSON_PAGE.read_text(encoding="utf-8")
    archie = (ROOT / "src/components/archie-chat.tsx").read_text(encoding="utf-8")
    server = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")

    assert "lg:grid-cols-[minmax(0,1fr)_350px]" not in lesson
    assert 'className="fixed bottom-4 right-4' in archie
    assert "max-w-[380px]" in archie
    assert "h-[min(350px,calc(100dvh-7rem))]" in archie
    assert "h-[min(500px,calc(100dvh-7rem))]" in archie
    assert 'key={`${lesson.id}:${user.id}`}' in lesson
    assert "DEFAULT_ARCHIE_GREETING_MESSAGES" in archie
    assert 'lesson.day_number === dayNum' in lesson
    assert 'studentId={user.id}' in lesson
    assert '!loading' in lesson
    assert "loadArchieStudentContext(userId, data.lessonId)" in server
    assert 'studentContext.mode !== "chat"' in server
    assert "{greetingText}" in archie
    admin = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")
    assert "config.greetingMessages" in archie
    assert "form.greetingMessages.join(\"\\n\")" in admin
    assert "greeting_messages: normalizeArchieGreetingMessages(data.greetingMessages)" in server
    assert "setGreetingVisible(true)" in archie
    assert "archie-greeting-seen" not in archie
    assert "void initialize();" in archie
    assert "Escape" in archie
    assert 'aria-controls="archie-chat-panel"' in archie
    assert "DialogContent" not in archie
    assert "ARCHIE_FACE_ASSETS[faceState]" in archie
    assert "lesson-guide-sheet" not in archie
    assert "object-cover" in archie
    assert "new Image()" in archie
    assert "decode()" in archie
    assert "setDisplayedSrc(src)" in archie
    assert "onError={() => setImageLoaded(false)}" in archie
    assert "className={`block overflow-hidden ${className}`}" in archie
    assert 'className="absolute inset-1 rounded-full ring-2 ring-white/90"' in archie
    assert 'className="relative h-10 w-10 shrink-0 rounded-full' in archie
    assert "archie-face-enter" not in archie
    assert "right-20" in archie
    assert "sm:right-[6.25rem]" in archie


def test_archie_greeting_message_is_admin_editable_and_shared_by_bubble_and_chat():
    archie = (ROOT / "src/components/archie-chat.tsx").read_text(encoding="utf-8")
    admin = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")
    server = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    migration = ROOT / "supabase/migrations/20261006180318_archie_admin_greeting_messages.sql"
    assert "Приветствия Арчи" in admin
    assert "становится первым сообщением Арчи в чате" in admin
    assert archie.count("greetingText.trim()") == 1
    assert "currentMotivation?.message?.trim()" in archie
    assert "lockedNotice ||" in archie
    assert "greetingText.trim()" in archie
    assert "{welcome}" not in archie
    assert "welcomeMessage: normalizeArchieGreetingMessages(form.greetingMessages)[0]" in admin
    assert "greetingMessages: z.array" in server
    assert "greeting_messages: normalizeArchieGreetingMessages(data.greetingMessages)" in server
    assert migration.exists()


def test_archie_switches_between_the_five_provided_face_assets():
    archie = (ROOT / "src/components/archie-chat.tsx").read_text(encoding="utf-8")
    for state in ("idle", "typing", "thinking", "responding", "error"):
        asset = ROOT / f"src/assets/archie-{state}-256.png"
        assert asset.exists()
        assert asset.stat().st_size < 100_000
        assert f'import archie{state.title()} from "@/assets/archie-{state}-256.png"' in archie
        assert f"{state}: archie{state.title()}" in archie

    assert "const faceState: ArchieFaceState = loading" in archie
    assert 'draft.trim().length > 0' in archie
    assert 'assistantMessage.error ? "error" : "responding"' in archie
    assert 'showFaceFeedback("error")' in archie
    assert "state === \"responding\" ? 2200 : 2600" in archie


def test_student_admin_load_is_batched_and_uses_student_group_indexes():
    page = (ROOT / "src/routes/admin.students.tsx").read_text(encoding="utf-8")
    server = (ROOT / "src/server/students.functions.ts").read_text(encoding="utf-8")

    assert "await listAdminStudentsOverview" in page
    assert "listAdminCertificates" not in page
    assert "listAdminFinalQuizEligibility" not in page
    assert "groupsByStudent" in page
    assert 'from("certificates")' in server
    assert 'from("final_quiz_settings" as any)' in server
    assert "quizEligibility" in server
    assert "progressByUser.get(user.id)" in server
    assert "submissionsByUser.get(user.id)" in server
    assert "sqlAttemptsByUser.get(user.id)" in server


def test_auth_roles_use_the_existing_self_read_rls_policy_before_server_fallback():
    source = (ROOT / "src/lib/auth-roles.ts").read_text(encoding="utf-8")
    policy = (ROOT / "supabase/migrations/20260526102429_add_indexes_and_rls_initplan_tuning.sql").read_text(
        encoding="utf-8"
    )

    assert 'supabase.from("user_roles").select("role").eq("user_id", userId)' in source
    assert source.index('.from("user_roles")') < source.index("return await getCurrentUserRoles(")
    assert 'using ((select auth.uid()) = user_id)' in policy


def test_lesson_loading_overlaps_schedule_and_content_reads_and_does_not_wait_for_homework_chat():
    lesson = (ROOT / "src/server/lesson-content.functions.ts").read_text(encoding="utf-8")
    page = LESSON_PAGE.read_text(encoding="utf-8")

    assert "const [access, lessonRows] = await Promise.all([" in lesson
    assert "getLessonScheduleAccess(userId, lesson.day_number)" in lesson
    assert "if (!access.allowed)" in lesson
    assert "lessonLoadRequestRef" in page
    assert "void loadMessages(currentSubmission, requestId)" in page
    assert "Не удалось получить список учеников" in (ROOT / "src/routes/admin.students.tsx").read_text(
        encoding="utf-8"
    )


def test_dashboard_uses_semantic_homework_status_colors_and_reset_migration_clears_training_state():
    source = DASHBOARD.read_text(encoding="utf-8")
    reset_sql = RESET_PROGRESS.read_text(encoding="utf-8")

    assert 'CheckCircle2 className="h-4 w-4 text-emerald-600"' in source
    assert "text-blue-600" in source
    for table in (
        "certificates",
        "quiz_attempts",
        "homework_submissions",
        "lesson_block_progress",
        "lesson_progress",
    ):
        assert f"delete from public.{table};" in reset_sql


def test_dashboard_refreshes_progress_when_returning_from_a_lesson():
    source = DASHBOARD.read_text(encoding="utf-8")

    assert "useLocation" in source
    assert 'if (location.pathname !== "/dashboard") loadedUserIdRef.current = null;' in source
    assert 'if (location.pathname !== "/dashboard") return;' in source
    assert 'value={`${homeworkCounts.submitted} / ${homeworkCounts.assigned}`}' in source
    assert "getStudentDashboardData" in source
    dashboard_server = (ROOT / "src/server/dashboard.functions.ts").read_text(encoding="utf-8")
    assert '.from("lesson_blocks")' in dashboard_server
    assert '.select("id,lesson_id,content")' in dashboard_server
    assert '.from("sql_sandbox_attempts")' in dashboard_server
    assert 'aria-label="Урок пройден"' in source
    assert "text-emerald-600" in source


def test_admin_lesson_save_does_not_delete_blocks_during_transient_load():
    source = (ROOT / "src/routes/admin.lessons.tsx").read_text(encoding="utf-8")

    assert "blocksLoadRequestRef" in source
    assert "blocksLoading" in source
    assert 'if (error) {' in source
    assert "setBlocksLoadError(true)" in source
    assert "saving || blocksLoading || !dirty" in source


def test_notifications_use_realtime_fallback_and_unlocked_sound():
    source = (ROOT / "src/components/notification-bell.tsx").read_text(encoding="utf-8")
    nginx = (ROOT / "deploy/nginx-startqa.ru").read_text(encoding="utf-8")

    assert 'event: "INSERT"' in source
    assert 'event: "UPDATE"' in source
    assert "window.setInterval(() => void refresh(), 30_000)" in source
    assert "seenNotificationIdsRef" in source
    assert "audioContextRef" in source
    assert 'proxy_set_header Upgrade $http_upgrade;' in nginx
    assert "map $http_upgrade $qastart_connection_upgrade" in nginx
    assert "proxy_set_header Connection $qastart_connection_upgrade;" in nginx


def test_lesson_page_does_not_show_redundant_homework_availability_notice():
    source = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")

    assert "Домашнее задание можно отправить после прохождения урока" not in source
    assert "Его сдача не влияет на открытие следующих уроков" not in source


def test_notifications_are_always_available_and_can_be_cleared():
    source = (ROOT / "src/components/notification-bell.tsx").read_text(encoding="utf-8")
    migration = (ROOT / "supabase/migrations/20260925073601_notifications_recipient_delete.sql").read_text(
        encoding="utf-8"
    )

    assert '.from("notifications")' in source
    assert '.delete()' in source
    assert "clearNotifications" in source
    assert "Очистить" in source
    assert "Включить уведомления" not in source
    assert "Уведомления включены" not in source
    assert "Очистить уведомления" in source
    assert 'Notification.permission === "granted"' in source
    assert 'for delete' in migration
    assert "grant delete on public.notifications to authenticated;" in migration


def test_rework_shows_only_one_student_response_form_and_admin_can_edit_own_comment():
    lesson = LESSON_PAGE.read_text(encoding="utf-8")
    admin = ADMIN_HOMEWORK.read_text(encoding="utf-8")
    server = HOMEWORK_FUNCTIONS.read_text(encoding="utf-8")

    assert "Напиши доработанный ответ..." in lesson
    assert "Нужна помощь наставника?" not in lesson
    assert "editHomeworkMessage" in admin
    assert "Редактировать комментарий" in admin
    assert "editHomeworkMessageInput" in server
    assert "Можно редактировать только собственные комментарии" in server


def test_pending_homework_uses_non_final_completion_card():
    page = LESSON_PAGE.read_text(encoding="utf-8")
    guide = (ROOT / "src/components/lesson-guide.tsx").read_text(encoding="utf-8")
    guide_model = (ROOT / "src/lib/lesson-guide.ts").read_text(encoding="utf-8")

    assert 'submission?.status === "pending"' in page
    assert '`День ${lesson.day_number} пройден`' in page
    assert "домашнее задание ждёт проверки. Следующий урок откроется по расписанию." in page
    assert 'submission?.status !== "rejected"' in page
    assert 'pending: Clock3' in guide
    assert 'pending: "center"' in guide_model
