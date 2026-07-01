import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptPII, encryptPII } from "@/lib/pii-crypto";
import { fetchMedia, refreshToken } from "@/lib/instagram";
import { uploadFromUrl } from "@/lib/media";

/**
 * Instagram portfolio sync: pull the creator's latest media, re-host images to R2
 * (Graph CDN URLs expire — never store them), and upsert PortfolioItems with
 * source="instagram" (deduped on the IG media id). Manual uploads are untouched.
 */

const IG_ITEM_LIMIT = 12;

export async function syncInstagramForSeller(userId: string): Promise<{ synced: number }> {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true, instagramTokenEnc: true },
  });
  const token = decryptPII(profile?.instagramTokenEnc);
  if (!profile || !token || token === "•••") throw new Error("not_connected");

  try {
    const media = await fetchMedia(token, IG_ITEM_LIMIT);
    let synced = 0;
    for (const m of media) {
      // Videos: store the poster (thumbnail); images/carousels: the media itself.
      const src = m.media_type === "VIDEO" ? m.thumbnail_url : (m.media_url ?? m.thumbnail_url);
      if (!src) continue;
      const existing = await prisma.portfolioItem.findUnique({
        where: { profileId_externalId: { profileId: profile.id, externalId: m.id } },
        select: { id: true },
      });
      if (existing) {
        // Already re-hosted — refresh the caption/permalink only (image is stable in R2).
        await prisma.portfolioItem.update({
          where: { id: existing.id },
          data: { caption: m.caption?.slice(0, 300) ?? null, permalink: m.permalink ?? null },
        });
        continue;
      }
      const publicUrl = await uploadFromUrl(`ig/${profile.id}`, src).catch(() => null);
      if (!publicUrl) continue;
      await prisma.portfolioItem.create({
        data: {
          profileId: profile.id,
          mediaUrl: publicUrl,
          mediaType: m.media_type === "VIDEO" ? "video" : "image",
          caption: m.caption?.slice(0, 300) ?? null,
          source: "instagram",
          externalId: m.id,
          permalink: m.permalink ?? null,
          position: 100 + synced, // after manual uploads
        },
      });
      synced++;
    }
    await prisma.sellerProfile.update({
      where: { userId },
      data: { instagramSyncedAt: new Date(), instagramSyncStatus: "ok" },
    });
    return { synced };
  } catch (e) {
    await prisma.sellerProfile.update({
      where: { userId },
      data: { instagramSyncStatus: `error:${(e as Error).message.slice(0, 60)}` },
    });
    throw e;
  }
}

/** Disconnect: drop the token and remove the synced items (ToS: delete on disconnect). */
export async function disconnectInstagram(userId: string): Promise<void> {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return;
  await prisma.$transaction([
    prisma.portfolioItem.deleteMany({ where: { profileId: profile.id, source: "instagram" } }),
    prisma.sellerProfile.update({
      where: { userId },
      data: {
        instagramUserId: null,
        instagramTokenEnc: null,
        instagramTokenExpiresAt: null,
        instagramSyncedAt: null,
        instagramSyncStatus: null,
      },
    }),
  ]);
}

/**
 * Cron pass: refresh tokens expiring within 10 days (Meta long-lived tokens last ~60d
 * and must be refreshed while still valid), then re-sync every connected creator.
 */
export async function instagramCronPass(): Promise<{ refreshed: number; synced: number; failed: number }> {
  const connected = await prisma.sellerProfile.findMany({
    where: { instagramTokenEnc: { not: null } },
    select: { userId: true, instagramTokenEnc: true, instagramTokenExpiresAt: true },
    take: 200,
  });
  let refreshed = 0;
  let synced = 0;
  let failed = 0;
  for (const p of connected) {
    try {
      const token = decryptPII(p.instagramTokenEnc);
      if (!token || token === "•••") throw new Error("token_unreadable");
      const soon = Date.now() + 10 * 24 * 3600 * 1000;
      if (p.instagramTokenExpiresAt && p.instagramTokenExpiresAt.getTime() < soon) {
        const next = await refreshToken(token);
        await prisma.sellerProfile.update({
          where: { userId: p.userId },
          data: { instagramTokenEnc: encryptPII(next.accessToken), instagramTokenExpiresAt: next.expiresAt },
        });
        refreshed++;
      }
      await syncInstagramForSeller(p.userId);
      synced++;
    } catch {
      failed++;
    }
  }
  return { refreshed, synced, failed };
}
