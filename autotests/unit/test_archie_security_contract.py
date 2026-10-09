from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_student_ai_endpoint_rechecks_server_mode_before_using_chat_history_or_ai():
    source = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    endpoint = source.split("export const askArchie =", 1)[1].split(
        "export const getArchieAdminData =", 1
    )[0]

    mode_guard = endpoint.index('if (studentContext.mode !== "chat")')
    history_read = endpoint.index("data.history.slice")
    ai_call = endpoint.index("generateAIAnswer({")

    assert mode_guard < history_read < ai_call
    assert "loadArchieStudentContext(userId, data.lessonId)" in endpoint
    assert "throw new Error(lockedMessage)" in endpoint


def test_archie_mode_is_derived_from_persisted_submission_and_assessment_progress():
    source = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")

    for required in (
        '.from("homework_submissions")',
        '.from("lesson_block_progress")',
        '.from("sql_sandbox_attempts")',
        "homeworkStatus: latestSubmission?.status ?? null",
        "passedSqlTaskIds",
        "getArchieLessonMode({",
    ):
        assert required in source


def test_motivation_messages_are_configured_in_existing_archie_admin_panel():
    panel = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")
    schema = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")

    assert "ARCHIE_MOTIVATION_MESSAGE_CATEGORIES.map" in panel
    assert "motivationMessages: form.motivationMessages" in panel
    assert "z.enum(ARCHIE_MOTIVATION_MESSAGE_CATEGORIES)" in schema


def test_archie_motivation_admin_section_can_be_collapsed_and_remembers_preference():
    panel = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")

    assert "qastart:admin-archie:v1:" in panel
    assert ":${userId}:${section}" in panel
    assert '"motivation"' in panel
    assert 'window.localStorage.getItem(preferenceKey) !== "false"' in panel
    assert "window.localStorage.setItem(preferenceKey, String(expanded))" in panel
    assert 'aria-controls={motivationContentId}' in panel
    assert "hidden={!motivationExpanded}" in panel


def test_archie_main_settings_and_provider_sections_remember_collapsed_state():
    panel = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")

    assert '"main-settings"' in panel
    assert '"provider"' in panel
    assert "setMainSettingsExpanded" in panel
    assert "setProviderExpanded" in panel
    assert "блок: основные настройки" in panel
    assert "блок: AI-провайдер" in panel
    assert "hidden={!mainSettingsExpanded}" in panel
    assert "hidden={!providerExpanded}" in panel


def test_archie_main_settings_have_an_independent_save_action():
    panel = (ROOT / "src/components/admin-archie-panel.tsx").read_text(encoding="utf-8")
    server = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    main_endpoint = server.split("export const updateArchieMainSettings =", 1)[1].split(
        "async function getProviderKey", 1
    )[0]

    assert "updateArchieMainSettings" in panel
    assert "saveMainSettings" in panel
    assert "Сохранить основные настройки" in panel
    assert "Сохранить настройки провайдера" in panel
    assert "system_prompt: data.systemPrompt" in main_endpoint
    assert "motivation_messages: normalizeArchieMotivationMessages(data.motivationMessages)" in main_endpoint
    assert "provider:" not in main_endpoint
    assert "apiKey" not in main_endpoint


def test_completed_lessons_still_mount_archie_for_pending_one_time_achievements():
    route = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    render_gate = route.split("<ArchieChat", 1)[0].rsplit("{!isAdmin", 1)[-1]

    assert "!completed" not in render_gate
    assert "studentId={user.id}" in route
    assert "lessonCompleted={completed}" in route


def test_completed_archie_waits_for_server_state_before_rendering_and_uses_nonempty_copy():
    component = (ROOT / "src/components/archie-chat.tsx").read_text(encoding="utf-8")

    assert "lessonCompleted && !initialized" in component
    assert "currentMotivation?.message?.trim()" in component
    assert "DEFAULT_ARCHIE_GREETING_MESSAGES[0]" in component
    assert 'config.mode === "checked-exercise"' in component
    assert "config.motivationMessages.checkedExercise[0]" in component


def test_archie_does_not_show_fallback_greeting_before_lesson_config_loads():
    component = (ROOT / "src/components/archie-chat.tsx").read_text(encoding="utf-8")

    assert "const [greetingVisible, setGreetingVisible] = useState(false)" in component
    assert "const [greetingReady, setGreetingReady] = useState(false)" in component
    floating_greeting = component.split('data-testid="archie-floating-greeting"', 1)[0]
    assert "greetingReady &&" in floating_greeting
    assert 'mode === "chat" || mode === "checked-exercise"' in floating_greeting
    assert "setGreetingReady(true)" in component


def test_archie_sends_only_one_priority_message_for_completed_lesson_or_course():
    source = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    builder = source.split("function buildArchieMotivationEvents(", 1)[1].split(
        "function hasEncryptionKey()", 1
    )[0]

    course_branch = builder.split("if (context.courseCompleted && context.finalLesson)", 1)[1]
    course_branch = course_branch.split("return events;", 1)[0]
    assert '"courseComplete"' in course_branch
    assert '"halfCourse"' not in course_branch

    completion_branch = builder.split("if (context.lessonCompleted)", 1)[1]
    completion_branch = completion_branch.split("if (context.mode === \"homework\")", 1)[0]
    assert 'category: "lessonComplete"' in completion_branch
    assert "return events;" in completion_branch
    assert '"midLesson"' not in completion_branch
    assert '"exerciseComplete"' not in completion_branch
