import pytest
from playwright.sync_api import expect

from autotests.conftest import require_mutation


@pytest.mark.authenticated
@pytest.mark.student
@pytest.mark.mutation
def test_disposable_student_can_start_final_quiz(student_page, settings):
    """Run only with a disposable account: starting a quiz consumes an attempt."""
    require_mutation(settings)
    student_page.goto("/lessons/14", wait_until="domcontentloaded")

    expect(student_page.get_by_role("heading", name="Итоговый тест")).to_be_visible()
    expect(student_page.get_by_text("30 вопросов", exact=False)).to_be_visible()
    expect(student_page.get_by_text("30 минут", exact=False)).to_be_visible()
    student_page.get_by_role("button", name="Начать тест", exact=True).click()
    expect(student_page.get_by_text("Вопрос 1 из 30", exact=False)).to_be_visible()
    assert student_page.get_by_role("button", name="Назад", exact=True).count() == 0


@pytest.mark.authenticated
@pytest.mark.student
@pytest.mark.mutation
def test_leaving_active_quiz_finishes_attempt_and_returns_to_dashboard(student_page, settings):
    """Run only with a disposable account: leaving the test must consume its active attempt."""
    require_mutation(settings)
    student_page.goto("/lessons/14", wait_until="domcontentloaded")
    student_page.get_by_role("button", name="Начать тест", exact=True).click()
    expect(student_page.get_by_text("Вопрос 1 из 30", exact=False)).to_be_visible()

    student_page.get_by_role("button", name="Завершить курс", exact=True).click()
    student_page.wait_for_url("**/dashboard")
    expect(student_page.get_by_text("Прогресс курса", exact=True)).to_be_visible()
