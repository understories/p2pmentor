import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration
 *
 * Runs end-to-end tests against the Next.js app.
 * - Smoke tests (smoke.spec.ts): Fast, mocked checks
 * - Real tests (arkiv-real.spec.ts): Full integration with real Arkiv/web3
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// Enable E2E mocks by default for smoke tests
// Real tests (arkiv-real.spec.ts) will disable mocks explicitly
if (!process.env.NEXT_PUBLIC_E2E_MOCKS) {
  process.env.NEXT_PUBLIC_E2E_MOCKS = "true";
}

export default defineConfig({
  testDir: "./e2e",

  // Run tests in parallel (one worker per CPU core)
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 1 : 0,

  // Opt out of parallel tests on CI (can be re-enabled if tests are stable)
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI ? [["html"], ["github"]] : [["html"], ["list"]],

  // Shared settings for all projects
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run local dev server before starting tests
  webServer: process.env.CI
    ? undefined // CI will start server separately
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
