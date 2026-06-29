import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { TelegramUser } from "@/lib/telegram";
import type { User } from "@prisma/client";
import { parseAdminIds, resolveRole, isDemotion } from "@/lib/roles";

const COOKIE_NAME = "fa_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Single-use guard for a verified Telegram login payload. Records the payload `hash`
 * once; a replay (same hash) hits the unique constraint and returns false → reject.
 * Defense beyond the 60s freshness window. Returns true if this is the first use.
 */
export async function consumeLoginNonce(
  hash: string,
  ttlMs = 5 * 60 * 1000
): Promise<boolean> {
  try {
    await prisma.telegramAuthNonce.create({
      data: { hash, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return true;
  } catch {
    // Unique violation (replay) or transient error → treat as not-first-use.
    return false;
  }
}

/**
 * Create/refresh the User from a verified Telegram identity, applying the admin
 * allowlist: an allowlisted telegramId becomes ADMIN; a previously-admin user no
 * longer on the list is demoted to BUYER and has all sessions revoked.
 */
export async function upsertTelegramUser(tg: TelegramUser): Promise<User> {
  const adminIds = parseAdminIds(process.env.ADMIN_TELEGRAM_IDS);
  const targetRole = resolveRole(tg.id, adminIds);

  const existing = await prisma.user.findUnique({
    where: { telegramId: tg.id },
    select: { role: true },
  });

  const user = await prisma.user.upsert({
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
      // Admins skip onboarding; everyone else completes it on first use.
      onboardingCompleted: targetRole === "ADMIN",
    },
  });

  // Demotion (admin removed from the allowlist) revokes existing sessions.
  if (isDemotion(existing?.role, targetRole)) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }

  return user;
}

/** Create a session row + set an httpOnly cookie holding an opaque token. */
export async function createSession(userId: string): Promise<void> {
  // High-entropy opaque token used as the session id (not a guessable cuid).
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Secure everywhere except local dev (Telegram login requires HTTPS anyway,
    // so staging/preview must also set Secure).
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the current user from the session cookie, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  // Suspended/deleted users are treated as logged out and their session cleared.
  if (session.user.status !== "ACTIVE") {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return session.user;
}

/**
 * Require an authenticated user. Returns the user, or null if not signed in.
 * Callers (pages/route handlers) decide how to respond (redirect / 401).
 * Centralizing this avoids per-route authz drift.
 */
export async function requireUser(): Promise<User | null> {
  return getCurrentUser();
}

/** Destroy the current session (logout). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    cookieStore.delete(COOKIE_NAME);
  }
}
