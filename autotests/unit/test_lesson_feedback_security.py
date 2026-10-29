from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = next((ROOT / "supabase/migrations").glob("*_lesson_feedback_system.sql")).read_text(
    encoding="utf-8"
)
SERVER = (ROOT / "src/server/lesson-feedback.functions.ts").read_text(encoding="utf-8")
LESSON_ACCESS = (ROOT / "src/server/lesson-access.functions.ts").read_text(encoding="utf-8")
LESSON_CONTENT = (ROOT / "src/server/lesson-content.functions.ts").read_text(encoding="utf-8")
FINAL_QUIZ = (ROOT / "src/server/final-quiz.functions.ts").read_text(encoding="utf-8")
CERTIFICATES = (ROOT / "src/server/certificates.server.ts").read_text(encoding="utf-8")
HOMEWORK = (ROOT / "src/server/homework.functions.ts").read_text(encoding="utf-8")
LESSON_PAGE = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
ANALYTICS = (ROOT / "src/server/analytics.functions.ts").read_text(encoding="utf-8")
FEEDBACK_POLICY = (ROOT / "src/server/lesson-feedback-policy.server.ts").read_text(encoding="utf-8")
STUDENT_DASHBOARD = (ROOT / "src/server/dashboard.functions.ts").read_text(encoding="utf-8")
QUESTION_ANSWERS = (ROOT / "src/server/lesson-question-answers.functions.ts").read_text(encoding="utf-8")
SKIP_MIGRATION = next((ROOT / "supabase/migrations").glob("*_feedback_group_skip.sql")).read_text(
    encoding="utf-8"
)
ANALYTICS_SERVER = (ROOT / "src/server/analytics.functions.ts").read_text(encoding="utf-8")


def test_feedback_storage_has_rls_unique_pair_and_no_direct_student_insert():
    assert "unique (user_id, lesson_id)" in MIGRATION
    assert "alter table public.lesson_feedback enable row level security" in MIGRATION
    assert 'using ((select auth.uid()) = user_id' in MIGRATION
    assert "grant select on public.lesson_feedback to authenticated" in MIGRATION
    assert "grant insert on public.lesson_feedback to authenticated" not in MIGRATION
    assert "on public.lesson_feedback for insert to authenticated" not in MIGRATION


def test_submission_uses_verified_token_identity_and_server_checks_lesson_prerequisites():
    assert "const userId = await getUserIdForAccessToken(data.accessToken)" in SERVER
    assert "user_id: userId" in SERVER
    assert "validateLessonRequirements(userId, lesson.id, lessonBlocks)" in SERVER
    assert 'eq("status", "approved")' not in SERVER
    assert '.order("created_at", { ascending: false })' in SERVER


def test_feedback_gates_zero_cohort_completion_and_human_homework_still_does():
    assert 'from("lesson_feedback")' in LESSON_ACCESS
    assert "feedbackPending: true" in LESSON_ACCESS
    assert "isFeedbackRequiredForStudent(userId, lesson.id)" in LESSON_ACCESS
    assert 'from("lesson_feedback")' not in FINAL_QUIZ
    assert 'from("lesson_feedback")' not in CERTIFICATES
    assert "homeworkPending: true" in LESSON_ACCESS
    assert 'eq("status", "approved")' not in LESSON_ACCESS
    assert "latestSubmission?.status !== \"approved\"" in LESSON_ACCESS
    assert ".from(\"lesson_progress\").upsert(" in FINAL_QUIZ
    assert "getStudentSequenceLock(userId, lesson.day_number)" in LESSON_CONTENT
    assert "availableDay" in STUDENT_DASHBOARD
    assert "group.lesson_feedback_required" in FEEDBACK_POLICY
    assert "group.course_feedback_required" in FEEDBACK_POLICY
    assert "Membership only selects a cohort policy" in FEEDBACK_POLICY


def test_homework_status_refresh_is_scoped_to_authenticated_student_and_lesson():
    status_handler = HOMEWORK.split("export const getStudentHomeworkStatus", 1)[1].split(
        "export const listHomeworkMessages", 1
    )[0]
    assert "getUserIdForAccessToken(data.accessToken)" in status_handler
    assert 'eq("user_id", userId)' in status_handler
    assert 'eq("lesson_id", data.lessonId)' in status_handler
    assert "assertLessonScheduleAccess(userId, lesson.day_number)" in status_handler


def test_feedback_submission_and_skip_do_not_write_course_progress():
    submit_handler = SERVER.split("export const submitLessonFeedback", 1)[1].split(
        "export const skipLessonFeedback", 1
    )[0]
    skip_handler = SERVER.split("export const skipLessonFeedback", 1)[1].split(
        "export const getAdminFeedbackData", 1
    )[0]
    assert 'from("lesson_progress")' not in submit_handler
    assert 'from("lesson_progress")' not in skip_handler
    assert "progress: progress ?? []" in STUDENT_DASHBOARD
    assert "effectiveProgress" not in ANALYTICS
    assert "progress,\n        blockProgress:" in ANALYTICS


