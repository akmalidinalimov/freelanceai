import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Batch 10. Gated on the seeded DB (E2E_TEST_AUTH=1). e2e_seller is seeded kycStatus
 * VERIFIED so the trust badge renders on its gig.
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

test("verified badge shows on a verified seller's gig", async ({ page }) => {
  await page.goto("/uz/gigs/e2e-gig");
  await expect(page.getByText("Tasdiqlangan").first()).toBeVisible();
});

test("reorder: places a fresh order for the same gig", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const firstId = buyer.url().split("/orders/")[1];
  const origin = new URL(buyer.url()).origin;

  const res = await buyer.request.post(`/api/orders/${firstId}`, {
    headers: { Origin: origin },
    data: { action: "reorder" },
  });
  const j = await res.json();
  expect(j.ok, JSON.stringify(j)).toBeTruthy();
  expect(j.data.orderId).toBeTruthy();
  expect(j.data.orderId).not.toBe(firstId);

  await ctx.close();
});
