import pytest
from playwright.sync_api import expect

from conftest import require_mutation


def _choose_multiple(page, options):
    for option in options:
        answer = page.get_by_role("button", name=option, exact=True)
        if answer.count() == 1 and answer.is_enabled() and answer.get_attribute("aria-pressed") != "true":
            answer.click()
    submit = page.get_by_role("button", name="Проверить ответ", exact=False)
    if submit.count() == 1 and submit.is_enabled():
        submit.click()


def _continue_if_needed(page):
    button = page.get_by_role("button", name="Продолжить", exact=True)
    if button.count() == 1 and button.is_enabled():
        button.click()


def _choose_single_if_needed(page, option):
    answer = page.get_by_role("button", name=option, exact=True)
    if answer.count() == 1 and answer.is_enabled():
        answer.click()


@pytest.mark.authenticated
@pytest.mark.student
@pytest.mark.mutation
def test_day_two_is_a_connected_progressive_lesson_on_desktop_and_mobile(student_page, settings):
    """Verify the Day 2 lesson with the disposable account's existing progress."""
    require_mutation(settings)
    student_page.goto("/lessons/2", wait_until="domcontentloaded")
    heading = student_page.locator("h1")
    heading.wait_for()
    if "Урок пока закрыт" in heading.inner_text():
        pytest.skip("The disposable account has not completed Day 1, required to open Day 2.")
    expect(student_page.locator("h1", has_text="Как работает IT-команда")).to_be_visible()
    current_example = student_page.get_by_text("Представь новую функцию", exact=False)
    previous_example = student_page.get_by_text("В сервисе доставки", exact=False)
    assert current_example.count() + previous_example.count() > 0

    _continue_if_needed(student_page)
    expect(student_page.get_by_role("heading", name="Одна задача, разные роли")).to_be_visible()
    _continue_if_needed(student_page)
    _choose_single_if_needed(student_page, "Product Manager или Product Owner")

    expect(
        student_page.get_by_role("heading", name="Почему QA подключается ещё до готовой функции")
    ).to_be_visible()
    _continue_if_needed(student_page)
    _choose_multiple(
        student_page,
        ["Задать вопрос и зафиксировать договорённость", "Подумать, какие ситуации важно уточнить"],
    )

    expect(student_page.get_by_role("heading", name="После разработки задача не заканчивается")).to_be_visible()
    _continue_if_needed(student_page)
    _choose_single_if_needed(
        student_page, "Исправить согласованное поведение после понятного описания проблемы"
    )
    expect(student_page.get_by_role("heading", name="Главное из урока")).to_be_visible()
    _continue_if_needed(student_page)

    student_page.set_viewport_size({"width": 390, "height": 844})
    # Production lesson content can be updated independently from the seed
    # migration. Select the equivalent correct statements from either version.
    final_answer_candidates = [
        "QA может уточнять неясные условия до разработки",
        "У каждой роли есть своя зона ответственности, но задача общая",
        "Качество продукта зависит от всей команды",
        "Точные границы ролей могут отличаться в разных компаниях",
    ]
    available_answers = [
        answer
        for answer in final_answer_candidates
        if student_page.get_by_role("button", name=answer, exact=True).count() == 1
    ]
    assert len(available_answers) == 2, available_answers
    _choose_multiple(student_page, available_answers)
    expect(student_page.get_by_text("День 2 пройден", exact=True)).to_be_visible()
    assert student_page.get_by_role("button", name="Завершить урок", exact=True).count() == 0
