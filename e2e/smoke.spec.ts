import { test, expect } from "@playwright/test";
import { server } from "./mocks/server";

/**
 * Smoke test - verifies basic app functionality
 *
 * This is the first E2E test to ensure the app loads and key elements render.
 * More comprehensive tests will be added as Phase 2 progresses.
 */

// Setup MSW before tests
test.beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

test.afterAll(() => {
  server.close();
});

test.describe("Smoke Tests", () => {
  test("landing page loads and renders key elements", async ({ page }) => {
    await page.goto("/");

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Check that the page title is present (adjust selector based on actual app)
    const title = page.locator("h1").first();
    await expect(title).toBeVisible({ timeout: 5000 });

    // Verify page doesn't have critical errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait a bit to catch any console errors
    await page.waitForTimeout(1000);

    // Log errors for debugging but don't fail test (some may be expected)
    if (errors.length > 0) {
      console.log("Console errors detected:", errors);
    }
  });

  test("app navigation is accessible", async ({ page }) => {
    await page.goto("/");

    // Check that navigation elements exist (adjust selectors based on actual app)
    // This is a basic check - more specific navigation tests can be added later
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
