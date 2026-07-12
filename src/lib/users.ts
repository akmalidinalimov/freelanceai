import "server-only";
import { prisma } from "@/lib/prisma";
import type { TelegramUser } from "@/lib/telegram";
import type { Prisma, User } from "@prisma/client";
import { parseAdminIds, resolveRole } from "@/lib/roles";

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