def test_student_sees_completion_before_feedback_and_archie_remains_available():
    completion = LESSON_PAGE.index("{completionCardVisible && (")
    feedback = LESSON_PAGE.index("{feedbackEnabled &&", completion)
    assert completion < feedback
    assert "feedbackAvailable &&" in LESSON_PAGE
    assert "completed || feedbackRequired" in LESSON_PAGE
    assert "getStudentHomeworkStatus" in LESSON_PAGE
    assert "!(feedbackRequired && feedbackAvailable && !feedbackSubmitted)" not in LESSON_PAGE
    assert "if (feedbackRequired && !completed) await completeLesson();" in LESSON_PAGE


def test_certificate_issuance_does_not_wait_for_feedback():
    assert 'from("lesson_feedback")' not in CERTIFICATES
    assert 'from("lesson_feedback_skips")' not in CERTIFICATES


def test_feedback_skip_is_opt_in_by_group_and_not_writable_from_student_client():
    assert "allow_feedback_skip boolean not null default false" in SKIP_MIGRATION
    assert "alter table public.lesson_feedback_skips enable row level security" in SKIP_MIGRATION
    assert "revoke all on public.lesson_feedback_skips from public, anon, authenticated" in SKIP_MIGRATION
    assert 'from("group_students")' in FEEDBACK_POLICY
    assert 'from("student_groups")' in FEEDBACK_POLICY
    assert "group.allow_feedback_skip" in FEEDBACK_POLICY
    assert 'from("lesson_feedback_skips")' in SERVER
    assert "validateLessonRequirements(userId, lesson.id, lessonBlocks)" in SERVER
    assert 'data?.status === "approved"' in SERVER
    admin_page = (ROOT / "src/routes/admin.feedback.tsx").read_text(encoding="utf-8")
    assert "Настройки созданных потоков" in admin_page
    assert "Разрешить пропуск опроса группе" in admin_page


def test_course_survey_policy_is_per_cohort_and_submission_is_server_gated():
    migration = next((ROOT / "supabase/migrations").glob("*_cohort_feedback_policy_and_course_survey.sql")).read_text(
        encoding="utf-8"
    )
    course_server = (ROOT / "src/server/course-feedback.functions.ts").read_text(encoding="utf-8")
    assert "course_feedback_required boolean not null default false" in migration
    assert "course_feedback_required_by_default boolean not null default true" in migration
    assert "revoke all on public.course_feedback_templates, public.course_feedback from public, anon, authenticated" in migration
    assert 'from("course_feedback")' in course_server
    assert 'getUserIdForAccessToken(data.accessToken)' in course_server
    assert "hasPassedFinalQuiz(userId)" in course_server
    assert "validateQuestionAnswers(questions, data.answers)" in course_server
    assert "unique references auth.users(id)" in migration


def test_student_feedback_page_uses_star_rating_and_only_shows_configured_skip_action():
    page = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    assert "<Star" in page
    assert "{score}" in page
    assert "min-h-16" in page
    assert "h-10 w-10" in page
    assert "text-xs font-bold leading-none" in page
    assert "1 означает «совсем не понравилось»" in page
    assert "10" in page and "означает «очень понравилось»" in page
    assert "Звёздочка (*) рядом с вопросом означает, что ответ обязателен." in page
    assert "feedbackSkipAllowed &&" in page
    assert "Пропустить опрос" in page


def test_admin_analytics_export_is_admin_only_and_includes_feedback_details():
    assert 'if (!roles.includes("admin")) throw new Error("Недостаточно прав")' in ANALYTICS_SERVER
    assert 'from("lesson_feedback")' in ANALYTICS_SERVER
    assert '"user_id,lesson_id,answers,rating,difficulty,comment,created_at,updated_at"' in ANALYTICS_SERVER
    assert 'from("lesson_feedback_skips")' in ANALYTICS_SERVER
    page = (ROOT / "src/routes/admin.analytics.tsx").read_text(encoding="utf-8")
    assert "buildAnalyticsExport(analytics)" in page
    assert "Скачать JSON" in page


def test_saved_incorrect_question_answer_can_retry_progress_without_database_update():
    assert "if (existingAnswer) {" in QUESTION_ANSWERS
    assert "return { saved: true, isCorrect: answer.isCorrect };" in QUESTION_ANSWERS
    assert '.from("lesson_question_answers")\n        .update(' not in QUESTION_ANSWERS
    assert "if (savedAnswer) return { saved: true, isCorrect: answer.isCorrect };" in QUESTION_ANSWERS
