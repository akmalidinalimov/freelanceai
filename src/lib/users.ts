import "server-only";
import { prisma } from "@/lib/prisma";
import type { TelegramUser } from "@/lib/telegram";
import type { Prisma, User } from "@prisma/client";
import { parseAdminIds, resolveRole } from "@/lib/roles";
import { foldToLatin } from "@/lib/translit";

/** Normalize a candidate handle: latin-fold, lowercase, [a-z0-9_], 3–32 chars; null if too short. */
function usernameBase(raw: string | null | undefined): string | null {
  const s = foldToLatin(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 32);
  return s.length >= 3 ? s : null;
}

/**
 * Best-effort: give the user a storefront handle (gigora.ai/@username) when they have
 * none. Email/Google signups and Telegram accounts without a public username get one
 * derived from their email prefix or name. Called at the login moment, so existing
 * accounts backfill lazily on their next sign-in. Never throws — a login must never
 * fail over a vanity handle.
 */
export async function ensureUsername(userId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true, firstName: true, name: true },
    });
    if (!u || u.username) return;
    const base =
      usernameBase(u.email?.split("@")[0]) ??
      usernameBase(u.firstName ?? u.name) ??
      `user${userId.slice(-6).toLowerCase()}`;
    // Find a free handle: base, base2…base20, then an id-suffixed fallback.
    const candidates = [base, ...Array.from({ length: 19 }, (_, i) => `${base}${i + 2}`)];
    let pick: string | null = null;
    for (const c of candidates) {
      const taken = await prisma.user.findFirst({ where: { username: c }, select: { id: true } });
      if (!taken) {
        pick = c;
        break;
      }
    }
    pick ??= `${base}_${userId.slice(-4).toLowerCase()}`;
    await prisma.user.update({ where: { id: userId }, data: { username: pick } });
  } catch {
    // best-effort by design
  }
}

/**
 * Create/refresh a User from a verified Telegram identity, applying the admin
 * allowlist. New users are onboarded immediately (Fiverr-style: everyone is a buyer;
 * selling is the opt-in `isSeller` capability). Admin only via ADMIN_TELEGRAM_IDS.
 * Accepts a transaction client so it can run atomically with token consumption.
 */
export async function upsertTelegramUser(
  tg: TelegramUser,
  db: Prisma.TransactionClient = prisma
): Promise<User> {
  const targetRole = resolveRole(tg.id, parseAdminIds(process.env.ADMIN_TELEGRAM_IDS));
  return db.user.upsert({
    where: { telegramId: tg.id },
    update: {
      username: tg.username,
      firstName: tg.firstName,
      lastName: tg.lastName,
      photoUrl: tg.photoUrl,
      role: targetRole,
    },
    create: {
      telegramId: tg.id,
      username: tg.username,
      firstName: tg.firstName,
      lastName: tg.lastName,
      photoUrl: tg.photoUrl,
      role: targetRole,
      onboardingCompleted: true,
    },
  });
}

/**
 * Create/refresh a User from a verified email (magic-link login). The email is only
 * reached here AFTER a single-use token was consumed, so it is treated as verified.
 * Never elevates role: a pre-existing account (e.g. a Google user with the same
 * verified email) keeps its role/isSeller; new accounts default to the BUYER tier.
 */
export async function upsertEmailUser(
  email: string,
  db: Prisma.TransactionClient = prisma
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  // Case-insensitive lookup: adapter-written emails (e.g. Google OAuth) are stored
  // verbatim and aren't guaranteed lowercase — an exact match could miss and then
  // trip the @unique constraint on create.
  const existing = await db.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (existing) {
    if (existing.emailVerified) return existing;
    return db.user.update({
      where: { id: existing.id },
      data: { emailVerified: new Date() },
    });
  }
  return db.user.create({
    data: {
      email: normalized,
      emailVerified: new Date(),
      firstName: normalized.split("@")[0],
    },
  });
}
