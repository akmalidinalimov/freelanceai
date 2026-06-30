import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Batch 6 authenticated happy-paths: gig drafts, duplication, printable receipt,
 * message attachments, admin category management, notification management.
 * Same gating + fixtures as authenticated.spec.ts (E2E_TEST_AUTH=1 + e2e seed:
 * e2e_seller owns gig "e2e-gig"/"e2e_gig", e2e_buyer, e2e_admin, category "ai-video").
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

test("drafts: seller saves a draft (not public) then publishes it", async ({ browser }) => {
  const ctx = await browser.newContext();
  const seller = await ctx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/dashboard");
  const origin = new URL(seller.url()).origin;

  const title = `E2E draft gig ${Date.now().toString(36)}`;
  const created = await seller.request.post("/api/gigs", {
    headers: { Origin: origin },
    data: {
      title,
      description: "A gig saved as a draft to exercise the draft + publish flow end to end.",
      draft: true,
      packages: [{ tier: "BASIC", title: "Basic", priceUzs: 50000, deliveryDays: 2, revisions: 1 }],
    },
  });
  expect(created.ok(), `create draft -> ${created.status()}`).toBeTruthy();
  const { id, slug } = (await created.json()).data as { id: string; slug: string };

  // A draft is not publicly viewable (getGigBySlug is ACTIVE-only) — even its owner gets 404.
  await seller.goto(`/uz/gigs/${slug}`);
  await expect(seller.getByText("Sahifa topilmadi")).toBeVisible();

  // It shows on the seller dashboard (gig list) with a Publish action.
  await seller.goto("/uz/dashboard/seller");
  await expect(seller.getByText(title)).toBeVisible();

  // Publishing a draft sends it to moderation (PENDING_REVIEW) — the API call succeeds.
  const published = await seller.request.post(`/api/gigs/${id}`, {
    headers: { Origin: origin },
    data: { action: "publish" },
  });
  expect(published.ok(), `publish -> ${published.status()}`).toBeTruthy();

  await ctx.close();
});

test("duplication: seller duplicates a gig into a new draft", async ({ browser }) => {
  const ctx = await browser.newContext();
  const seller = await ctx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/dashboard");
  const origin = new URL(seller.url()).origin;

  const res = await seller.request.post("/api/gigs/e2e_gig", {
    headers: { Origin: origin },
    data: { action: "duplicate" },
  });
  expect(res.ok(), `duplicate -> ${res.status()}`).toBeTruthy();

  // The clone appears on the seller dashboard (gig list) with a "(copy)" suffix.
  await seller.goto("/uz/dashboard/seller");
  await expect(seller.getByText(/\(copy\)/).first()).toBeVisible();

  await ctx.close();
});

test("receipt: a buyer can open the printable receipt for their order", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);

  await buyer.getByRole("link", { name: "Kvitansiya" }).click();
  await buyer.waitForURL(/\/receipt$/);
  await expect(buyer.getByRole("heading", { name: "Kvitansiya" })).toBeVisible();
  await expect(buyer.getByRole("button", { name: "Chop etish" })).toBeVisible();
  // The receipt itemises the gig that was ordered.
  await expect(buyer.getByText(/E2E test gig/)).toBeVisible();

  await ctx.close();
});

test("message attachments: a file-only message is accepted and rendered", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Bogʻlanish" }).click();
  await buyer.waitForURL(/\/uz\/messages\/.+/);
  const convId = buyer.url().split("/messages/")[1];
  const origin = new URL(buyer.url()).origin;

  // Body is optional when at least one attachment is present (Batch 6-6).
  const fileUrl = "https://example.com/e2e-attachment.jpg";
  const sent = await buyer.request.post(`/api/conversations/${convId}/messages`, {
    headers: { Origin: origin },
    data: { fileUrls: [fileUrl] },
  });
  expect(sent.ok(), `attach -> ${sent.status()}`).toBeTruthy();

  // The thread renders the attachment as a link to the file.
  await buyer.reload();
  await expect(buyer.locator(`a[href="${fileUrl}"]`)).toHaveCount(1);

  await ctx.close();
});

test("admin categories: create then delete a category", async ({ browser }) => {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAs(admin, "e2e_admin");
  await admin.goto("/uz/dashboard");
  const origin = new URL(admin.url()).origin;

  const slug = `e2e-cat-${Date.now().toString(36)}`;
  const made = await admin.request.post("/api/admin/categories", {
    headers: { Origin: origin },
    data: { action: "create", slug, nameUz: "E2E kat", nameRu: "E2E кат", nameEn: "E2E cat" },
  });
  expect(made.ok(), `create category -> ${made.status()}`).toBeTruthy();

  // It shows in the admin categories table…
  await admin.goto("/uz/admin/categories");
  await expect(admin.getByText(slug, { exact: true })).toBeVisible();

  // …and can be deleted from the UI (0 gigs → delete is enabled; confirm() is auto-accepted).
  admin.on("dialog", (d) => d.accept());
  await admin
    .locator("tr", { hasText: slug })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(admin.getByText(slug, { exact: true })).toHaveCount(0);

  await ctx.close();
});

test("notifications: a user can delete one and clear all", async ({ browser }) => {
  // Generate a notification for the seller by having the buyer message them.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginAs(buyer, "e2e_buyer");
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Bogʻlanish" }).click();
  await buyer.waitForURL(/\/uz\/messages\/.+/);
  await buyer.getByPlaceholder("Xabar yozing...").fill("notification trigger");
  await buyer.getByRole("button", { name: "Yuborish" }).click();
  await expect(buyer.getByText("notification trigger")).toBeVisible();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/notifications");

  const rows = seller.locator('li:has(button[aria-label="Oʻchirish"])');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();

  // Delete one → optimistic removal (client-side, so it's not racy with parallel tests).
  await seller.locator('button[aria-label="Oʻchirish"]').first().click();
  await expect(rows).toHaveCount(n - 1);

  // Clear all → empty state.
  if (n - 1 > 0) {
    await seller.getByRole("button", { name: "Hammasini tozalash" }).click();
  }
  await expect(seller.getByText("Hozircha bildirishnoma yoʻq.")).toBeVisible();

  await buyerCtx.close();
  await sellerCtx.close();
});
