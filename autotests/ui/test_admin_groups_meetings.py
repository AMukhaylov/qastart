import re

import pytest
from playwright.sync_api import expect


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_can_open_group_manager_without_changing_data(admin_page):
    admin_page.goto("/admin/students", wait_until="domcontentloaded")
    expect(admin_page.get_by_role("heading", name="Ученики")).to_be_visible()

    admin_page.get_by_role("button", name=re.compile("Группы")).click()
    expect(admin_page.get_by_text("Название группы", exact=True)).to_be_visible()
    expect(admin_page.get_by_role("button", name="Создать группу", exact=True)).to_be_visible()


@pytest.mark.authenticated
@pytest.mark.admin
def test_admin_can_open_meeting_settings_without_saving(admin_page):
    admin_page.goto("/admin/meetings", wait_until="domcontentloaded")
    expect(admin_page.get_by_role("heading", name="Встречи")).to_be_visible()
    expect(admin_page.get_by_role("button", name="Обновить", exact=True)).to_be_visible()
    expect(admin_page.get_by_text("Ученики увидят только встречи", exact=False)).to_be_visible()
