import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Single-use guard for a verified Telegram login payload. Records the payload's `hash`
 * exactly once (primary key) so the same signed initData cannot be replayed to mint a
 * second session within its freshness window. First caller wins; a duplicate hash =
 * replay → returns false. Best-effort: a DB error fails CLOSED (treated as replay) so a
 * transient outage can't open a replay window.
 */
export async function consumeLoginNonce(hash: string, ttlSeconds: number): Promise<boolean> {
  try {
    await prisma.telegramAuthNonce.create({
      data: { hash, expiresAt: new Date(Date.now() + ttlSeconds * 1000) },
    });
    return true;
  } catch {
    return false; // unique-constraint violation (already used) OR DB error → reject
  }
}

/** Housekeeping: drop expired nonces so the table doesn't grow unbounded. */
export async function pruneExpiredLoginNonces(): Promise<void> {
  await prisma.telegramAuthNonce
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}
