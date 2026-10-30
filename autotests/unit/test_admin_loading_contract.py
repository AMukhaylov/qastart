from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_feedback_initial_load_is_not_repeated_when_first_lesson_is_selected():
    page = (ROOT / "src/routes/admin.feedback.tsx").read_text(encoding="utf-8")

    # This server function reads settings, templates, every feedback response,
    # profiles, groups, and course surveys. Selecting the initial lesson must
    # derive editor state from that result instead of issuing all reads again.
    assert page.count("getAdminFeedbackData(") == 1
    assert "feedbackSettings.find((item) => item.lesson_id === lessonId)" in page
    assert "setQuestions(usesCommon ? commonTemplate" in page


def test_students_page_explains_empty_table_while_overview_is_loading():
    page = (ROOT / "src/routes/admin.students.tsx").read_text(encoding="utf-8")

    assert 'loading && !loadError && rows.length === 0' in page
    assert 'role="status"' in page
    assert "Загружаем список учеников и их прогресс…" in page
