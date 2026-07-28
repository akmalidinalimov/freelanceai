import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { touchLastSeen } from "@/server/services/activity";
import { resolveRole, parseAdminIds } from "@/lib/roles";
import { impersonatedUserId } from "@/lib/impersonation";
import type { User } from "@prisma/client";

/**
 * Resolve the current user from the Auth.js session (JWT). Role/status are read
 * fresh from the DB (cached per request) so promotions/suspensions take effect
 * immediately. Suspended/deleted accounts resolve to null.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.status !== "ACTIVE") return null;

  // Impersonation overlay ("log in as"): only an ADMIN session can wear it, targets
  // can never be admins, and the signed cookie self-expires in 30 minutes. The real
  // admin session is untouched underneath — exiting is just deleting the cookie.
  if (user.role === "ADMIN") {
    const targetId = await impersonatedUserId();
    if (targetId && targetId !== user.id) {
      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (target && target.role !== "ADMIN") return target;
    }
  }

  touchLastSeen(user.id); // throttled fire-and-forget (admin activity analytics)

  // Reconcile the admin role against the LIVE allowlist so a demotion (or promotion)
  // takes effect on the next request, not the next login. Telegram-id based; email-only
  // users (no telegramId) are left as-is. The corrected role is used this request.
  if (user.telegramId) {
    const expected = resolveRole(user.telegramId, parseAdminIds(process.env.ADMIN_TELEGRAM_IDS));
    if (expected !== user.role) {
      void prisma.user.update({ where: { id: user.id }, data: { role: expected } }).catch(() => {});
      return { ...user, role: expected };
    }
  }
  return user;
});

/** Require an authenticated user (or null). Callers decide how to respond. */
export async function requireUser(): Promise<User | null> {
  return getCurrentUser();
}
