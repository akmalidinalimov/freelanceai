import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { touchLastSeen } from "@/server/services/activity";
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
  touchLastSeen(user.id); // throttled fire-and-forget (admin activity analytics)
  return user;
});

/** Require an authenticated user (or null). Callers decide how to respond. */
export async function requireUser(): Promise<User | null> {
  return getCurrentUser();
}
