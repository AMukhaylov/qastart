"""Contract checks for the database-backed Archie rate limit."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]


def test_archie_request_is_reserved_in_database_before_calling_provider():
    source = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    migration = next((ROOT / "supabase/migrations").glob("*_archie_atomic_rate_limit.sql"))
    sql = migration.read_text(encoding="utf-8")

    assert '"reserve_archie_request"' in source
    assert source.index('"reserve_archie_request"') < source.index("generateAIAnswer({")
    assert "reserveLocalRateLimit" not in source
    assert "pg_advisory_xact_lock" in sql
    assert "clock_timestamp() - interval '60 seconds'" in sql
    assert re.search(r"security\s+invoker", sql, re.IGNORECASE)
    assert re.search(r"set\s+search_path\s*=\s*''", sql, re.IGNORECASE)
    assert re.search(r"grant execute .*\s+to service_role", sql, re.IGNORECASE | re.DOTALL)
    assert re.search(
        r"revoke all on function public\.reserve_archie_request\([^;]+?\)\s+from public, anon, authenticated",
        sql,
        re.IGNORECASE | re.DOTALL,
    )


def test_archie_refuses_ai_call_if_atomic_reservation_is_unavailable():
    source = (ROOT / "src/server/archie.functions.ts").read_text(encoding="utf-8")
    reserve = source.index('"reserve_archie_request"')
    provider_call = source.index("generateAIAnswer({", reserve)
    reservation_error = source.index("if (reservationError)", reserve)

    assert reservation_error < provider_call
    assert '"Арчи временно недоступен.' in source[reservation_error:provider_call]
