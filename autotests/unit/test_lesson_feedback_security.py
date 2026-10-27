from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = next((ROOT / "supabase/migrations").glob("*_lesson_feedback_system.sql")).read_text(
    encoding="utf-8"
)
SERVER = (ROOT / "src/server/lesson-feedback.functions.ts").read_text(encoding="utf-8")
LESSON_ACCESS = (ROOT / "src/server/lesson-access.functions.ts").read_text(encoding="utf-8")
FINAL_QUIZ = (ROOT / "src/server/final-quiz.functions.ts").read_text(encoding="utf-8")
QUESTION_ANSWERS = (ROOT / "src/server/lesson-question-answers.functions.ts").read_text(encoding="utf-8")


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
    assert "if (!feedbackRequired || submittedFeedback)" in FINAL_QUIZ


def test_certificate_issuance_waits_for_required_feedback():
    certificates = (ROOT / "src/server/certificates.server.ts").read_text(encoding="utf-8")
    assert 'from("lesson_feedback")' in certificates
    assert "if (requiredFeedbackMissing) return null" in certificates


def test_saved_incorrect_question_answer_can_retry_progress_without_database_update():
    assert "if (existingAnswer) {" in QUESTION_ANSWERS
    assert "return { saved: true, isCorrect: answer.isCorrect };" in QUESTION_ANSWERS
    assert '.from("lesson_question_answers")\n        .update(' not in QUESTION_ANSWERS
    assert "if (savedAnswer) return { saved: true, isCorrect: answer.isCorrect };" in QUESTION_ANSWERS
