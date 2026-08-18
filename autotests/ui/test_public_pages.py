import re

from playwright.sync_api import expect


PROGRAM_TITLES = [
    "Что такое тестирование",
    "Как работает IT-команда",
    "Тест-кейсы и чек-листы",
    "Баги и баг-репорты",
    "Виды и уровни тестирования",
    "Техники тест-дизайна",
    "Клиент-серверная архитектура",
    "DevTools для тестировщика",
    "API и HTTP",
    "Postman",
    "SQL и базы данных",
    "Методологии разработки",
    "Твой первый день QA",
    "Итоговый тест",
]


def test_homepage_has_course_program_and_vk_contact(page):
    response = page.goto("/", wait_until="domcontentloaded")

    assert response and response.status == 200
    expect(page).to_have_title(re.compile("QA Start"))
    expect(page.get_by_role("link", name="Войти в кабинет", exact=True)).to_be_visible()
    vk_link = page.get_by_role("link", name="Написать в VK", exact=True)
    expect(vk_link).to_be_visible()
    assert vk_link.get_attribute("href") == "https://vk.ru/qa_school"

    for title in PROGRAM_TITLES:
        assert page.get_by_text(title, exact=True).count() > 0, f"Course title is missing: {title}"


def test_hidden_application_version_is_present(page):
    page.goto("/", wait_until="domcontentloaded")
    version = page.locator('meta[name="app-version"]').get_attribute("content")

    assert version and re.fullmatch(r"v\d+\.\d+\.\d+", version)


def test_homepage_is_usable_on_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/", wait_until="domcontentloaded")

    cta = page.get_by_role("link", name="Войти в кабинет", exact=True)
    expect(cta).to_be_visible()
    box = cta.bounding_box()
    assert box and box["width"] > 120


def test_student_login_has_no_self_registration_or_email_field(page):
    page.goto("/auth", wait_until="domcontentloaded")

    expect(page.get_by_role("heading", name="Добро пожаловать в QA Start")).to_be_visible()
    expect(page.locator("#login")).to_be_visible()
    expect(page.locator("#password")).to_be_visible()
    assert page.get_by_text("Создать аккаунт", exact=True).count() == 0
    assert page.locator('input[type="email"]').count() == 0


def test_student_login_password_visibility_toggle(page):
    page.goto("/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    password = page.locator("#password")
    password.fill("ExamplePassword1")

    expect(password).to_have_attribute("type", "password")
    page.get_by_role("button", name="Показать пароль").click()
    expect(password).to_have_attribute("type", "text")
