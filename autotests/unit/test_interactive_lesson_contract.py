from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260919000000_interactive_lesson_blocks.sql"
DAY_ONE_UPDATE = ROOT / "supabase/migrations/20260920090000_day1_video_and_check_quiz.sql"
ASSESSMENT_FORMAT = ROOT / "supabase/migrations/20260920100000_course_assessment_format.sql"
INTERACTIVE_LESSONS = ROOT / "supabase/migrations/20260920110000_seed_interactive_lessons_2_to_13.sql"
EXPANDED_LESSONS = ROOT / "supabase/migrations/20260920120000_expand_interactive_lessons_2_and_3.sql"
DAY_THREE_ORDER = ROOT / "supabase/migrations/20260920130000_reorder_day3_question_after_material.sql"
RENDERER = ROOT / "src/components/interactive-lesson.tsx"
LESSON_PAGE = ROOT / "src/routes/lessons.$day.tsx"
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


def test_lesson_steps_unlock_in_order_and_progress_is_saved_automatically():
    renderer = RENDERER.read_text(encoding="utf-8")
    page = LESSON_PAGE.read_text(encoding="utf-8")

    assert "createSteps" in renderer
    assert "steps.slice(0, visibleThrough + 1)" in renderer
    assert "onBlocksCompleted" in renderer
    assert "Я посмотрел видео — продолжить" in renderer
    assert "markBlocksCompleted" in page
    assert "!blocks.every((block) => viewedBlockIds.includes(block.id))" in page
    assert "Завершить урок" not in page


def test_admin_builder_exposes_all_block_types_and_order_controls():
    source = ADMIN.read_text(encoding="utf-8")

    assert "lessonBlockTypes.map" in source
    assert "createLessonBlock(type)" in source
    assert "onUp" in source and "onDown" in source and "onDelete" in source
    assert 'from("lesson_blocks").delete()' in source


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


def test_day_three_question_follows_the_test_case_explanation():
    sql = DAY_THREE_ORDER.read_text(encoding="utf-8")

    assert "Что обычно содержит тест-кейс?" in sql
    assert "position = 9" in sql
