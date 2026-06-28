import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { TelegramUser } from "@/lib/telegram";
import type { User } from "@prisma/client";

const COOKIE_NAME = "fa_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Create/refresh the User record from a verified Telegram identity. */
export async function upsertTelegramUser(tg: TelegramUser): Promise<User> {
  return prisma.user.upsert({
    where: { telegramId: tg.id },
    update: {
      username: tg.username,
      firstName: tg.firstName,
      lastName: tg.lastName,
      photoUrl: tg.photoUrl,
    },
    create: {
      telegramId: tg.id,
      username: tg.username,
      firstName: tg.firstName,
      lastName: tg.lastName,
      photoUrl: tg.photoUrl,
    },
  });
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
