import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 * - Public suite: set E2E_BASE_URL (e.g. the prod URL) → tests hit that, no local server.
 * - Authenticated suite (CI/local-with-DB): leave E2E_BASE_URL unset → Playwright starts
 *   `npm run start` locally; set E2E_TEST_AUTH=1 to enable the gated test-login.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
