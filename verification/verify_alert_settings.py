from playwright.sync_api import Page, expect, sync_playwright
import sys

def verify_alert_settings(page: Page):
    print("Step 1: Go to app")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    print("Step 2: Open settings")
    edit_button = page.get_by_role("button", name="Edit")
    if not edit_button.is_visible():
        print("Edit button not visible")
    edit_button.click()

    print("Step 3: Verify modal")
    expect(page.get_by_text("Alert Settings")).to_be_visible()

    print("Step 4: Change cooldown")
    inputs = page.locator("input[type='range']")
    # Assuming 2nd input is Cooldown
    cooldown_input = inputs.nth(1)
    cooldown_input.fill("5")
    cooldown_input.dispatch_event("change")

    print("Step 5: Verify '5 sec'")
    # We expect '5 sec' to appear
    expect(page.get_by_text("5 sec")).to_be_visible()

    print("Step 6: Save")
    save_button = page.get_by_role("button", name="Save Changes")
    save_button.click()

    print("Step 7: Verify Dashboard message")
    expect(page.get_by_text("Notifications muted for 5 sec cooldown.")).to_be_visible()

    print("Step 8: Screenshot")
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_alert_settings(page)
            print("Verification successful")
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
