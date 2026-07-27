import crypto from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * Sign in as a seeded user through the gated `e2e` credentials provider.
 * Uses the Auth.js CSRF flow; page.request shares the browser context's cookie jar,
 * so subsequent page.goto() calls are authenticated.
 */
export async function loginAs(page: Page, userId: string) {
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/e2e", {
    form: { csrfToken: csrf.csrfToken, userId, callbackUrl: "/", json: "true" },
  });
}

/**
 * Build Telegram Mini App initData signed exactly as Telegram signs it: an HMAC-SHA256 over the
 * sorted data-check-string, keyed by HMAC-SHA256(botToken, "WebAppData"). Lets a test register a
 * REAL new account through the production `telegram-miniapp` provider (which upserts by
 * telegramId) instead of impersonating a pre-seeded row — that provider is how most Gigora
 * users actually sign up, so it is the path worth covering.
 */
export function signTelegramInitData(
  user: { id: string; firstName: string; lastName?: string; username?: string },
  botToken: string
): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAF${crypto.randomBytes(6).toString("hex")}`,
    user: JSON.stringify({
      id: Number(user.id),
      first_name: user.firstName,
      last_name: user.lastName ?? "",
      username: user.username ?? "",
      language_code: "uz",
    }),
  };
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

/** Register/sign in through the Telegram Mini App provider (creates the account on first use). */
export async function loginViaTelegram(
  page: Page,
  user: { id: string; firstName: string; lastName?: string; username?: string },
  botToken: string
) {
  const initData = signTelegramInitData(user, botToken);
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  const res = await page.request.post("/api/auth/callback/telegram-miniapp", {
    form: { csrfToken: csrf.csrfToken, initData, callbackUrl: "/", json: "true" },
  });
  return res;
}
