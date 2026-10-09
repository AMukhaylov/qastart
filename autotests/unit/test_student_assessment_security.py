"""Security regression contracts for student-controlled assessment state."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]


def test_sql_sandbox_pass_state_is_not_written_directly_from_the_browser():
    lesson_route = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    assessment = (
        ROOT / "src/server/sql-sandbox-assessment.functions.ts"
    ).read_text(encoding="utf-8")

    assert ".from(\"sql_sandbox_attempts\")" not in lesson_route
    assert "evaluateSqlTask(config, task, data.query)" in assessment
    assert "passed: result.passed" in assessment
    assert "data.passed" not in assessment
    assert "const blockCompleted = await hasPassedEverySqlTask(block, attempts ?? [])" in assessment
    assert ".delete()" in assessment
    migration = next(
        (ROOT / "supabase/migrations").glob("*_secure_student_assessment_progress.sql")
    )
    sql = migration.read_text(encoding="utf-8")
    assert re.search(
        r"revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.sql_sandbox_attempts\s+from\s+(?:public\s*,\s*)?(?:anon\s*,\s*)?authenticated",
        sql,
        re.IGNORECASE,
    )


def test_students_cannot_directly_create_or_update_required_block_progress():
    lesson_route = (ROOT / "src/routes/lessons.$day.tsx").read_text(encoding="utf-8")
    completion = (
        ROOT / "src/server/lesson-progress.functions.ts"
    ).read_text(encoding="utf-8")
    migration = next(
        (ROOT / "supabase/migrations").glob("*_secure_student_assessment_progress.sql")
    ).read_text(encoding="utf-8")

    assert re.search(
        r"revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.lesson_block_progress\s+from\s+(?:public\s*,\s*)?(?:anon\s*,\s*)?authenticated",
        migration,
        re.IGNORECASE | re.DOTALL,
    ), (
        "Authenticated users must not write lesson_block_progress directly."
    )
    assert ".from(\"lesson_block_progress\").upsert" not in lesson_route
    assert "hasPassedEverySqlTask(block, storedAttempts)" in completion
    assert "correct.has(block.id)" in completion


def test_student_sql_payload_does_not_expose_answer_key_or_grade_in_browser():
    loader = (ROOT / "src/server/lesson-content.functions.ts").read_text(encoding="utf-8")
    grader = (ROOT / "src/server/sql-sandbox-assessment.server.ts").read_text(
        encoding="utf-8"
    )
    widget = (ROOT / "src/components/sql-sandbox-homework.tsx").read_text(encoding="utf-8")

    assert "hideSqlAnswerKeyFromStudent" in loader
    assert "expectedColumns: _columns" in grader
    assert "expectedRows: _rows" in grader
    assert "verificationQuery: _query" in grader
    assert "onAttemptSaved\n        ? await onAttemptSaved(task.id, query)" in widget
