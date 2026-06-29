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
