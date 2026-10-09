"""Adversarial cross-student RLS regression; runs only against an explicitly named staging host."""

from __future__ import annotations

import os
from urllib.parse import urlparse

import pytest
import requests


def _require_staging_target() -> tuple[str, str, str, str, str, str]:
    app_url = os.getenv("QA_CROSS_USER_APP_URL", "").rstrip("/")
    expected_app_host = os.getenv("QA_CROSS_USER_EXPECTED_APP_HOST", "").lower()
    supabase_url = os.getenv("QA_CROSS_USER_SUPABASE_URL", "").rstrip("/")
    expected_supabase_host = os.getenv("QA_CROSS_USER_EXPECTED_SUPABASE_HOST", "").lower()
    anon_key = os.getenv("QA_CROSS_USER_SUPABASE_ANON_KEY", "")
    student_a = os.getenv("QA_STUDENT_LOGIN", "")
    password_a = os.getenv("QA_STUDENT_PASSWORD", "")
    student_b = os.getenv("QA_SECOND_STUDENT_LOGIN", "")
    password_b = os.getenv("QA_SECOND_STUDENT_PASSWORD", "")
    staging_confirmation = os.getenv("QA_CROSS_USER_STAGING_CONFIRM", "").lower() == "true"

    required = (app_url, expected_app_host, supabase_url, expected_supabase_host, anon_key,
                student_a, password_a, student_b, password_b)
    if not all(required) or not staging_confirmation:
        pytest.skip("Cross-user API test needs two staging students and explicit expected hosts.")

    app_host = (urlparse(app_url).hostname or "").lower()
    supabase_host = (urlparse(supabase_url).hostname or "").lower()
    if app_host != expected_app_host or supabase_host != expected_supabase_host:
        pytest.fail("Cross-user test target does not match its explicitly approved staging hosts.")
    if app_host in {"startqa.ru", "www.startqa.ru"}:
        pytest.fail("Cross-user API regression must not target production; use disposable staging.")
    return supabase_url, anon_key, student_a, password_a, student_b, password_b


def _login(session: requests.Session, supabase_url: str, anon_key: str, login: str, password: str) -> dict:
    response = session.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key},
        json={"email": login, "password": password},
        timeout=15,
    )
    assert response.status_code == 200, "Staging student login failed"
    return response.json()


def _rest(session: requests.Session, supabase_url: str, anon_key: str, token: str,
          table: str, *, method: str = "GET", params: dict | None = None,
          json: dict | None = None) -> requests.Response:
    return session.request(
        method,
        f"{supabase_url}/rest/v1/{table}",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
            "Prefer": "return=representation",
        },
        params=params,
        json=json,
        timeout=15,
    )


@pytest.mark.api
@pytest.mark.mutation
def test_student_cannot_read_or_update_another_students_profile():
    """Two independent credentials prove that another student's UUID is not enough."""
    supabase_url, anon_key, login_a, password_a, login_b, password_b = _require_staging_target()
    with requests.Session() as session:
        user_a = _login(session, supabase_url, anon_key, login_a, password_a)
        user_b = _login(session, supabase_url, anon_key, login_b, password_b)
        assert user_a["user"]["id"] != user_b["user"]["id"], "Use two different student accounts"

        target = _rest(
            session, supabase_url, anon_key, user_b["access_token"], "profiles",
            params={"id": f"eq.{user_b['user']['id']}", "select": "id,full_name,updated_at"},
        )
        assert target.status_code == 200, "Second student must be able to read their own profile"
        target_rows = target.json()
        assert len(target_rows) == 1, "Second student profile fixture is missing in staging"
        profile = target_rows[0]

        read_foreign = _rest(
            session, supabase_url, anon_key, user_a["access_token"], "profiles",
            params={"id": f"eq.{profile['id']}", "select": "id"},
        )
        assert read_foreign.status_code == 200 and read_foreign.json() == []

        update_foreign = _rest(
            session, supabase_url, anon_key, user_a["access_token"], "profiles",
            method="PATCH",
            params={"id": f"eq.{profile['id']}", "select": "id"},
            json={"full_name": profile.get("full_name") or ""},
        )
        assert update_foreign.status_code in {200, 204}
        assert update_foreign.status_code == 204 or update_foreign.json() == [], (
            "Cross-user update returned a modified profile"
        )

        still_owned = _rest(
            session, supabase_url, anon_key, user_b["access_token"], "profiles",
            params={"id": f"eq.{profile['id']}", "select": "id,full_name,updated_at"},
        )
        assert still_owned.status_code == 200 and still_owned.json() == [profile]
