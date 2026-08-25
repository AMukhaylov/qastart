from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

import pytest
import requests
from dotenv import load_dotenv
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.autotests")


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class TestSettings:
    base_url: str
    browser_name: str
    headless: bool
    timeout_ms: int
    artifact_dir: Path
    student_login: str | None
    student_password: str | None
    admin_email: str | None
    admin_password: str | None
    allow_mutation: bool
    run_prod_mutation: bool

    def url(self, path: str) -> str:
        return urljoin(f"{self.base_url}/", path.lstrip("/"))

    @property
    def is_production(self) -> bool:
        return urlparse(self.base_url).hostname not in {"localhost", "127.0.0.1", "::1"}


@pytest.fixture(scope="session")
def settings() -> TestSettings:
    base_url = os.getenv("QA_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
    return TestSettings(
        base_url=base_url,
        browser_name=os.getenv("QA_BROWSER", "chromium"),
        headless=_as_bool(os.getenv("QA_HEADLESS"), True),
        timeout_ms=int(os.getenv("QA_TIMEOUT_MS", "15000")),
        artifact_dir=ROOT / os.getenv("QA_SCREENSHOT_DIR", "autotests/artifacts"),
        student_login=os.getenv("QA_STUDENT_LOGIN") or None,
        student_password=os.getenv("QA_STUDENT_PASSWORD") or None,
        admin_email=os.getenv("QA_ADMIN_EMAIL") or None,
        admin_password=os.getenv("QA_ADMIN_PASSWORD") or None,
        allow_mutation=_as_bool(os.getenv("QA_ALLOW_MUTATION")),
        run_prod_mutation=_as_bool(os.getenv("QA_RUN_PROD_MUTATION")),
    )


@pytest.fixture(scope="session")
def http() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = "QAStartAutotests/1.0"
    yield session
    session.close()


def _safe_test_name(nodeid: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", nodeid)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[object]):
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)


@pytest.fixture(scope="session")
def browser(settings: TestSettings):
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import Error, sync_playwright

    with sync_playwright() as playwright:
        try:
            engine = getattr(playwright, settings.browser_name)
            instance = engine.launch(headless=settings.headless)
        except (AttributeError, Error) as error:
            pytest.skip(f"Playwright browser is unavailable: {error}")
        yield instance
        instance.close()


@pytest.fixture
def page(request: pytest.FixtureRequest, browser, settings: TestSettings):
    context = browser.new_context(base_url=settings.base_url, viewport={"width": 1440, "height": 1000})
    current_page = context.new_page()
    current_page.set_default_timeout(settings.timeout_ms)
    yield current_page

    report = getattr(request.node, "rep_call", None)
    if report and report.failed:
        settings.artifact_dir.mkdir(parents=True, exist_ok=True)
        try:
            current_page.screenshot(
                path=str(settings.artifact_dir / f"{_safe_test_name(request.node.nodeid)}.png"),
                full_page=True,
            )
        except Exception:
            pass
    context.close()


def require_mutation(settings: TestSettings) -> None:
    if not settings.allow_mutation:
        pytest.skip("Mutation tests are disabled. Set QA_ALLOW_MUTATION=true for a disposable test account.")
    if settings.is_production and not settings.run_prod_mutation:
        pytest.skip("Production mutations need QA_RUN_PROD_MUTATION=true as a second confirmation.")


@pytest.fixture
def student_page(page, settings: TestSettings):
    if not settings.student_login or not settings.student_password:
        pytest.skip("Set QA_STUDENT_LOGIN and QA_STUDENT_PASSWORD to run student scenarios.")
    # The app keeps background requests alive, so networkidle makes a healthy
    # login page look unavailable. The form itself is the contract under test.
    for attempt in range(2):
        page.goto("/auth", wait_until="commit")
        # Let React hydrate before filling controlled inputs. Filling the server-
        # rendered fields earlier is lost when the client takes ownership of them.
        page.wait_for_timeout(2_500)
        page.locator("#login").fill(settings.student_login)
        page.locator("#password").fill(settings.student_password)
        page.get_by_role("button", name="Войти", exact=True).click()
        try:
            page.get_by_text("Прогресс курса", exact=True).wait_for(timeout=10_000)
            break
        except PlaywrightTimeoutError:
            if attempt:
                raise
            page.wait_for_timeout(1_000)
    return page


@pytest.fixture
def admin_page(page, settings: TestSettings):
    if not settings.admin_email or not settings.admin_password:
        pytest.skip("Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD to run administrator scenarios.")
    page.goto("/admin/login", wait_until="commit")
    page.wait_for_timeout(2_500)
    page.locator("#admin-email").fill(settings.admin_email)
    page.locator("#admin-password").fill(settings.admin_password)
    page.get_by_role("button", name="Войти в админку", exact=True).click()
    page.get_by_text("Проверка ДЗ", exact=True).wait_for()
    return page
