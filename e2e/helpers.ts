import type { Page } from "@playwright/test";

/**
 * Sign in as a seeded user through the gated `e2e` credentials provider.
 * Uses the Auth.js CSRF flow; page.request shares the browser context's cookie jar,
 * so subsequent page.goto() calls are authenticated.
 */
export async function loginAs(page: Page, userId: string) {
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/e2e", {
    form: { csrfToken: csrf.csrfToken, userId, callbackUrl: "/", json: "true" },
  });
}
