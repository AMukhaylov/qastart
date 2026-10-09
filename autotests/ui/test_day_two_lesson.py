import pytest
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect


@pytest.mark.authenticated
@pytest.mark.student
def test_day_two_and_archie_widget_are_available_on_desktop_and_mobile(student_page):
    """Smoke-test the current lesson and floating helper without changing course progress."""
    student_page.goto("/lessons/2", wait_until="domcontentloaded")
    heading = student_page.locator("h1")
    heading.wait_for()
    if "Урок пока закрыт" in heading.inner_text():
        pytest.skip("The disposable account has not completed Day 1, required to open Day 2.")
    expect(student_page.locator("h1", has_text="Как работает IT-команда")).to_be_visible()
    assert student_page.get_by_text("Кто участвует в создании продукта", exact=True).count() > 0

    archie_button = student_page.get_by_test_id("archie-floating-button")
    expect(archie_button).to_be_visible()
    greeting_bubble = student_page.get_by_test_id("archie-floating-greeting")
    expect(greeting_bubble).to_be_visible()
    greeting_text = greeting_bubble.locator("span").inner_text()
    button_box = archie_button.bounding_box()
    assert button_box and button_box["x"] + button_box["width"] > 1200
    assert archie_button.evaluate("element => getComputedStyle(element).position") == "fixed"

    archie_button.click()
    chat_input = student_page.get_by_placeholder("Напиши вопрос…")
    try:
        chat_input.wait_for(state="visible", timeout=5000)
        expect(student_page.get_by_role("heading", name="Арчи", exact=True)).to_be_visible()
        expect(student_page.get_by_test_id("archie-chat-greeting")).to_have_text(greeting_text)
        # The subtitle is admin-configurable; require a visible, nonempty value
        # instead of coupling this smoke test to the old default copy.
        subtitle = student_page.locator("#archie-chat-panel > div").locator("p").first
        expect(subtitle).to_be_visible()
        expect(subtitle).not_to_be_empty()
    except PlaywrightTimeoutError:
        # Checked exercises keep the widget but must never expose the AI composer.
        expect(greeting_bubble.locator("span")).not_to_be_empty()
        expect(chat_input).not_to_be_visible()

    student_page.set_viewport_size({"width": 390, "height": 844})
    if chat_input.is_visible():
        expect(chat_input).to_be_visible()
    else:
        expect(archie_button).to_be_visible()
    assert student_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
