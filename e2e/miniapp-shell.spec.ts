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

test("bot link: the marker strips the URL and hides only DUPLICATED chrome", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // A real Mini App launch: the bot's marked URL, with Telegram present.
  await stubTelegram(page, { initData: "auth_date=1&hash=deadbeef" });
  await page.goto("/uz/gigs?tgapp=1");

  // The param must not survive — otherwise it travels when a user copies the address.
  await expect(page).toHaveURL(/\/uz\/gigs$/);

  // The header STAYS: it carries the account menu, and Telegram draws no account controls.
  // Hiding it left a signed-out user with no route to login at all (reported from tdesktop 9.6).
  await expect(page.locator(HEADER).first()).toBeVisible();
  await expect(page.locator('[data-miniapp-hide]').first()).toBeHidden(); // the brand IS duplicated
  // The bottom nav STAYS too — Telegram supplies no app navigation.
  await expect(page.locator(NAV)).toBeVisible();
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
});

test("TRAP FIX: marker set but no Telegram SDK restores the full chrome", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // Someone copied a ?tgapp=1 URL out of the Mini App and opened it in a normal browser.
  // Without the correction they would have no header, no bottom nav, and no Telegram back
  // button — no way to navigate at all.
  await page.goto("/uz/gigs?tgapp=1");

  await expect(page.locator(HEADER).first(), "chrome must come back").toBeVisible({ timeout: 10_000 });
  await expect(page.locator(NAV)).toBeVisible();

  // Poll rather than read once: the header is now always rendered, so its visibility no longer
  // gates on the correction having run. Asserting immediately would race the effect.
  await expect(async () => {
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "gigora_tgapp"), "the lying cookie must be cleared").toBeUndefined();
  }).toPass({ timeout: 10_000 });
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

  // Only the duplicated brand hides; the account menu and navigation must remain reachable.
  await expect(page.locator('[data-miniapp-hide]').first()).toBeHidden();
  await expect(page.locator(HEADER).first()).toBeVisible();
  await expect(page.locator(NAV)).toBeVisible();
  await expect(page.getByPlaceholder("Xizmat qidirish...")).toBeVisible();
});

test("a plain web visitor is untouched by the client-side suppression", async ({ page }) => {
  await page.setViewportSize(PHONE);
  // The same code path runs for everyone, so prove it stays inert without Telegram.
  await page.goto("/uz/gigs");
  await expect(page.locator(HEADER).first()).toBeVisible();
  await expect(page.locator(NAV)).toBeVisible();
});

test("a Mini App user can always reach login and logout", async ({ page }) => {
  // The regression that prompted this: with the header hidden there was no hamburger, so a
  // signed-out user inside Telegram had no way to sign in and a signed-in one no way to sign out.
  await page.setViewportSize(PHONE);
  await stubTelegram(page, { initData: "auth_date=1&hash=deadbeef" });
  await page.goto("/uz/gigs?tgapp=1");

  const menu = page.locator("header button").last();
  await expect(menu, "the hamburger must exist inside Telegram").toBeVisible();
  await menu.click();
  await expect(page.getByRole("link", { name: /Kirish|Login|Войти/i }).first()).toBeVisible();
});
