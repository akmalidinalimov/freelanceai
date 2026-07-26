import { z } from "zod";
import { cookies } from "next/headers";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import {
  IMPERSONATION_COOKIE,
  signImpersonation,
  verifyImpersonation,
} from "@/lib/impersonation";

const schema = z.object({ userId: z.string().min(1).max(40) }).strict();

/**
 * Start impersonating ("log in as"). Uses the RAW session (not getCurrentUser, which
 * applies the impersonation overlay) so only a genuine admin can start one — and an
 * already-impersonating admin can't nest. Audited with admin + target.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const session = await auth();
    const adminId = session?.user?.id;
    if (!adminId) throw Errors.unauthenticated();
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== "ADMIN") throw Errors.forbidden("Admins only");

    const { userId } = parseInput(schema, await request.json().catch(() => ({})));
    if (userId === admin.id) throw Errors.validation({ userId: "That's you" });
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw Errors.notFound("User not found");
    if (target.role === "ADMIN") throw Errors.forbidden("Cannot impersonate an admin");

    const { value, maxAgeSeconds } = signImpersonation(target.id);
    const jar = await cookies();
    jar.set(IMPERSONATION_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: maxAgeSeconds,
      path: "/",
    });
    await audit({
      actorId: admin.id,
      action: "admin.impersonate.start",
      entity: "User",
      entityId: target.id,
      metadata: { minutes: Math.round(maxAgeSeconds / 60) },
    });
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Stop impersonating: clear the cookie (the admin session was intact all along). */
export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const session = await auth();
    const adminId = session?.user?.id;
    if (!adminId) throw Errors.unauthenticated();

    const jar = await cookies();
    const targetId = verifyImpersonation(jar.get(IMPERSONATION_COOKIE)?.value);
    jar.delete(IMPERSONATION_COOKIE);
    if (targetId) {
      await audit({
        actorId: adminId,
        action: "admin.impersonate.stop",
        entity: "User",
        entityId: targetId,
      });
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
