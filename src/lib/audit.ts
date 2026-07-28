import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Append-only audit log writer. Call on every security-relevant or money action:
 * login, role change, gig moderation, order state transitions, ledger postings,
 * payout approve/pay, dispute resolution, impersonation, data export/erasure.
 *
 * The runtime DB role must NOT have UPDATE/DELETE on AuditLog (see DATA-PROTECTION).
 * Writing audit must never break the main flow → failures are swallowed + logged.
 */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    });
  } catch (err) {
    console.error("audit write failed", { action: params.action, err });
  }
}
