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


def test_exposed_security_definer_import_checks_admin_role():
    migration = MIGRATIONS / "20261004174829_reliable_admin_lesson_writes.sql"
    sql = migration.read_text(encoding="utf-8").lower()
    function = sql.split("create or replace function public.admin_import_lesson_package_once", 1)[1]

    assert "security definer" in function
    assert "set search_path = public, private, pg_temp" in function
    assert "private.has_role((select auth.uid()), 'admin'::public.app_role)" in function


def test_server_completion_checks_order_and_required_blocks():
    source = (ROOT / "src/server/lesson-access.functions.ts").read_text(encoding="utf-8")

    assert '.eq("day_number", lesson.day_number - 1)' in source
    assert 'from("lesson_block_progress")' in source
    assert "requiredBlockIds.every((id) => completedBlockIds.has(id))" in source
    assert 'from("lesson_progress").upsert(' in source
