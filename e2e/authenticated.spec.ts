import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Logged-in happy-paths. Requires the gated test-login (E2E_TEST_AUTH=1) and the
 * E2E seed (e2e_buyer, e2e_seller, gig "e2e-gig"). Runs in CI (Postgres service) or
 * locally against a DB; skipped otherwise so the public suite still runs anywhere.
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

test("order lifecycle: place → deliver → accept → review", async ({ browser }) => {
  // Buyer places an order.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const orderUrl = buyer.url();

  // Seller delivers.
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto(orderUrl);
  await seller.getByPlaceholder("Buyurtmachi uchun xabar...").fill("Your video is ready.");
  await seller.getByRole("button", { name: "Topshirish" }).click();
  await expect(seller.getByText("Topshirilgan").first()).toBeVisible();

  // Buyer accepts → completed.
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Qabul qilish va yakunlash" }).click();
  await expect(buyer.getByText("Yakunlangan").first()).toBeVisible();

  // Buyer leaves a 5-star review.
  await buyer.locator('button[aria-label="5"]').click();
  await buyer.getByRole("button", { name: "Sharh yuborish" }).click();
  await expect(buyer.getByText("Sizning sharhingiz")).toBeVisible();

  await buyerCtx.close();
  await sellerCtx.close();
});

test("messaging: buyer sends, seller sees it on the order", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const orderUrl = buyer.url();

  await buyer.getByPlaceholder("Xabar yozing...").fill("Hello from the buyer");
  await buyer.getByRole("button", { name: "Yuborish" }).click();
  await expect(buyer.getByText("Hello from the buyer")).toBeVisible();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto(orderUrl);
  await expect(seller.getByText("Hello from the buyer")).toBeVisible();

  await buyerCtx.close();
  await sellerCtx.close();
});
