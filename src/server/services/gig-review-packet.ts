import "server-only";
import { prisma } from "@/lib/prisma";
import { tgSendMessage, tgSendMediaGroup, adminGigReviewButtons, miniAppUrl } from "@/lib/telegram-bot";
import { runL0 } from "@/server/services/portfolio-l0";
import { specLabel } from "@/lib/specializations";
import { formatUzs } from "@/lib/utils";

/**
 * The manual-review packet: when a gig enters PENDING_REVIEW, send each admin an album
 * of the ACTUAL work (gig cover + gallery + the seller's portfolio) followed by the
 * facts needed to judge it and one-tap approve/reject buttons.
 *
 * Deliberately NO AI score in this message. The founder reviews manually, and showing a
 * model's verdict first would anchor that judgment. What IS included are the free L0
 * findings — those are facts, not taste (an 800px image is small; the same file under a
 * different seller is a fraud signal), and hiding fraud evidence would be wrong.
 */

const isVideoUrl = (u: string) => /\.(mp4|webm|mov)$/i.test(u);

export async function sendGigReviewPacket(gigId: string): Promise<void> {
  try {
    const gig = await prisma.gig.findUnique({
      where: { id: gigId },
      select: {
        id: true,
        title: true,
        description: true,
        coverUrl: true,
        galleryUrls: true,
        tags: true,
        portfolioTelegram: true,
        portfolioInstagram: true,
        category: { select: { nameUz: true } },
        packages: { orderBy: { priceUzs: "asc" }, select: { tier: true, priceUzs: true, deliveryDays: true } },
        seller: {
          select: {
            id: true,
            firstName: true,
            username: true,
            isCourseStudent: true,
            kycStatus: true,
            createdAt: true,
            sellerProfile: {
              select: {
                headline: true,
                experienceYears: true,
                specializations: true,
                approvalStatus: true,
                portfolio: { select: { mediaUrl: true, mediaType: true }, orderBy: { position: "asc" }, take: 6 },
              },
            },
            _count: { select: { gigs: true, flags: true, ordersAsSeller: true } },
          },
        },
      },
    });
    if (!gig) return;

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", telegramId: { not: null }, telegramBlockedAt: null },
      select: { telegramId: true, locale: true },
    });
    if (admins.length === 0) return;

    const s = gig.seller;
    const p = s.sellerProfile;

    // Album: the gig's own media first (that's what a buyer will see), then portfolio.
    const media: { url: string; type: "photo" | "video" }[] = [];
    const push = (url: string | null | undefined, video?: boolean) => {
      if (!url || !/^https?:\/\//.test(url) || media.length >= 10) return;
      if (media.some((m) => m.url === url)) return;
      media.push({ url, type: video || isVideoUrl(url) ? "video" : "photo" });
    };
    push(gig.coverUrl);
    for (const u of gig.galleryUrls) push(u);
    for (const it of p?.portfolio ?? []) push(it.mediaUrl, it.mediaType === "video");

    // Free, deterministic findings — facts only (no scores, no AI verdict).
    const l0 = await runL0(s.id).catch(() => null);

    const specs = (p?.specializations ?? []).map((k) => specLabel(k, "uz")).join(", ");
    const pkg = gig.packages
      .map((k) => `${k.tier} ${formatUzs(k.priceUzs)} so'm / ${k.deliveryDays}k`)
      .join(" · ");
    const desc = gig.description.length > 500 ? `${gig.description.slice(0, 500)}…` : gig.description;

    const lines = [
      `🆕 TEKSHIRUVGA: "${gig.title}"`,
      ``,
      `👤 ${s.firstName ?? s.username ?? s.id}${s.username ? " (@" + s.username + ")" : ""}${s.isCourseStudent ? " 🎓 KURS" : ""}`,
      `   ${p?.headline ?? "(sarlavha yoʻq)"}`,
      `   Yoʻnalish: ${specs || "—"}${p?.experienceYears != null ? ` · ${p.experienceYears}+ yil` : ""}`,
      `   KYC: ${s.kycStatus} · e'lonlar: ${s._count.gigs} · buyurtmalar: ${s._count.ordersAsSeller}${s._count.flags > 0 ? ` · 🚩 ${s._count.flags}` : ""}`,
      ``,
      `📂 ${gig.category?.nameUz ?? "(kategoriyasiz)"}${gig.tags.length ? " · " + gig.tags.slice(0, 6).join(", ") : ""}`,
      `💰 ${pkg || "—"}`,
      ``,
      `📝 ${desc}`,
    ];

    if (gig.portfolioTelegram || gig.portfolioInstagram) {
      lines.push(``, `🔗 Ish namunalari:`);
      if (gig.portfolioTelegram) lines.push(`   t.me/${gig.portfolioTelegram}`);
      if (gig.portfolioInstagram) lines.push(`   instagram.com/${gig.portfolioInstagram}`);
    }

    if (l0) {
      const facts: string[] = [`${l0.itemsPassed}/${l0.itemsTotal} portfolio fayl talabga javob beradi`];
      if (l0.blockers.length) facts.push(`⚠️ ${l0.blockers.join(", ")}`);
      lines.push(``, `🔎 Tekshiruv (avtomatik faktlar):`, ...facts.map((f) => `   ${f}`));
    }

    const text = lines.join("\n").slice(0, 4000);

    for (const a of admins) {
      const chat = a.telegramId!;
      if (media.length >= 2) {
        await tgSendMediaGroup(chat, media, `"${gig.title}" — ${s.firstName ?? s.username ?? ""}`);
      } else if (media.length === 1) {
        // A single item can't be an album; the detail message + link is enough.
        await tgSendMessage(chat, media[0].url);
      }
      // adminGigReviewButtons returns raw rows; sendMessage needs a full reply_markup.
      await tgSendMessage(chat, text, { inline_keyboard: adminGigReviewButtons(a.locale, gig.id) });
      await tgSendMessage(
        chat,
        `👁 Profilni koʻrish: ${miniAppUrl(a.locale, `/admin/users/${s.id}`)}`
      );
    }
  } catch {
    // Best-effort: a failed packet must never block gig creation. The gig still lands in
    // /admin/moderation, which now shows cover, description and packages inline.
  }
}
