from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260919000000_interactive_lesson_blocks.sql"
RENDERER = ROOT / "src/components/interactive-lesson.tsx"
ADMIN = ROOT / "src/routes/admin.lessons.tsx"


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


def test_student_question_supports_feedback_and_retry():
    source = RENDERER.read_text(encoding="utf-8")

    assert "function QuestionBlock" in source
    assert "Верно!" in source
    assert "Попробуйте ещё раз." in source
    assert "Попробовать ещё раз" in source


def test_admin_builder_exposes_all_block_types_and_order_controls():
    source = ADMIN.read_text(encoding="utf-8")

    assert "lessonBlockTypes.map" in source
    assert "createLessonBlock(type)" in source
    assert "onUp" in source and "onDown" in source and "onDelete" in source
    assert 'from("lesson_blocks").delete()' in source
