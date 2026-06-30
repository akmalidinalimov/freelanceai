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

  // Admin confirms (manual) payment → order moves into work.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto(orderUrl);
  await Promise.all([
    admin.waitForResponse((r) => r.url().includes("/api/orders/") && r.request().method() === "POST"),
    admin.getByRole("button", { name: "Toʻlov qabul qilindi" }).click(),
  ]);

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

  // Seller replies to the review on their gig.
  await seller.goto("/uz/gigs/e2e-gig");
  await seller.getByRole("button", { name: "Javob berish" }).first().click();
  await seller.getByPlaceholder("Javob yozing...").fill("Thank you for your order!");
  await seller.getByRole("button", { name: "Javob yuborish" }).click();
  await expect(seller.getByText("Ijrochi javobi")).toBeVisible();

  // Buyer tips the seller on the completed order (preset; regex avoids number-format issues).
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: /\+10/ }).click();
  await expect(buyer.getByText("Rahmat! Choychaqa yuborildi.")).toBeVisible();

  // Seller has in-app notifications from the order events (e.g. the new review).
  await seller.goto("/uz/notifications");
  await expect(seller.getByText("Yangi sharh")).toBeVisible();

  await buyerCtx.close();
  await sellerCtx.close();
  await adminCtx.close();
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

test("contact freelancer: buyer messages a seller directly", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Bogʻlanish" }).click();
  await buyer.waitForURL(/\/uz\/messages\/.+/);
  await buyer.getByPlaceholder("Xabar yozing...").fill("Hi, I have a question");
  await buyer.getByRole("button", { name: "Yuborish" }).click();
  await expect(buyer.getByText("Hi, I have a question")).toBeVisible();
  await ctx.close();
});

test("admin can open the settlements console", async ({ browser }) => {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto("/uz/admin/settlements");
  await expect(admin.getByRole("heading", { name: "Hisob-kitoblar" })).toBeVisible();
  await ctx.close();
});

test("dispute: buyer disputes → admin refunds → order cancelled", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const orderUrl = buyer.url();

  // Admin confirms payment so the order is active.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto(orderUrl);
  await Promise.all([
    admin.waitForResponse((r) => r.url().includes("/api/orders/") && r.request().method() === "POST"),
    admin.getByRole("button", { name: "Toʻlov qabul qilindi" }).click(),
  ]);

  // Buyer opens a dispute.
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Muammo haqida xabar berish" }).click();
  await buyer.getByPlaceholder("Muammoni tasvirlang...").fill("Not as described, please refund.");
  await buyer.getByRole("button", { name: "Nizo ochish" }).click();
  await expect(buyer.getByText(/chiqmoqda/).first()).toBeVisible();

  // Admin refunds → order becomes cancelled. Wait for the refund POST to finish (the click
  // dispatches the fetch but doesn't await it) before reading the buyer's order.
  await admin.goto("/uz/admin/disputes");
  await Promise.all([
    admin.waitForResponse(
      (r) => r.url().includes("/api/admin/disputes/") && r.request().method() === "POST"
    ),
    admin.getByRole("button", { name: "Buyurtmachiga qaytarish" }).first().click(),
  ]);
  await buyer.goto(orderUrl);
  await expect(buyer.getByText("Bekor qilingan").first()).toBeVisible({ timeout: 15000 });

  await buyerCtx.close();
  await adminCtx.close();
});

test("realtime: a sent message appears on the other party's open thread via SSE", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Bogʻlanish" }).click();
  await buyer.waitForURL(/\/uz\/messages\/.+/);
  const convoUrl = buyer.url();

  // Seller opens the same conversation; give the EventSource a moment to connect.
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto(convoUrl);
  await seller.waitForTimeout(2000);

  // Buyer sends; the seller receives it pushed over SSE without reloading the page.
  // 15s < the 20s fallback poll, so a pass here proves the SSE path specifically.
  await buyer.getByPlaceholder("Xabar yozing...").fill("realtime via sse");
  await buyer.getByRole("button", { name: "Yuborish" }).click();
  await expect(seller.getByText("realtime via sse")).toBeVisible({ timeout: 15000 });

  await buyerCtx.close();
  await sellerCtx.close();
});

test("moderation: a new gig is PENDING then admin approves it", async ({ browser }) => {
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/dashboard");
  const origin = new URL(seller.url()).origin;
  // base36 suffix (alphanumeric) so the sanitizer doesn't redact it as a phone number.
  const title = `E2E moderation gig ${Date.now().toString(36)}`;
  const res = await seller.request.post("/api/gigs", {
    headers: { Origin: origin },
    data: {
      title,
      description: "A seeded gig used to exercise the moderation approval flow end to end.",
      packages: [{ tier: "BASIC", title: "Basic", priceUzs: 50000, deliveryDays: 2, revisions: 1 }],
    },
  });
  expect(res.ok(), `create gig -> ${res.status()}`).toBeTruthy();

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto("/uz/admin/moderation");
  await expect(admin.getByText(title)).toBeVisible();
  await admin.getByRole("button", { name: "Tasdiqlash" }).first().click();
  await expect(admin.getByText(title)).toHaveCount(0);

  await sellerCtx.close();
  await adminCtx.close();
});

test("gig editing: seller creates then edits a gig; the edit form reflects the change", async ({ browser }) => {
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/dashboard");
  const origin = new URL(seller.url()).origin;

  const title = `E2E edit gig ${Date.now().toString(36)}`;
  const created = await seller.request.post("/api/gigs", {
    headers: { Origin: origin },
    data: {
      title,
      description: "A gig created to exercise the editing flow from end to end.",
      packages: [{ tier: "BASIC", title: "Basic", priceUzs: 50000, deliveryDays: 2, revisions: 1 }],
    },
  });
  expect(created.ok(), `create -> ${created.status()}`).toBeTruthy();
  const id = (await created.json()).data.id as string;

  const newTitle = `${title} EDITED`;
  const edited = await seller.request.patch(`/api/gigs/${id}`, {
    headers: { Origin: origin },
    data: {
      title: newTitle,
      description: "An edited description that is comfortably long enough to validate.",
      packages: [{ tier: "BASIC", title: "Basic", priceUzs: 75000, deliveryDays: 3, revisions: 2 }],
    },
  });
  expect(edited.ok(), `edit -> ${edited.status()}`).toBeTruthy();

  // The owner edit page is pre-filled with the new title (works regardless of gig status).
  await seller.goto(`/uz/dashboard/seller/gigs/${id}/edit`);
  await expect(seller.getByPlaceholder("Masalan: Men professional AI video yarataman")).toHaveValue(newTitle);

  await sellerCtx.close();
});

test("coupon: admin creates a code, buyer orders with it, discount shows on the order", async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto("/uz/dashboard");
  const adminOrigin = new URL(admin.url()).origin;
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  const made = await admin.request.post("/api/admin/coupons", {
    headers: { Origin: adminOrigin },
    data: { code, percentOff: 10 },
  });
  expect(made.ok(), `coupon -> ${made.status()}`).toBeTruthy();

  // Buyer orders e2e-gig with the coupon via the order panel.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByPlaceholder("Promo-kod (ixtiyoriy)").fill(code);
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  // The order page shows the applied discount line.
  await expect(buyer.getByText(/Chegirma/)).toBeVisible();

  await adminCtx.close();
  await buyerCtx.close();
});
