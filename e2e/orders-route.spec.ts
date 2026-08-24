import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * The buyer's orders list (audit 2026-08-10, S6).
 *
 * Before this route existed, orders were reachable only from a dashboard widget showing ACTIVE
 * ones capped at 8 — completed orders dropped off entirely — and the mobile tab bar had no link
 * at all. A phone-only buyer had no path back to something they had paid for.
 *
 * The acceptance criterion is deliberately phrased as a journey, not a page render: place an
 * order, navigate away, and get back to it using ONLY the bottom nav at 390px.
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

const PHONE = { width: 390, height: 844 };

test("a phone buyer can reach a placed order using only the bottom nav", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: PHONE });
  const page = await ctx.newPage();
  await loginAs(page, "e2e_buyer");

  await page.goto("/uz/gigs/e2e-gig");
  await page.getByRole("button", { name: "Buyurtma berish" }).click();
  await page.waitForURL(/\/uz\/orders\/.+/);
  const orderId = page.url().split("/orders/")[1];

  // Walk away, as a buyer closing the tab and coming back later would.
  await page.goto("/uz");

  // One tap on the bottom nav — no deep link, no dashboard detour.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Buyurtmalar" }).click();
  await page.waitForURL(/\/uz\/orders(\?|$)/);

  // Second tap: the order itself. That is the ≤2-tap bar from the spec.
  await page.getByRole("link", { name: /E2E test gig/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/uz/orders/${orderId}`));

  await ctx.close();
});

test("orders list filters by state and keeps completed orders reachable", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: PHONE });
  const page = await ctx.newPage();
  await loginAs(page, "e2e_buyer");

  await page.goto("/uz/orders");
  // Defaults to Active.
  await expect(page.getByRole("link", { name: /Faol/ })).toHaveAttribute("aria-current", "page");

  // Completed is the tab the dashboard widget can never show.
  await page.getByRole("link", { name: /Yakunlangan/ }).click();
  await expect(page).toHaveURL(/tab=completed/);
  await expect(page.getByRole("link", { name: /Yakunlangan/ })).toHaveAttribute("aria-current", "page");

  // Whatever the state, the page must say something rather than render an empty void.
  const rows = page.getByRole("link", { name: /E2E test gig/ });
  const empty = page.getByText("Hali yakunlangan buyurtma yoʻq");
  await expect(async () => {
    expect((await rows.count()) > 0 || (await empty.count()) > 0).toBe(true);
  }).toPass({ timeout: 10_000 });

  await ctx.close();
});

test("signed-out visitors keep the browsing nav, and /orders requires login", async ({ page }) => {
  await page.setViewportSize(PHONE);

  await page.goto("/uz");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Ijodkorlar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Buyurtmalar" })).toHaveCount(0);

  await page.goto("/uz/orders");
  await expect(page).toHaveURL(/\/login/);
});
