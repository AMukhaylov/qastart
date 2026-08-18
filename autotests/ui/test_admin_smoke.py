import pytest
from playwright.sync_api import expect


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_students_list_is_available(admin_page):
    admin_page.goto("/admin/students", wait_until="domcontentloaded")

    expect(admin_page.get_by_role("heading", name="Ученики")).to_be_visible()
    expect(admin_page.get_by_role("button", name="Создать ученика", exact=True)).to_be_visible()
    for header in ["УЧЕНИК", "ЛОГИН", "СТАТУС", "ПРОГРЕСС", "ДЗ", "СЕРТИФИКАТ", "ДЕЙСТВИЯ"]:
        expect(admin_page.get_by_text(header, exact=True).first).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_lessons_editor_is_available(admin_page):
    admin_page.goto("/admin/lessons", wait_until="domcontentloaded")

    expect(admin_page.get_by_text("Конспект", exact=True).first).to_be_visible()
