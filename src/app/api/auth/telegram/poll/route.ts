import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/http";

/**
 * Poll a login token's status. The actual session is created by the Auth.js
 * "telegram" credentials provider once the client calls signIn with a CONFIRMED
 * token — this endpoint only reports pending | confirmed | expired.
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
  // CONFIRMED (or already CONSUMED) → client should exchange via signIn("telegram").
  return NextResponse.json({ ok: true, status: "confirmed" });
}
