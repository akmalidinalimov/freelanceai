import { test, expect } from "@playwright/test";
import { loginAs, loginViaTelegram } from "./helpers";

/**
 * Bulk account deletion from the admin user list. Deletion here is anonymize-and-close, not a
 * row drop: orders, ledger entries, reviews and messages survive (the counterparty's record and
 * the platform's accounting) while every personal identifier is stripped and access is revoked.
 *
 * Worth an e2e rather than a unit test because the safety of this feature lives in the wiring —
 * the typed confirmation must actually gate the request, and the per-user guards must still run
 * when the action arrives in a batch.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

test.skip(process.env.E2E_TEST_AUTH !== "1", "needs E2E_TEST_AUTH + seeded DB");
test.skip(!BOT_TOKEN, "needs TELEGRAM_BOT_TOKEN to register throwaway accounts");

test("admin bulk delete: typed confirmation gates it, then the selected accounts are closed", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  // Two throwaway accounts, registered for real, sharing a unique searchable name so the admin
  // list can be narrowed to exactly them (base36 → the contact sanitizer won't touch it).
  const tag = `zzdel${Date.now().toString(36)}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const n of [1, 2]) {
    const throwaway = await browser.newContext();
    const p = await throwaway.newPage();
    await loginViaTelegram(
      p,
      { id: String(9_300_000_000 + (Date.now() % 10_000_000) + n), firstName: `${tag}${n}` },
      BOT_TOKEN
    );
    await throwaway.close();
  }

  await loginAs(page, "e2e_admin");
  await page.goto(`/uz/admin/users?q=${tag}`);
  const rows = page.getByRole("checkbox", { name: /tanlash / });
  await expect(rows, "both throwaway accounts are listed").toHaveCount(2);

  await page.getByRole("checkbox", { name: "sahifadagi hammasini tanlash" }).check();
  await page.getByRole("button", { name: /Oʻchirish…/ }).click();

  // The gate: the confirm button stays disabled until DELETE is typed exactly.
  const confirmBtn = page.getByRole("button", { name: /^Oʻchirish 2$/ });
  await expect(confirmBtn, "delete is blocked before confirmation").toBeDisabled();
  await page.getByLabel("Tasdiqlash uchun DELETE deb yozing").fill("delete");
  await expect(confirmBtn, "lowercase must not pass the gate").toBeDisabled();
  await page.getByLabel("Tasdiqlash uchun DELETE deb yozing").fill("DELETE");
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // Both were fresh accounts with no orders, so both delete.
  await expect(page.getByText(/Oʻchirildi: 2/)).toBeVisible();

  // Anonymized: the identifying name is gone, so the same search no longer finds them.
  await page.goto(`/uz/admin/users?q=${tag}`);
  await expect(page.getByRole("checkbox", { name: /tanlash / }), "accounts are closed").toHaveCount(0);

  await ctx.close();
});
