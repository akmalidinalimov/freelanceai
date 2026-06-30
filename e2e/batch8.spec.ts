import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

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
