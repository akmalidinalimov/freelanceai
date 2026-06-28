import "server-only";
import crypto from "crypto";

/**
 * Telegram authentication verification.
 *
 * There are two distinct mechanisms with DIFFERENT secret-key derivations:
 *
 *  - Login Widget (website):  secret = SHA256(bot_token)
 *  - Mini App (initData):     secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *
 * In both cases the signature is:
 *      hash = HMAC_SHA256(key=secret, msg=data_check_string)
 * where data_check_string is the "key=value" pairs (all fields except `hash`),
 * sorted alphabetically by key, joined with "\n".
 *
 * SECURITY: this must only ever run on the server. The bot token is a secret.
 */

export interface TelegramUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authDate: number;
}

// Default replay window: reject auth payloads older than this.
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return token;
}

/** Build the data-check-string from a set of fields, excluding `hash`. */
function buildDataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
}

/** Constant-time hex comparison. Returns false on any length mismatch. */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function isFresh(authDate: number, maxAgeSeconds: number, nowSeconds: number) {
  if (!Number.isFinite(authDate)) return false;
  const age = nowSeconds - authDate;
  // Reject future-dated (clock skew tolerance: 5 min) and too-old payloads.
  return age >= -300 && age <= maxAgeSeconds;
}

function toUser(fields: Record<string, string>): TelegramUser {
  return {
    id: fields.id,
    firstName: fields.first_name || undefined,
    lastName: fields.last_name || undefined,
    username: fields.username || undefined,
    photoUrl: fields.photo_url || undefined,
    authDate: Number(fields.auth_date),
  };
}

export interface VerifyOptions {
  botToken?: string;
  maxAgeSeconds?: number;
  /** Override "now" (seconds) — for testing. */
  nowSeconds?: number;
}

/**
 * Verify Telegram Login Widget data (the object the widget passes to your site).
 * Returns the verified user, or null if the signature/freshness check fails.
 */
export function verifyLoginWidget(
  data: Record<string, string | number | undefined>,
  opts: VerifyOptions = {}
): TelegramUser | null {
  const botToken = opts.botToken ?? getBotToken();
  const maxAge = opts.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  // Normalize: drop null/undefined, stringify everything.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === "") continue;
    fields[k] = String(v);
  }

  const hash = fields.hash;
  if (!hash || !fields.id || !fields.auth_date) return null;

  const dataCheckString = buildDataCheckString(fields);
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const computed = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (!safeHexEqual(computed, hash)) return null;
  if (!isFresh(Number(fields.auth_date), maxAge, now)) return null;

  return toUser(fields);
}

/**
 * Verify Telegram Mini App initData (the raw query-string from
 * `Telegram.WebApp.initData`). Returns the verified user, or null.
 */
export function verifyMiniAppInitData(
  initData: string,
  opts: VerifyOptions = {}
): TelegramUser | null {
  const botToken = opts.botToken ?? getBotToken();
  const maxAge = opts.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  const params = new URLSearchParams(initData);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) fields[k] = v;

  const hash = fields.hash;
  if (!hash || !fields.auth_date) return null;

  const dataCheckString = buildDataCheckString(fields);
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (!safeHexEqual(computed, hash)) return null;
  if (!isFresh(Number(fields.auth_date), maxAge, now)) return null;

  // Mini App carries the user as a JSON string under `user`.
  let userJson: Record<string, unknown> = {};
  try {
    userJson = fields.user ? JSON.parse(fields.user) : {};
  } catch {
    return null;
  }
  if (!userJson.id) return null;

  return {
    id: String(userJson.id),
    firstName: (userJson.first_name as string) || undefined,
    lastName: (userJson.last_name as string) || undefined,
    username: (userJson.username as string) || undefined,
    photoUrl: (userJson.photo_url as string) || undefined,
    authDate: Number(fields.auth_date),
  };
}
