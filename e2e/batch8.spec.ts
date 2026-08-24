import crypto from "crypto";
import { test, expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { loginAs } from "./helpers";

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

/** Buyer places an order on the seeded gig and returns its URL + id (PENDING_PAYMENT). */
async function placeOrder(browser: Browser) {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const url = buyer.url();
  const id = url.split("/orders/")[1];
  return { ctx, buyer, url, id, origin: new URL(url).origin };
}

/** Assert the order has moved into work: the seller sees the delivery UI. */
async function expectOrderActive(browser: Browser, orderUrl: string) {
  const ctx = await browser.newContext();
  const seller = await ctx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto(orderUrl);
  await expect(seller.getByPlaceholder("Buyurtmachi uchun xabar...")).toBeVisible();
  await ctx.close();
}

/**
 * Batch 8 authenticated happy-paths. Same gating + fixtures as authenticated.spec.ts
 * (E2E_TEST_AUTH=1 + e2e seed: e2e_buyer, e2e_seller, e2e_admin).
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

test("admin KYC: a user submits a phone, admin approves it", async ({ browser }) => {
  // Buyer submits a phone number → kycStatus NONE → PENDING.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/dashboard");
  const origin = new URL(buyer.url()).origin;
  const phone = "+998900000001";
  const res = await buyer.request.patch("/api/me/settings", {
    headers: { Origin: origin },
    data: { phone },
  });
  expect(res.ok(), `submit phone -> ${res.status()}`).toBeTruthy();

  // Admin sees the pending user and approves them.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto("/uz/admin/kyc");
  await expect(admin.getByText(phone)).toBeVisible();

  await admin
    .getByRole("row")
    .filter({ hasText: phone })
    .getByRole("button", { name: "Approve" })
    .click();

  // Approved → no longer in the pending list.
  await expect(admin.getByText(phone)).toHaveCount(0);

  await buyerCtx.close();
  await adminCtx.close();
});

test("kyc verify: request an email code and confirm → verified", async ({ browser }) => {
  const ctx = await browser.newContext();
  const u = await ctx.newPage();
  await loginAs(u, "e2e_verify"); // seeded with an email channel
  await u.goto("/uz/dashboard");
  const origin = new URL(u.url()).origin;

  // Request a code (E2E_TEST_AUTH=1 → the API returns the code so the test can use it).
  const reqRes = await u.request.post("/api/me/verify", {
    headers: { Origin: origin },
    data: { action: "requestEmailCode" },
  });
  const reqJson = await reqRes.json();
  expect(reqJson.ok, JSON.stringify(reqJson)).toBeTruthy();
  const code = reqJson.data.code as string;
  expect(code).toMatch(/^\d{6}$/);

  // A wrong code is rejected.
  const bad = await u.request.post("/api/me/verify", {
    headers: { Origin: origin },
    data: { action: "verifyCode", code: code === "000000" ? "111111" : "000000" },
  });
  expect((await bad.json()).ok).toBeFalsy();

  // The right code verifies.
  const ok = await u.request.post("/api/me/verify", {
    headers: { Origin: origin },
    data: { action: "verifyCode", code },
  });
  const okJson = await ok.json();
  expect(okJson.data?.verified, JSON.stringify(okJson)).toBe(true);

  await ctx.close();
});

test("payme webhook: Create→Perform settles the order", async ({ browser }) => {
  test.skip(!process.env.PAYME_KEY, "needs PAYME_KEY");
  const { ctx, url, id } = await placeOrder(browser);
  const page = await ctx.newPage();
  const auth = "Basic " + Buffer.from(`Paycom:${process.env.PAYME_KEY}`).toString("base64");
  const amount = 50000 * 100; // tiyin; seeded BASIC = 50000 UZS, no discount
  const paymeId = `e2e-payme-${Date.now()}`;
  const rpc = (method: string, params: Record<string, unknown>) =>
    page.request.post("/api/payments/payme", { headers: { Authorization: auth }, data: { id: 1, method, params } });

  let j = await (await rpc("CheckPerformTransaction", { amount, account: { order_id: id } })).json();
  expect(j.result?.allow, JSON.stringify(j)).toBe(true);

  j = await (await rpc("CreateTransaction", { id: paymeId, time: Date.now(), amount, account: { order_id: id } })).json();
  expect(j.result?.state).toBe(1);

  j = await (await rpc("PerformTransaction", { id: paymeId })).json();
  expect(j.result?.state).toBe(2);

  await expectOrderActive(browser, url);
  await ctx.close();
});

test("click webhook: Prepare→Complete settles the order", async ({ browser }) => {
  test.skip(!process.env.CLICK_SECRET_KEY, "needs CLICK_SECRET_KEY");
  const { ctx, url, id } = await placeOrder(browser);
  const page = await ctx.newPage();
  const secret = process.env.CLICK_SECRET_KEY!;
  const serviceId = process.env.CLICK_SERVICE_ID ?? "svc";
  const ctid = `${Date.now()}`;
  const signTime = "2026-01-01 00:00:00";

  const sign = (p: Record<string, string>) =>
    md5(
      p.click_trans_id +
        p.service_id +
        secret +
        p.merchant_trans_id +
        (p.action === "1" ? p.merchant_prepare_id : "") +
        p.amount +
        p.action +
        p.sign_time
    );

  const prepare: Record<string, string> = {
    click_trans_id: ctid,
    service_id: serviceId,
    merchant_trans_id: id,
    amount: "50000",
    action: "0",
    sign_time: signTime,
  };
  prepare.sign_string = sign(prepare);
  let j = await (await page.request.post("/api/payments/click", { form: prepare })).json();
  expect(j.error, JSON.stringify(j)).toBe(0);

  const complete: Record<string, string> = {
    ...prepare,
    action: "1",
    merchant_prepare_id: String(j.merchant_prepare_id),
    error: "0",
  };
  complete.sign_string = sign(complete);
  j = await (await page.request.post("/api/payments/click", { form: complete })).json();
  expect(j.error, JSON.stringify(j)).toBe(0);

  await expectOrderActive(browser, url);
  await ctx.close();
});
