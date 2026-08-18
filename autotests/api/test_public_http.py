import pytest


@pytest.mark.parametrize(
    "path",
    ["/", "/auth", "/admin/login", "/privacy", "/offer", "/contacts", "/dashboard", "/lessons/1", "/lessons/14", "/admin/students"],
)
def test_application_pages_are_available(http, settings, path):
    response = http.get(settings.url(path), timeout=20)

    assert response.status_code == 200, f"{path} returned {response.status_code}"
    assert "<html" in response.text.lower()


@pytest.mark.parametrize("path", ["/auth/callback", "/invite/expired-token"])
def test_removed_public_registration_routes_are_unavailable(http, settings, path):
    response = http.get(settings.url(path), timeout=20)

    assert response.status_code == 404


def test_supabase_proxy_does_not_fail_with_gateway_error(http, settings):
    response = http.get(settings.url("/supabase/rest/v1/"), timeout=20)

    assert response.status_code < 500


def test_production_security_headers(http, settings):
    if not settings.is_production:
        pytest.skip("Security headers are configured by the production Nginx layer.")

    response = http.get(settings.url("/"), timeout=20)
    headers = {name.lower(): value for name, value in response.headers.items()}

    assert headers.get("x-content-type-options") == "nosniff"
    assert "max-age=" in headers.get("strict-transport-security", "")
