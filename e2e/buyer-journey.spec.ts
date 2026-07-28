import { test, expect, type Page } from "@playwright/test";
import { loginAs, loginViaTelegram } from "./helpers";

/**
 * One continuous real-life scenario, driven through the UI by all three parties:
 *
 *   a brand-new buyer  — registers via the Telegram Mini App (the real signup path for this
 *                        market), onboards, searches, asks questions, orders, requests a
 *                        revision, accepts, reviews and tips
 *   the freelancer     — reads the pre-sales question in their inbox and answers it, posts
 *                        progress, delivers, re-delivers after the revision, replies to the review
 *   the admin          — confirms the manual bank payment that moves the order into work
 *
 * Deliberately end-to-end rather than per-feature: the failures that hurt a marketplace live in
 * the handoffs (does the seller actually SEE the question? does a revision reopen the work? does
 * escrow release on acceptance?), and only a full run in one session exercises those.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");
test.skip(!BOT_TOKEN, "needs TELEGRAM_BOT_TOKEN to sign Mini App initData");

/** The cookie banner is fixed to the bottom and can sit over the sticky action bars. */
async function dismissCookieBanner(page: Page) {
  const accept = page.getByRole("button", { name: "Qabul qilish", exact: true });
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

/**
 * Deliver as the seller, then wait until the order really left IN_PROGRESS/REVISION.
 * The deliver handler reloads on success (so waitForResponse gets discarded) and "Topshirilgan"
 * is also a status-tracker label, so the only trustworthy signal is the form going away.
 */
async function deliverWork(seller: Page, note: string) {
  await seller.getByPlaceholder("Buyurtmachi uchun xabar...").fill(note);
  await seller.getByRole("button", { name: "Topshirish" }).click();
  await expect(async () => {
    await seller.reload();
    await expect(seller.getByPlaceholder("Buyurtmachi uchun xabar...")).toHaveCount(0);
  }).toPass({ timeout: 30_000 });
}

test("real-life journey: a new buyer registers, hires the freelancer, and both sides see it through", async ({
  browser,
}) => {
  // A long multi-party session: ~40 navigations across three logged-in contexts.
  test.setTimeout(240_000);

  // Unique Telegram id per run so this is a genuine first-time registration every time
  // (upsertTelegramUser CREATES the account) rather than a re-login as a seeded row.
  const tgId = String(9_100_000_000 + (Date.now() % 100_000_000));
  const buyerName = "Dilnoza";
  // base36 (alphanumeric) so stripContactInfo doesn't redact it as a phone number. Tags this
  // run's enquiry so the inbox assertion can't be satisfied by a previous run's thread.
  const runTag = `ref${Date.now().toString(36)}`;

  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();

  // ─── 1. Registration ────────────────────────────────────────────────────────────────────
  // Signed initData → the production telegram-miniapp provider creates the account.
  const reg = await loginViaTelegram(
    buyer,
    { id: tgId, firstName: buyerName, lastName: "", username: `dilnoza_${tgId.slice(-6)}` },
    BOT_TOKEN
  );
  expect(reg.status(), "Mini App registration").toBe(200);
  const session = await (await buyer.request.get("/api/auth/session")).json();
  expect(session?.user?.id, "a real account was created").toBeTruthy();

  // A not-yet-onboarded user is routed to onboarding exactly once.
  await buyer.goto("/uz");
  await expect(buyer).toHaveURL(/\/uz\/onboarding/);
  await dismissCookieBanner(buyer);

  // ─── 2. Onboarding as a buyer ───────────────────────────────────────────────────────────
  // First name arrives prefilled from Telegram; the surname is the only typing asked of them.
  await expect(buyer.getByLabel("Ism", { exact: true })).toHaveValue(buyerName);
  await buyer.getByLabel("Familiya", { exact: true }).fill("Testova");
  await buyer.getByRole("button", { name: "Ijodkor yollash" }).click();
  // Choosing "hire" drops the buyer straight into the marketplace — no seller questions asked.
  await buyer.waitForURL(/\/uz\/gigs/);

  // ─── 3. Discovery: search, then filter ──────────────────────────────────────────────────
  await buyer.getByPlaceholder("Xizmat qidirish...").fill("promo");
  await buyer.getByRole("button", { name: "Qoʻllash" }).click();
  await expect(buyer).toHaveURL(/[?&]q=promo/);
  const gigLink = buyer.getByRole("link", { name: /E2E test gig/ }).first();
  await expect(gigLink, "the freelancer's gig is findable by search").toBeVisible();
  await gigLink.click();
  await buyer.waitForURL(/\/uz\/gigs\/e2e-gig/);

  // ─── 4. Vetting the freelancer, then following them ─────────────────────────────────────
  await buyer.goto("/uz/creators/e2e_seller");
  await buyer.getByRole("button", { name: "Kuzatish", exact: true }).click();
  await expect(buyer.getByRole("button", { name: "Kuzatilmoqda" })).toBeVisible();

  // ─── 5. Pre-sales question — and the freelancer actually answering it ────────────────────
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Bogʻlanish" }).click();
  await buyer.waitForURL(/\/uz\/messages\/.+/);
  const threadUrl = buyer.url();
  const question = `Salom! ${runTag} — kosmetika brendim uchun 15 soniyalik Reels video kerak. Muddati qancha?`;
  await buyer.getByPlaceholder("Xabar yozing...").fill(question);
  await buyer.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(buyer.getByText(question).first()).toBeVisible();

  // The freelancer's side: the enquiry must be visible in their inbox, not just in the DB.
  await loginAs(seller, "e2e_seller");
  await seller.goto("/uz/messages");
  await dismissCookieBanner(seller);
  // Assert on THIS run's tag, not just the buyer's name: the regression being guarded is a new
  // enquiry falling outside the inbox's take-window on a busy account, and an older thread from
  // the same test buyer would otherwise satisfy a name-only check.
  await expect(seller.getByText(buyerName).first(), "buyer appears in the inbox").toBeVisible();
  await expect(
    seller.getByText(new RegExp(runTag)).first(),
    "THIS enquiry is in the inbox, not truncated away"
  ).toBeVisible();

  await seller.goto(threadUrl);
  await expect(seller.getByText(question).first()).toBeVisible();
  const answer = "Assalomu alaykum! 15 soniyalik Reels 2 kun ichida tayyor boʻladi.";
  await seller.getByPlaceholder("Xabar yozing...").fill(answer);
  await seller.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(seller.getByText(answer).first()).toBeVisible();

  // Buyer reads the reply. Re-fetch rather than assert on a single render: this is a
  // cross-context handoff (the seller's POST just committed), and a one-shot load made this
  // step intermittently flaky. It still fails if the answer never arrives.
  await expect(async () => {
    await buyer.goto(threadUrl);
    await expect(buyer.getByText(answer).first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });

  // ─── 6. Ordering ────────────────────────────────────────────────────────────────────────
  await buyer.goto("/uz/gigs/e2e-gig");
  await buyer.getByRole("button", { name: "Buyurtma berish" }).click();
  await buyer.waitForURL(/\/uz\/orders\/.+/);
  const orderUrl = buyer.url();
  // Unpaid: the buyer is told the money is waiting on confirmation, not that work has begun.
  await expect(buyer.getByText("Toʻlov tasdiqlanishi kutilmoqda", { exact: false }).first()).toBeVisible();

  // ─── 7. Admin confirms the bank transfer → the order enters work ────────────────────────
  await loginAs(admin, "e2e_admin");
  await admin.goto(orderUrl);
  await dismissCookieBanner(admin);
  await Promise.all([
    admin.waitForResponse((r) => r.url().includes("/api/orders/") && r.request().method() === "POST"),
    admin.getByRole("button", { name: "Toʻlov qabul qilindi" }).click(),
  ]);

  // ─── 8. The freelancer works, then delivers ─────────────────────────────────────────────
  await seller.goto(orderUrl);
  // Quick reply → composer → send (how a seller on a phone actually answers).
  await seller.getByRole("button", { name: "Boshladim 👍" }).click();
  await seller.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(seller.getByText("Boshladim 👍").first()).toBeVisible();

  await deliverWork(seller, "Video tayyor! Reels formatida (9:16), musiqa bilan.");

  // ─── 9. The buyer wants a change — a revision reopens the work ──────────────────────────
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Tahrir soʻrash" }).click();
  await buyer
    .getByLabel("Nimani oʻzgartirish kerak?")
    .fill("Logotip juda kichik chiqqan — kattalashtirib bera olasizmi?");
  await buyer.getByRole("button", { name: "Soʻrovni yuborish", exact: true }).click();

  // The seller's deliver form must come BACK — otherwise a revision is a dead end.
  await expect(async () => {
    await seller.goto(orderUrl);
    await expect(seller.getByPlaceholder("Buyurtmachi uchun xabar...")).toHaveCount(1);
  }).toPass({ timeout: 30_000 });
  await deliverWork(seller, "Logotipni kattalashtirdim, yangi versiya tayyor.");

  // ─── 10. Acceptance releases the escrow ─────────────────────────────────────────────────
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Qabul qilish va yakunlash" }).click();
  // Irreversible, so it confirms first.
  await buyer.getByRole("dialog").getByRole("button", { name: "Qabul qilish va yakunlash" }).click();
  await expect(buyer.getByText("Yakunlangan").first()).toBeVisible();

  // ─── 11. Review, the freelancer's public reply, and a tip ───────────────────────────────
  await buyer.locator('button[aria-label="5"]').click();
  await buyer
    .getByPlaceholder("Taassurotingiz bilan boʻlishing (ixtiyoriy)...")
    .fill("Juda tez va sifatli ishladi, izohni ham darrov tuzatdi. Tavsiya qilaman!");
  await buyer.getByRole("button", { name: "Sharh yuborish", exact: true }).click();
  await expect(buyer.getByText("Sizning sharhingiz")).toBeVisible();

  await seller.goto("/uz/gigs/e2e-gig");
  await seller.getByRole("button", { name: "Javob berish" }).first().click();
  await seller.getByPlaceholder("Javob yozing...").fill("Buyurtmangiz uchun rahmat! Yana kutamiz 🙌");
  await seller.getByRole("button", { name: "Javob yuborish", exact: true }).click();
  await expect(seller.getByText("Ijrochi javobi").first()).toBeVisible();

  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: /\+10/ }).click();
  await expect(buyer.getByText("Rahmat! Choychaqa yuborildi.")).toBeVisible();

  // ─── 12. Aftermath: both sides have a record of it ──────────────────────────────────────
  await seller.goto("/uz/notifications");
  await expect(seller.getByText("Yangi sharh").first(), "seller is told about the review").toBeVisible();

  // The buyer's dashboard lists only ACTIVE orders (a finished one correctly drops off), so the
  // record of this purchase is the completed-orders tile. This account is new, so it must read 1.
  await buyer.goto("/uz/dashboard");
  const completedTile = buyer.locator("div").filter({ hasText: /^1Yakunlangan$/ });
  await expect(completedTile, "buyer's dashboard counts 1 completed order").toHaveCount(1);

  await buyerCtx.close();
  await sellerCtx.close();
  await adminCtx.close();
});
