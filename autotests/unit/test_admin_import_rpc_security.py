from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]


def test_postgrest_admin_import_entrypoint_is_security_invoker():
    migration = next(
        (ROOT / "supabase/migrations").glob("*_secure_admin_import_rpc.sql")
    ).read_text(encoding="utf-8")

    assert re.search(
        r"alter\s+function\s+public\.admin_import_lesson_package_once\([^;]+?\)\s+set\s+schema\s+private",
        migration,
        re.IGNORECASE | re.DOTALL,
    )
    public_wrapper = migration.split(
        "create or replace function public.admin_import_lesson_package_once", 1
    )[1]
    assert re.search(r"security\s+invoker", public_wrapper, re.IGNORECASE)
    assert "set search_path = ''" in public_wrapper
    assert "select private.admin_import_lesson_package_once(" in public_wrapper


def test_private_admin_import_implementation_keeps_admin_guard_and_is_not_publicly_callable():
    migration = next(
        (ROOT / "supabase/migrations").glob("*_secure_admin_import_rpc.sql")
    ).read_text(encoding="utf-8")

    assert re.search(
        r"alter\s+function\s+private\.admin_import_lesson_package_once\([^;]+?\)\s+security\s+definer",
        migration,
        re.IGNORECASE | re.DOTALL,
    )
    assert re.search(
        r"revoke\s+all\s+on\s+function\s+private\.admin_import_lesson_package_once\([^;]+?\)\s+from\s+public,\s*anon",
        migration,
        re.IGNORECASE | re.DOTALL,
    )
    assert re.search(
        r"grant\s+execute\s+on\s+function\s+private\.admin_import_lesson_package_once\([^;]+?\)\s+to\s+authenticated",
        migration,
        re.IGNORECASE | re.DOTALL,
    )
    original = (
        ROOT
        / "supabase/migrations/20261004174829_reliable_admin_lesson_writes.sql"
    ).read_text(encoding="utf-8")
    assert "private.has_role((select auth.uid()), 'admin'::public.app_role)" in original
