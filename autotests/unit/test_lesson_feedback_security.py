from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = next((ROOT / "supabase/migrations").glob("*_lesson_feedback_system.sql")).read_text(
    encoding="utf-8"
)
SERVER = (ROOT / "src/server/lesson-feedback.functions.ts").read_text(encoding="utf-8")
LESSON_ACCESS = (ROOT / "src/server/lesson-access.functions.ts").read_text(encoding="utf-8")
FINAL_QUIZ = (ROOT / "src/server/final-quiz.functions.ts").read_text(encoding="utf-8")
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


def test_completion_endpoints_gate_regular_and_final_lesson_on_feedback():
    assert 'from("lesson_feedback")' in LESSON_ACCESS
    assert "feedbackRequired && !submittedFeedback" in LESSON_ACCESS
    assert 'from("lesson_feedback")' in FINAL_QUIZ
    assert "if (!feedbackRequired || submittedFeedback || skippedFeedback)" in FINAL_QUIZ


def test_certificate_issuance_waits_for_required_feedback():
    certificates = (ROOT / "src/server/certificates.server.ts").read_text(encoding="utf-8")
    assert 'from("lesson_feedback")' in certificates
    assert 'from("lesson_feedback_skips")' in certificates
    assert "if (requiredFeedbackMissing) return null" in certificates


def test_feedback_skip_is_opt_in_by_group_and_not_writable_from_student_client():
    assert "allow_feedback_skip boolean not null default false" in SKIP_MIGRATION
    assert "alter table public.lesson_feedback_skips enable row level security" in SKIP_MIGRATION
    assert "revoke all on public.lesson_feedback_skips from public, anon, authenticated" in SKIP_MIGRATION
    assert 'from("group_students")' in SERVER
    assert 'from("student_groups")' in SERVER
    assert "group.allow_feedback_skip === true" in SERVER
    assert 'from("lesson_feedback_skips")' in SERVER
    assert "validateLessonRequirements(userId, lesson.id, lessonBlocks)" in SERVER
    assert 'data?.status === "approved"' in SERVER
    admin_page = (ROOT / "src/routes/admin.feedback.tsx").read_text(encoding="utf-8")
    assert "Пропуск опроса по группам" in admin_page
    assert "Разрешить пропуск опроса группе" in admin_page


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
