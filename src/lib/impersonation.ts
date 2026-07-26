import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Admin impersonation ("log in as"), the safe way: the admin's own session cookie is
 * NEVER replaced. A separate short-lived, HMAC-signed cookie carries the target user
 * id; getCurrentUser overlays it ONLY when the underlying session belongs to an admin.
 * Exit = delete the cookie — the admin is instantly themselves again. Hard limits:
 * 30-minute expiry baked into the signature, non-admin targets only (enforced at
 * issue AND at resolution), and both start and stop are audit-logged by the API.
 */

export const IMPERSONATION_COOKIE = "gigora_imp";
const TTL_MS = 30 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

const hmac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Signed cookie value for impersonating `targetId` for the next 30 minutes. */
export function signImpersonation(targetId: string): { value: string; maxAgeSeconds: number } {
  const expires = Date.now() + TTL_MS;
  const payload = `${targetId}.${expires}`;
  return { value: `${payload}.${hmac(payload)}`, maxAgeSeconds: Math.floor(TTL_MS / 1000) };
}

/** The target user id, when the cookie verifies and hasn't expired; null otherwise. */
export function verifyImpersonation(value: string | undefined): string | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  try {
    const expected = hmac(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [targetId, expiresStr] = payload.split(".");
  if (!targetId || Date.now() > Number(expiresStr)) return null;
  return targetId;
}

/** The active impersonation target id from the request cookies, if any. */
export async function impersonatedUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return verifyImpersonation(jar.get(IMPERSONATION_COOKIE)?.value);
  } catch {
    return null; // outside a request context
  }
}
