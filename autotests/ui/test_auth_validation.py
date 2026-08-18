from playwright.sync_api import expect


def test_student_login_rejects_cyrillic_login(page):
    page.goto("/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    page.locator("#login").fill("ученик")
    page.locator("#password").fill("ExamplePassword1")
    page.get_by_role("button", name="Войти", exact=True).click()

    expect(page.get_by_text("Логин содержит латинские буквы, цифры и символ _.")).to_be_visible()


def test_student_login_rejects_email_as_login(page):
    page.goto("/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    page.locator("#login").fill("student@example.com")
    page.locator("#password").fill("ExamplePassword1")
    page.get_by_role("button", name="Войти", exact=True).click()

    expect(page.get_by_text("Ученик с таким логином не найден.")).to_be_visible()


def test_admin_login_keeps_email_recovery_flow(page):
    page.goto("/admin/login", wait_until="domcontentloaded")

    expect(page.locator("#admin-email")).to_be_visible()
    expect(page.locator("#admin-password")).to_be_visible()
    expect(page.get_by_role("button", name="Забыли пароль?")).to_be_visible()
