import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/http";
import { upsertTelegramUser, createSession } from "@/lib/session";
import { audit } from "@/lib/audit";

/**
 * Poll a login token. When the bot has CONFIRMED it, exchange it (once) for a
 * session cookie. Returns the current status: pending | ok | expired.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let token: string | undefined;
  try {
    token = (await request.json())?.token;
  } catch {
    token = undefined;
  }
  if (!token) return NextResponse.json({ ok: false, status: "expired" });

  const lt = await prisma.loginToken.findUnique({ where: { token } });
  if (!lt || lt.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, status: "expired" });
  }
  if (lt.status === "PENDING") {
    return NextResponse.json({ ok: false, status: "pending" });
  }
  if (lt.status === "CONFIRMED" && lt.telegramId) {
    // Single-use: mark CONSUMED before creating the session.
    await prisma.loginToken.update({ where: { token }, data: { status: "CONSUMED" } });
    const user = await upsertTelegramUser({
      id: lt.telegramId,
      firstName: lt.firstName ?? undefined,
      lastName: lt.lastName ?? undefined,
      username: lt.username ?? undefined,
      authDate: Math.floor(Date.now() / 1000),
    });
    await createSession(user.id);
    await audit({ actorId: user.id, action: "auth.login.deeplink", entity: "User", entityId: user.id });
    return NextResponse.json({ ok: true, status: "ok" });
  }
  // Already CONSUMED (session was created on a prior poll) — treat as done.
  return NextResponse.json({ ok: true, status: "ok" });
}
