import { test, expect } from "@playwright/test";

/**
 * Public + guard flows — no auth/DB writes, safe to run against any environment
 * (incl. prod). Drives a real browser and asserts on rendered DOM + interactions,
 * complementing the status-code smoke test.
 */

test.describe("public pages render in all locales", () => {
  for (const locale of ["uz", "ru", "en"]) {
    test(`home (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}`);
      // Brand mark in the header — stable across locales and the redesign.
      await expect(page.getByText("Gigora").first()).toBeVisible();
    });
  }
});

test("marketplace shows the filter bar", async ({ page }) => {
  await page.goto("/uz/gigs");
  // search input + apply button from the Gig namespace
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
});

test("search submits as a URL query", async ({ page }) => {
  await page.goto("/uz/gigs");
  await page.getByPlaceholder("Xizmat qidirish...").fill("video");
  await page.getByRole("button", { name: "Qoʻllash" }).click();
  await expect(page).toHaveURL(/[?&]q=video/);
});

test("price + sort filters are reflected in the URL", async ({ page }) => {
  await page.goto("/uz/gigs?min=5000&sort=price_asc");
  // page renders without error and keeps the query
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
});

test("protected dashboard redirects to login when logged out", async ({ page }) => {
  await page.goto("/uz/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("protected new-gig page redirects to login when logged out", async ({ page }) => {
  await page.goto("/uz/dashboard/seller/gigs/new");
  await expect(page).toHaveURL(/\/login/);
});

test("login page offers a sign-in action", async ({ page }) => {
  await page.goto("/uz/login");
  // at least one actionable control (Google / Telegram)
  await expect(page.getByRole("button").first()).toBeVisible();
});
