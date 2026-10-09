from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase/migrations"


def test_students_cannot_write_course_completion_directly():
    """Course completion controls lesson unlocks and must be server-owned."""
    sql = "\n".join(
        path.read_text(encoding="utf-8").lower()
        for path in sorted(MIGRATIONS.glob("*.sql"))
    )

    assert 'drop policy if exists "users insert own progress" on public.lesson_progress' in sql
    assert 'drop policy if exists "users update own progress" on public.lesson_progress' in sql
    assert (
        "revoke insert, update on public.lesson_progress from authenticated" in sql
        or "revoke all on public.lesson_progress from authenticated" in sql
    )


def test_admin_import_rpc_exposes_only_invoker_wrapper():
    migration = next(MIGRATIONS.glob("*_secure_admin_import_rpc.sql"))
    sql = migration.read_text(encoding="utf-8").lower()
    public_wrapper = sql.split(
        "create or replace function public.admin_import_lesson_package_once", 1
    )[1]

    assert "security invoker" in public_wrapper
    assert "set search_path = ''" in public_wrapper
    assert "select private.admin_import_lesson_package_once(" in public_wrapper
    assert "alter function public.admin_import_lesson_package_once" in sql


def test_server_completion_respects_course_schedule_and_required_blocks():
    source = (ROOT / "src/server/lesson-access.functions.ts").read_text(encoding="utf-8")

    assert 'getLessonScheduleAccess(userId, lesson.day_number)' in source
    assert 'if (!access.allowed)' in source
    assert 'from("lesson_block_progress")' in source
    assert "const requiredBlocks = (blocks ?? []).filter((block) =>" in source
    assert "let requirementsComplete = requiredBlocks.every((block) =>" in source
    assert 'blockCompletionCondition(safeBlock) === "all_sql_tasks_passed"' in source
    assert "hasPassedEverySqlTask(safeBlock, sqlAttempts ?? [])" in source
    assert 'from("lesson_progress")' in source
    assert '.upsert(' in source
