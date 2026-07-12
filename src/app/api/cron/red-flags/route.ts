import { prisma } from "@/lib/prisma";
import { scanRedFlags } from "@/server/services/red-flags";
import { rebuildSellerEmbeddings } from "@/server/services/embeddings";
import { sweepBadges } from "@/server/services/gamification";
import { recomputeTrending, recomputeLeaderboard } from "@/server/services/engagement";

/** ActivityEvents are product analytics, not records of account — bounded retention. */
const EVENT_RETENTION_DAYS = 180;

/**
 * Nightly trust & safety + housekeeping job (see .github/workflows/red-flags.yml):
 * recompute red flags, purge expired magic-link tokens and old activity events.
 * Protected by the shared CRON_SECRET (Bearer), same as the other cron endpoints.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const scan = await scanRedFlags();
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [eventsPurged, tokensPurged, embeddings, badges, trending, leaderboard] = await Promise.all([
    prisma.activityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } }),
    // S2: refresh creator-document embeddings (skips unchanged docs; no-op without key).
    rebuildSellerEmbeddings().catch((e) => {
      console.error("embedding rebuild failed", e);
      return { sellers: 0, embedded: -1 };
    }),
    // Gamification: award all count-based badges (idempotent set-based sweep).
    sweepBadges().catch((e) => {
      console.error("badge sweep failed", e);
      return { awarded: -1 };
    }),
    recomputeTrending().catch((e) => {
      console.error("trending recompute failed", e);
      return { gigs: -1 };
    }),
    recomputeLeaderboard().catch((e) => {
      console.error("leaderboard recompute failed", e);
      return { ranked: -1 };
    }),
  ]);

  return Response.json({
    ...scan,
    eventsPurged: eventsPurged.count,
    tokensPurged: tokensPurged.count,
    embeddings,
    badges,
    trending,
    leaderboard,
  });
}
