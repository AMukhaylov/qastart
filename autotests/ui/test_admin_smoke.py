import json
import re

import pytest
from playwright.sync_api import expect



@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_students_list_is_available(admin_page):
    admin_page.goto("/admin/students", wait_until="domcontentloaded")

    expect(admin_page.get_by_role("heading", name="Ученики")).to_be_visible()
    expect(admin_page.get_by_role("button", name="Создать ученика", exact=True)).to_be_visible()
    for header in ["Ученик", "Логин", "Статус", "Прогресс", "ДЗ", "Сертификат", "Действия"]:
        expect(admin_page.get_by_role("columnheader", name=header, exact=True)).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_lessons_editor_is_available(admin_page):
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")

    expect(admin_page.get_by_role("heading", name="Управление уроками")).to_be_visible()
    expect(admin_page.get_by_role("button", name=re.compile("Что такое тестирование"))).to_be_visible()
    expect(admin_page.get_by_role("button", name="Импортировать урок", exact=True)).to_be_visible()
    expect(
        admin_page.get_by_role("button", name="Скачать спецификацию для ИИ", exact=True)
    ).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_can_switch_to_lessons_with_homework_blocks(admin_page):
    """Homework editor must receive its lesson day and never crash on Day 2 or 3."""
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")

    for title in ["Как работает IT-команда", "Тест-кейсы и чек-листы"]:
        admin_page.get_by_role("button", name=re.compile(title)).click()
        expect(admin_page.get_by_text("После отправки ДЗ — «День пройден»", exact=True)).to_be_visible()
        expect(admin_page.get_by_role("button", name="Сохранить", exact=True)).to_be_visible()
        assert admin_page.get_by_text("Что-то пошло не так", exact=True).count() == 0


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_lesson_actions_stay_visible_while_scrolling(admin_page):
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")
    save_button = admin_page.get_by_role("button", name="Сохранить", exact=True)
    actions_bar = admin_page.get_by_test_id("lesson-actions-bar")
    expect(save_button).to_be_visible()
    expect(actions_bar).to_be_visible()
    admin_page.locator('input:not([type="file"])').first.fill("Черновая проверка сохранения")
    expect(save_button).to_be_enabled()

    admin_page.evaluate("window.scrollTo(0, 1_600)")
    expect(save_button).to_be_visible()
    expect(save_button).to_be_enabled()
    header = admin_page.locator("header").bounding_box()
    bar = actions_bar.bounding_box()
    assert header and bar
    assert header["y"] <= 1
    scroll_y = admin_page.evaluate("window.scrollY")
    assert header["height"] <= bar["y"] <= header["height"] + 24, (header, bar, scroll_y)

    admin_page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    expect(actions_bar).to_be_visible()
    expect(save_button).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_lesson_actions_fit_mobile_screen(admin_page):
    admin_page.set_viewport_size({"width": 390, "height": 844})
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")

    actions_bar = admin_page.get_by_test_id("lesson-actions-bar")
    expect(actions_bar).to_be_visible()
    box = actions_bar.bounding_box()
    assert box and box["width"] <= 390

    admin_page.evaluate("window.scrollTo(0, 1_600)")
    expect(admin_page.get_by_role("button", name="Сохранить", exact=True)).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_lesson_import_shows_preview_before_any_save(admin_page):
    admin_page.set_viewport_size({"width": 1280, "height": 900})
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")
    package = {
        "schemaVersion": "1.0",
        "lesson": {
            "day": 99,
            "title": "Предпросмотр импорта",
            "description": "Урок для проверки предпросмотра.",
            "blocks": [
                {"type": "heading", "title": "Раздел"},
                {
                    "type": "summary",
                    "title": "Главное",
                    "items": [{"term": "Термин", "definition": "Объяснение"}],
                    "points": ["Мысль"],
                },
            ],
        },
    }
    admin_page.locator('input[type="file"]').set_input_files(
        {
            "name": "lesson-preview.json",
            "mimeType": "application/json",
            "buffer": json.dumps(package).encode("utf-8"),
        }
    )

    expect(admin_page.get_by_role("heading", name="Импорт урока")).to_be_visible()
    expect(admin_page.get_by_text("Предпросмотр для ученика", exact=True)).to_be_visible()
    expect(admin_page.get_by_role("button", name="Импортировать", exact=True)).to_be_visible()

    dialog = admin_page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    assert dialog.evaluate("element => element.scrollWidth <= element.clientWidth + 1")
    assert admin_page.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth + 1"
    )

    admin_page.set_viewport_size({"width": 390, "height": 844})
    admin_page.wait_for_function(
        "() => { const dialog = document.querySelector('[role=dialog]'); "
        "if (!dialog) return false; const box = dialog.getBoundingClientRect(); "
        "return box.left >= 0 && box.right <= window.innerWidth + 1; }"
    )
    assert dialog.evaluate("element => element.scrollWidth <= element.clientWidth + 1")
    dialog_box = dialog.bounding_box()
    assert dialog_box and dialog_box["x"] >= 0 and dialog_box["x"] + dialog_box["width"] <= 390
    assert admin_page.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth + 1"
    )


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_final_quiz_settings_are_available(admin_page):
    admin_page.goto("/admin/quiz", wait_until="domcontentloaded")

    expect(admin_page.get_by_role("heading", name="Настройки итогового теста")).to_be_visible()
    expect(admin_page.get_by_text("Сейчас в банке:", exact=False)).to_contain_text("90 вопросов")
    expect(admin_page.get_by_label("Вопросов в попытке")).to_have_value("30")
    expect(admin_page.get_by_label("Время на попытку (минут)")).to_have_value("30")
    expect(admin_page.get_by_label("Количество попыток")).to_have_value("3")
    expect(admin_page.get_by_label("Проходной балл (%)")).to_have_value("70")
    expect(admin_page.get_by_role("button", name="Скачать текущий банк")).to_be_enabled()
    with admin_page.expect_download() as download_info:
        admin_page.get_by_role("button", name="Скачать текущий банк").click()
    bank = json.loads(download_info.value.path().read_text(encoding="utf-8"))
    assert len(bank) == 90
    assert all(
        question["correctOptionId"] in {option["id"] for option in question["options"]}
        for question in bank
    )


@pytest.mark.authenticated
@pytest.mark.admin
def test_day_one_export_can_be_opened_in_the_import_preview(admin_page):
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")
    with admin_page.expect_download() as download_info:
        admin_page.get_by_role("button", name="Экспортировать урок", exact=True).click()
    download = download_info.value
    package = json.loads(download.path().read_text(encoding="utf-8"))

    assert package["schemaVersion"] == "1.0"
    assert package["lesson"]["day"] == 1
    assert package["lesson"]["blocks"]

    admin_page.locator('input[type="file"]').set_input_files(
        {
            "name": "day-1-round-trip.json",
            "mimeType": "application/json",
            "buffer": json.dumps(package).encode("utf-8"),
        }
    )
    expect(admin_page.get_by_role("heading", name="Импорт урока")).to_be_visible()
    expect(admin_page.get_by_text("JSON не прошёл проверку", exact=True)).not_to_be_visible()
