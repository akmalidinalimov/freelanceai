import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * The stepped gig-creation flow. Covers the two mechanisms a first-time seller depends on to
 * publish something sane without inventing numbers: the per-step gate (nothing reaches "publish"
 * missing what the API requires) and the one-tap category template (prices, delivery, revisions,
 * buyer questions and upsells). Both are seller-facing regressions that a unit test can't catch,
 * because they live in the step wiring rather than in the template data.
 */
test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");

const TITLE_PH = "Masalan: Men professional AI video yarataman";
const DESC_PH = "Xizmatingizni batafsil tasvirlab bering...";

test("gig wizard: the step gate blocks an incomplete step, then a category template fills the packages", async ({
  page,
}) => {
  await loginAs(page, "e2e_seller");
  await page.goto("/uz/dashboard/seller/gigs/new");

  // The AI wizard is the landing view; this spec exercises the hand-made path behind it.
  await page.getByRole("button", { name: "Boshidan yaratish" }).click();

  // Four named steps, so the seller can always see how much is left.
  for (const step of ["1. Xizmat", "2. Namunalar", "3. Narx", "4. Yakunlash"]) {
    await expect(page.getByRole("button", { name: step })).toBeVisible();
  }

  // Gate: an empty first step cannot advance, and it says why.
  const next = page.getByRole("button", { name: "Keyingi →" });
  await expect(next).toBeDisabled();
  await expect(page.getByText("Davom etish uchun yuqoridagi maydonlarni to‘ldiring")).toBeVisible();

  // A title alone is still not enough — the description carries the buyer's decision.
  await page.getByPlaceholder(TITLE_PH).fill("AI promo video 15s");
  await expect(next).toBeDisabled();
  await page
    .getByPlaceholder(DESC_PH)
    .fill("Brendingiz uchun 15 soniyalik AI promo video tayyorlayman — ssenariy, montaj va musiqa bilan.");
  await expect(next).toBeEnabled();

  // Category drives which template is offered. Scoped by label: the page header has its own
  // language <select>, so an unscoped locator picks the wrong one.
  await page.getByLabel("Yoʻnalish").selectOption({ label: "AI video" });

  await next.click();
  // Step 2 asks for samples OF THIS SERVICE, and accepts video (an AI-video seller's only proof).
  await expect(page.getByText("SHU xizmat namunalari (rasm yoki video)")).toBeVisible();

  await next.click();
  // Step 3 offers the AI-video template; one tap fills the whole ladder.
  await expect(page.getByText("Tayyor shablondan foydalanamizmi?")).toBeVisible();
  await page.getByRole("button", { name: "✨ Shablon bilan toʻldirish" }).click();

  await expect(page.getByLabel("Basic — Narx (so'm)")).toHaveValue("150000");
  await expect(page.getByLabel("Basic — Muddat (kun)")).toHaveValue("3");
  await expect(page.getByLabel("Basic — Tahrirlar")).toHaveValue("1");
  await expect(page.getByLabel("Standard — Narx (so'm)")).toHaveValue("300000");
  await expect(page.getByLabel("Premium — Narx (so'm)")).toHaveValue("600000");

  await next.click();
  // Advancing must NOT publish. Regression: React reconciled the Next button into the type="submit"
  // Publish button, so this click flipped the live node's type mid-click and the browser submitted —
  // the gig went live from the price step, skipping this one.
  await expect(page).toHaveURL(/\/dashboard\/seller\/gigs\/new/);
  // The template also supplies the questions to ask a buyer — the part sellers leave empty.
  await expect(page.getByLabel("Savol (masalan: Brend rangi?)").first()).toHaveValue(
    "Mahsulot yoki xizmatingiz nima?"
  );

  // Publishing lands on the seller dashboard; the gig itself goes to review, not straight live.
  await page.getByRole("button", { name: "Eʼlon qilish" }).click();
  await page.waitForURL(/\/dashboard\/seller\?published=1/);
});

test("gig wizard: a template never overwrites prices the seller already typed", async ({ page }) => {
  await loginAs(page, "e2e_seller");
  await page.goto("/uz/dashboard/seller/gigs/new");
  await page.getByRole("button", { name: "Boshidan yaratish" }).click();

  await page.getByPlaceholder(TITLE_PH).fill("AI promo video 15s");
  await page
    .getByPlaceholder(DESC_PH)
    .fill("Brendingiz uchun 15 soniyalik AI promo video tayyorlayman — ssenariy, montaj va musiqa bilan.");
  await page.getByLabel("Yoʻnalish").selectOption({ label: "AI video" });

  const next = page.getByRole("button", { name: "Keyingi →" });
  await next.click();
  await next.click();

  // Seller's own price first, then the template: their number must survive.
  await page.getByLabel("Basic — Narx (so'm)").fill("222000");
  await page.getByRole("button", { name: "✨ Shablon bilan toʻldirish" }).click();
  await expect(page.getByLabel("Basic — Narx (so'm)")).toHaveValue("222000");
  // Tiers the seller left empty still get filled.
  await expect(page.getByLabel("Standard — Narx (so'm)")).toHaveValue("300000");
});
