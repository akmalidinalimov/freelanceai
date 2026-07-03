import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * True if either user has blocked the other. Blocking severs a conversation in BOTH
 * directions, so message-send enforcement checks both orderings. Kept dependency-free
 * (prisma only) so message.ts can import it without an import cycle.
 */
export async function isBlockedBetween(aId: string, bId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
  });
  return n > 0;
}
