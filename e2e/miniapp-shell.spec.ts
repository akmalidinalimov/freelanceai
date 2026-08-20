import { test, expect, type Page } from "@playwright/test";

/**
 * Telegram Mini App shell (Phase 1).
 *
 * Telegram's WebView cannot be driven by Playwright, so these test the CONTRACT the code actually
 * depends on: the server marker, and the client's verification against the real SDK.
 *
 * Two of these are not optional:
 *   - "no marker -> chrome present" is the regression guard for every existing web visitor.
 *   - "marker but no SDK -> chrome restored" is the defect review found: a page with our chrome
 *     suppressed and no Telegram controls has no navigation at all.
 */

const PHONE = { width: 390, height: 844 };
const HEADER = "header";
const NAV = 'nav[aria-label="Primary"]';

/** Install a fake Telegram WebApp before any app code runs. */
async function stubTelegram(page: Page, opts: { initData: string; version?: string }) {
  await page.addInitScript(
    ({ initData, version }) => {
      (window as unknown as { Telegram: unknown }).Telegram = {
        WebApp: {
          initData,
          version: version ?? "7.0",
          isVersionAtLeast: () => true,
          ready() {},
          expand() {},
          setHeaderColor() {},
          setBackgroundColor() {},
          setBottomBarColor() {},
          onEvent() {},
          offEvent() {},
          viewportStableHeight: 700,
          BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
          HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
        },
      };
    },
    { initData: opts.initData, version: opts.version }
  );
}

test("REGRESSION: a plain web visitor keeps the full chrome", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/uz/gigs");

  await expect(page.locator(HEADER).first()).toBeVisible();
  await expect(page.locator(NAV)).toBeVisible();
  await expect(page.getByText("Gigora").first()).toBeVisible();
});

test("bot link: the marker suppresses our chrome and is stripped from the URL", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // A real Mini App launch: the bot's marked URL, with Telegram present.
  await stubTelegram(page, { initData: "auth_date=1&hash=deadbeef" });
  await page.goto("/uz/gigs?tgapp=1");

  // The param must not survive — otherwise it travels when a user copies the address.
  await expect(page).toHaveURL(/\/uz\/gigs$/);

  await expect(page.locator(HEADER)).toHaveCount(0);
  await expect(page.locator(NAV)).toHaveCount(0);
  // Content still renders; only the chrome is gone.
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();

  // And the marker persists across in-app navigation via the cookie.
  await page.goto("/uz/search");
  await expect(page.locator(HEADER)).toHaveCount(0);
});

test("TRAP FIX: marker set but no Telegram SDK restores the chrome", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // Someone copied a ?tgapp=1 URL out of the Mini App and opened it in a normal browser.
  // Without the correction they would have no header, no bottom nav, and no Telegram back
  // button — no way to navigate at all.
  await page.goto("/uz/gigs?tgapp=1");

  await expect(page.locator(HEADER).first(), "chrome must come back").toBeVisible({ timeout: 10_000 });
  await expect(page.locator(NAV)).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "gigora_tgapp"), "the lying cookie must be cleared").toBeUndefined();
});

test("an empty initData is NOT treated as Telegram", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // telegram-web-app.js loads in ordinary browsers too and exposes an EMPTY initData. Treating
  // that as a Mini App would strip the chrome from regular web visitors.
  await stubTelegram(page, { initData: "" });
  await page.goto("/uz/gigs?tgapp=1");

  await expect(page.locator(HEADER).first()).toBeVisible({ timeout: 10_000 });
});

test("an ancient Telegram client renders instead of throwing", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Pre-6.0: no isVersionAtLeast, no BackButton, no colour setters. Every guarded call must no-op.
  await page.addInitScript(() => {
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: { initData: "auth_date=1&hash=old", ready() {}, expand() {} },
    };
  });
  await page.goto("/uz/gigs?tgapp=1");

  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
  expect(errors, `no uncaught errors:\n${errors.join("\n")}`).toHaveLength(0);
});

test("tdesktop case: initData present but NO marker cookie still hides our chrome", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // Reproduces what the founder measured on Telegram Desktop 9.6: initData present and 2s fresh,
  // marker cookie absent because that webview did not keep it. The server therefore rendered our
  // header and bottom nav INSIDE Telegram. Suppression must not depend on the cookie.
  await stubTelegram(page, { initData: "auth_date=1&hash=deadbeef" });
  await page.goto("/uz/gigs"); // deliberately NO ?tgapp=1 and no cookie

  await expect(page.locator(HEADER)).toBeHidden();
  await expect(page.locator(NAV)).toBeHidden();
  // Content must survive — only the chrome goes.
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
});

test("a plain web visitor is untouched by the client-side suppression", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // The same code path runs for everyone, so prove it stays inert without Telegram.
  await page.goto("/uz/gigs");
  await expect(page.locator(HEADER).first()).toBeVisible();
  await expect(page.locator(NAV)).toBeVisible();
});
