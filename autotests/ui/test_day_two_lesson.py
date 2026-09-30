import pytest
from playwright.sync_api import expect

from conftest import require_mutation


def _choose_multiple(page, options):
    for option in options:
        page.get_by_role("button", name=option, exact=True).click()
    page.get_by_role("button", name="Проверить ответ", exact=False).click()


def _complete_day_one(page):
    page.goto("/lessons/1", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Добро пожаловать в QA Start")).to_be_visible()

    page.get_by_role("button", name="Продолжить", exact=True).click()
    expect(page.get_by_role("heading", name="Что такое тестирование ПО")).to_be_visible()
    page.get_by_role("button", name="Продолжить", exact=True).click()
    _choose_multiple(
        page,
        [
            "Узнать о качестве продукта и рисках",
            "Найти дефекты",
            "Проверить, выполняются ли важные ожидания",
        ],
    )
    expect(page.get_by_role("heading", name="Как сравнить ожидание с результатом")).to_be_visible()
    page.get_by_role("button", name="Продолжить", exact=True).click()
    page.get_by_role(
        "button",
        name="Сверить поведение с требованием и записать шаги, ожидаемый и фактический результат",
        exact=True,
    ).click()
    expect(page.get_by_role("heading", name="Кто помогает команде с такими проверками")).to_be_visible()
    page.get_by_role("button", name="Продолжить", exact=True).click()
    _choose_multiple(
        page,
        [
            "Уточнить неполное требование до разработки",
            "Договориться, как команда передаёт и уточняет требования",
        ],
    )
    expect(page.get_by_role("heading", name="Не все проблемы удаётся предупредить")).to_be_visible()
    page.get_by_role("button", name="Продолжить", exact=True).click()
    page.get_by_role("button", name="Поведение отличается от ожидаемого", exact=True).click()
    expect(page.get_by_role("heading", name="Как заметить такие ситуации раньше")).to_be_visible()
    page.get_by_role("button", name="Продолжить", exact=True).click()
    _choose_multiple(
        page,
        [
            "Проверки помогают узнать о рисках",
            "Дефект может быть не только в коде",
            "Неверная скидка на экране показывает проявление проблемы",
        ],
    )
    expect(page.get_by_text("День 1 пройден", exact=True)).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.student
@pytest.mark.mutation
def test_day_two_is_a_connected_progressive_lesson_on_desktop_and_mobile(student_page, settings):
    """Use the disposable student to verify the full Day 2 learning flow."""
    require_mutation(settings)
    _complete_day_one(student_page)

    student_page.goto("/lessons/2", wait_until="domcontentloaded")
    expect(student_page.locator("h1", has_text="Как работает IT-команда")).to_be_visible()
    expect(student_page.get_by_text("В сервисе доставки", exact=False)).to_be_visible()

    student_page.get_by_role("button", name="Продолжить", exact=True).click()
    expect(student_page.get_by_role("heading", name="Одна задача, разные роли")).to_be_visible()
    student_page.get_by_role("button", name="Продолжить", exact=True).click()
    student_page.get_by_role(
        "button", name="Product Manager или Product Owner", exact=True
    ).click()

    expect(
        student_page.get_by_role("heading", name="Почему QA подключается ещё до готовой функции")
    ).to_be_visible()
    student_page.get_by_role("button", name="Продолжить", exact=True).click()
    _choose_multiple(
        student_page,
        ["Задать вопрос и зафиксировать договорённость", "Подумать, какие ситуации важно уточнить"],
    )

    expect(student_page.get_by_role("heading", name="После разработки задача не заканчивается")).to_be_visible()
    student_page.get_by_role("button", name="Продолжить", exact=True).click()
    student_page.get_by_role(
        "button", name="Исправить согласованное поведение после понятного описания проблемы", exact=True
    ).click()
    expect(student_page.get_by_role("heading", name="Главное из урока")).to_be_visible()
    student_page.get_by_role("button", name="Продолжить", exact=True).click()

    student_page.set_viewport_size({"width": 390, "height": 844})
    _choose_multiple(
        student_page,
        [
            "QA может уточнять неясные условия до разработки",
            "У каждой роли есть своя зона ответственности, но задача общая",
        ],
    )
    expect(student_page.get_by_text("День 2 пройден", exact=True)).to_be_visible()
    assert student_page.get_by_role("button", name="Завершить урок", exact=True).count() == 0
