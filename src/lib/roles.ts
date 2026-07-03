import type { UserRole } from "@prisma/client";

/**
 * Admin role is granted ONLY via a server-side allowlist of Telegram IDs
 * (env ADMIN_TELEGRAM_IDS) — never client-selectable. Pure + unit-tested.
 * Until the {USER,ADMIN} rename migration lands, the non-admin tier is BUYER
 * (the default "member" — seller is the separate `isSeller` capability).
 */
export function parseAdminIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Resolve a user's role from the allowlist: in list → ADMIN, else BUYER (member). */
export function resolveRole(telegramId: string, adminIds: Set<string>): UserRole {
  return adminIds.has(telegramId) ? "ADMIN" : "BUYER";
}

/** Live allowlist check by Telegram id — the authoritative admin gate for bot actions. */
export function isAdminTelegramId(telegramId: string | number, raw: string | undefined): boolean {
  return parseAdminIds(raw).has(String(telegramId));
}

/** True when a role transition strips admin (→ revoke that user's sessions). */
export function isDemotion(prev: UserRole | undefined, next: UserRole): boolean {
  return prev === "ADMIN" && next !== "ADMIN";
}
