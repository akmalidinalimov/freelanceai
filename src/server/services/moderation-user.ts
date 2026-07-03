import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { audit } from "@/lib/audit";
import { conversationCounterpartId } from "@/server/services/message";

/**
 * User-to-user trust & safety from within a conversation: block (toggle) and report.
 * The counterpart is always resolved server-side from the conversation id (never taken
 * from the client), so a caller can only block/report the person they're actually
 * talking to — no IDOR.
 */

/** Toggle a block on the conversation counterpart. Returns the resulting state. */
export async function toggleBlockCounterpart(
  conversationId: string,
  user: User
): Promise<{ blocked: boolean }> {
  const otherId = await conversationCounterpartId(conversationId, user);
  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: otherId } },
  });
  if (existing) {
    await prisma.userBlock.delete({ where: { id: existing.id } });
    await audit({ actorId: user.id, action: "user.unblock", entity: "User", entityId: otherId });
    return { blocked: false };
  }
  await prisma.userBlock.create({ data: { blockerId: user.id, blockedId: otherId } });
  await audit({ actorId: user.id, action: "user.block", entity: "User", entityId: otherId });
  return { blocked: true };
}

/** Whether the caller has blocked their counterpart (directional — for rendering the UI). */
export async function hasBlockedCounterpart(conversationId: string, user: User): Promise<boolean> {
  const otherId = await conversationCounterpartId(conversationId, user).catch(() => null);
  if (!otherId) return false;
  const b = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: otherId } },
  });
  return Boolean(b);
}

/**
 * Report the conversation counterpart to admin moderation. Upserts a single
 * USER_REPORTED flag per reported user (unique [userId, type]) and accumulates a
 * report count + the latest reason/reporter so the admin flags queue surfaces it.
 */
export async function reportCounterpart(
  conversationId: string,
  user: User,
  reason: string
): Promise<void> {
  const otherId = await conversationCounterpartId(conversationId, user);
  const text = reason.trim().slice(0, 1000);
  const existing = await prisma.userFlag.findUnique({
    where: { userId_type: { userId: otherId, type: "USER_REPORTED" } },
  });
  const prevCount = ((existing?.details as { count?: number } | null)?.count ?? 0) + 1;
  const details = { count: prevCount, lastReason: text, lastReporterId: user.id, conversationId };
  await prisma.userFlag.upsert({
    where: { userId_type: { userId: otherId, type: "USER_REPORTED" } },
    create: { userId: otherId, type: "USER_REPORTED", severity: "MEDIUM", details },
    update: { details, severity: "MEDIUM" },
  });
  await audit({ actorId: user.id, action: "user.report", entity: "User", entityId: otherId, metadata: { reason: text } });
}
