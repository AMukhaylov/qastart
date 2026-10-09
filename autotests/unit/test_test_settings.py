from pathlib import Path

from conftest import TestSettings as Settings


def test_test_settings_repr_never_exposes_student_or_admin_credentials():
    settings = Settings(
        base_url="https://example.test",
        browser_name="chromium",
        headless=True,
        timeout_ms=1000,
        artifact_dir=Path("artifacts"),
        student_login="student-secret-login",
        student_password="student-secret-password",
        admin_email="admin-secret@example.test",
        admin_password="admin-secret-password",
        allow_mutation=False,
        run_prod_mutation=False,
    )

    rendered = repr(settings)
    for secret in (
        "student-secret-login",
        "student-secret-password",
        "admin-secret@example.test",
        "admin-secret-password",
    ):
        assert secret not in rendered
