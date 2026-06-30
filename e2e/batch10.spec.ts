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

test("seller payout request: complete an order, seller requests, admin fulfils", async ({ browser }) => {
  // Buyer orders → admin confirms → seller delivers → buyer accepts (COMPLETED gives the seller a balance).
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const orderUrl = buyer.url();

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto(orderUrl);
  await Promise.all([
    admin.waitForResponse((r) => r.url().includes("/api/orders/") && r.request().method() === "POST"),
    admin.getByRole("button", { name: "Toʻlov qabul qilindi" }).click(),
  ]);

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto(orderUrl);
  await seller.getByPlaceholder("Buyurtmachi uchun xabar...").fill("Delivered.");
  await seller.getByRole("button", { name: "Topshirish" }).click();
  await expect(seller.getByText("Topshirilgan").first()).toBeVisible();

  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Qabul qilish va yakunlash" }).click();
  await expect(buyer.getByText("Yakunlangan").first()).toBeVisible();

  // Seller requests a payout of their available balance.
  const origin = new URL(orderUrl).origin;
  const reqRes = await seller.request.post("/api/me/payout", { headers: { Origin: origin }, data: {} });
  const reqJson = await reqRes.json();
  expect(reqJson.ok, JSON.stringify(reqJson)).toBeTruthy();

  // Admin sees the request on the settlements console and marks it paid.
  await admin.goto("/uz/admin/settlements");
  await expect(admin.getByText("Toʻlov soʻrovlari")).toBeVisible();
  await Promise.all([
    admin.waitForResponse((r) => r.url().includes("/api/admin/payout-requests")),
    admin.getByRole("button", { name: "Mark paid" }).first().click(),
  ]);

  await buyerCtx.close();
  await adminCtx.close();
  await sellerCtx.close();
});
