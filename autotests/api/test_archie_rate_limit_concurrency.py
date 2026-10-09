"""Opt-in staging integration test for atomic concurrent Archie reservations."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import os
from urllib.parse import urlparse
from uuid import uuid4

import pytest
import requests


def _configuration() -> tuple[str, str, str, str, str, str]:
    supabase_url = os.getenv("QA_ARCHIE_RATE_LIMIT_SUPABASE_URL", "").rstrip("/")
    expected_host = os.getenv("QA_ARCHIE_RATE_LIMIT_EXPECTED_HOST", "").lower()
    staging_project_ref = os.getenv("QA_ARCHIE_RATE_LIMIT_STAGING_PROJECT_REF", "")
    service_key = os.getenv("QA_ARCHIE_RATE_LIMIT_SERVICE_ROLE_KEY", "")
    user_id = os.getenv("QA_ARCHIE_RATE_LIMIT_TEST_USER_ID", "")
    lesson_id = os.getenv("QA_ARCHIE_RATE_LIMIT_TEST_LESSON_ID", "")
    confirmed = os.getenv("QA_ARCHIE_RATE_LIMIT_STAGING_CONFIRM", "").lower() == "true"
    if not all((supabase_url, expected_host, staging_project_ref, service_key, user_id, lesson_id)) or not confirmed:
        pytest.skip("Atomic Archie concurrency test requires explicitly confirmed staging credentials.")
    if (urlparse(supabase_url).hostname or "").lower() != expected_host:
        pytest.fail("Rate-limit test target does not match its explicitly approved host.")
    if expected_host != f"{staging_project_ref}.supabase.co" and expected_host not in {"localhost", "127.0.0.1"}:
        pytest.fail("Rate-limit integration test must target a disposable staging Supabase project.")
    return supabase_url, service_key, user_id, lesson_id, expected_host, staging_project_ref


@pytest.mark.api
@pytest.mark.mutation
def test_concurrent_archie_reservations_never_exceed_configured_limit():
    supabase_url, service_key, user_id, lesson_id, _, staging_project_ref = _configuration()
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    created_ids: list[int] = []
    test_model = f"staging-rate-limit-regression-{staging_project_ref}-{uuid4()}"
    window_start = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
    with requests.Session() as session:
        previous = session.get(
            f"{supabase_url}/rest/v1/archie_request_stats",
            headers=headers,
            params={"select": "id", "user_id": f"eq.{user_id}", "created_at": f"gte.{window_start}"},
            timeout=15,
        )
        assert previous.status_code == 200, "Could not inspect dedicated staging fixture quota"
        if previous.json():
            pytest.skip("Dedicated Archie rate-limit fixture already has recent requests")

        def reserve(_: int):
            response = requests.post(
                f"{supabase_url}/rest/v1/rpc/reserve_archie_request",
                headers=headers,
                json={
                    "p_user_id": user_id,
                    "p_lesson_id": lesson_id,
                    "p_provider": "test",
                    "p_model": test_model,
                    "p_limit": 3,
                },
                timeout=20,
            )
            assert response.status_code == 200, "Rate reservation RPC failed in staging"
            return response.json()

        try:
            failures = []
            with ThreadPoolExecutor(max_workers=12) as executor:
                futures = [executor.submit(reserve, index) for index in range(12)]
                for future in as_completed(futures):
                    try:
                        value = future.result()
                        if value is not None:
                            created_ids.append(int(value))
                    except Exception as error:
                        failures.append(error)
            assert not failures, f"One or more staging reservations failed: {len(failures)}"
            assert len(created_ids) == 3, f"Expected exactly 3 reservations, got {len(created_ids)}"
        finally:
            cleanup_ids = list(created_ids)
            if not cleanup_ids:
                lookup = session.get(
                    f"{supabase_url}/rest/v1/archie_request_stats",
                    headers=headers,
                    params={
                        "select": "id",
                        "user_id": f"eq.{user_id}",
                        "model": f"eq.{test_model}",
                        "created_at": f"gte.{window_start}",
                    },
                    timeout=15,
                )
                assert lookup.status_code == 200, "Could not locate staging test reservations for cleanup"
                cleanup_ids = [int(item["id"]) for item in lookup.json()]
            if cleanup_ids:
                cleanup = session.delete(
                    f"{supabase_url}/rest/v1/archie_request_stats",
                    headers={**headers, "Prefer": "return=minimal"},
                    params={"id": f"in.({','.join(map(str, cleanup_ids))})"},
                    timeout=15,
                )
                assert cleanup.status_code in {200, 204}, "Could not clean staging reservations"
