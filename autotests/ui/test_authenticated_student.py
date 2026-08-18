import pytest
from playwright.sync_api import expect


@pytest.mark.authenticated
@pytest.mark.student
def test_student_can_open_dashboard_and_first_lesson(student_page):
    expect(student_page.get_by_text("Прогресс курса", exact=True)).to_be_visible()

    student_page.goto("/lessons/1", wait_until="domcontentloaded")
    expect(student_page.locator("h1", has_text="Что такое тестирование")).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.student
def test_student_profile_does_not_show_email(student_page):
    student_page.goto("/profile", wait_until="domcontentloaded")

    expect(student_page.get_by_role("heading", name="Данные аккаунта")).to_be_visible()
    assert student_page.get_by_text("Email", exact=True).count() == 0


@pytest.mark.authenticated
@pytest.mark.student
def test_student_dashboard_does_not_reload_on_focus(student_page):
    student_page.goto("/dashboard", wait_until="domcontentloaded")
    expect(student_page.get_by_text("Прогресс курса", exact=True)).to_be_visible()

    before = student_page.url
    student_page.evaluate("window.dispatchEvent(new Event('focus'))")
    student_page.wait_for_timeout(500)

    assert student_page.url == before
    expect(student_page.get_by_text("Прогресс курса", exact=True)).to_be_visible()
