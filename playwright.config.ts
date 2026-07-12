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
  // Heavy flows (payout: 6 sequential logins + navigations + server actions across buyer/
  // admin/seller contexts) legitimately need more than the 30s default under parallel CI
  // load; the first order placement also pays a cold-server/DB-pool cost. 60s budget + an
  // extra retry (warm server on re-run) absorbs both without masking real regressions.
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
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
