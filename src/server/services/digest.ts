import "server-only";
import { prisma } from "@/lib/prisma";
import { tgSendMessage } from "@/lib/telegram-bot";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

/**
 * Daily re-engagement digest — VALUE-GATED, never promotional spam (retention
 * research: >1 promo push/week kills notifications; event/value pushes don't).
 * A user gets at most one digest per ~20h and ONLY when there is real signal:
 * unread messages and/or new gigs from creators they follow. Empty digest = no send.
 * Respects notifyTelegram/notifyEmail + the "messages" mute.
 */

const DAY = 24 * 60 * 60 * 1000;

const COPY = {
  uz: {
    title: "Sizni kutayotgan yangiliklar",
    unread: (n: number) => `📬 ${n} ta oʻqilmagan xabar`,
    newGigs: (n: number) => `✨ Kuzatayotgan ijodkorlaringizdan ${n} ta yangi xizmat`,
    cta: "Koʻrish",
  },
  ru: {
    title: "Для вас есть новости",
    unread: (n: number) => `📬 Непрочитанных сообщений: ${n}`,
    newGigs: (n: number) => `✨ Новых услуг от ваших авторов: ${n}`,
    cta: "Открыть",
  },
  en: {
    title: "Waiting for you",
    unread: (n: number) => `📬 ${n} unread message${n > 1 ? "s" : ""}`,
    newGigs: (n: number) => `✨ ${n} new gig${n > 1 ? "s" : ""} from creators you follow`,
    cta: "Open",
  },
} as const;

export async function sendDailyDigests(limit = 500): Promise<{ considered: number; sent: number }> {
  const origin = (process.env.APP_ORIGIN ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");
  const since = new Date(Date.now() - DAY);
  const activeSince = new Date(Date.now() - 60 * DAY);

  // Only recently-active, reachable users — never resurrect the long-gone via daily pings.
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      lastSeenAt: { gte: activeSince },
      OR: [
        { notifyTelegram: true, telegramId: { not: null } },
        { notifyEmail: true, email: { not: null } },
      ],
    },
    select: {
      id: true,
      locale: true,
      telegramId: true,
      email: true,
      notifyTelegram: true,
      notifyEmail: true,
      notifyPrefs: true,
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });

  let sent = 0;
  for (const u of users) {
    try {
      // Frequency cap: one digest per ~20h, tracked as an activity event.
      const recent = await prisma.activityEvent.findFirst({
        where: { userId: u.id, type: "digest_sent", createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) } },
        select: { id: true },
      });
      if (recent) continue;

      const prefs = (u.notifyPrefs as Record<string, boolean> | null) ?? null;
      const messagesMuted = prefs?.messages === false;

      const [unread, followedNewGigs] = await Promise.all([
        messagesMuted
          ? Promise.resolve(0)
          : prisma.message.count({
              where: {
                readAt: null,
                senderId: { not: u.id },
                createdAt: { gte: since },
                conversation: {
                  OR: [
                    { buyerId: u.id },
                    { sellerId: u.id },
                    { order: { OR: [{ buyerId: u.id }, { sellerId: u.id }] } },
                  ],
                },
              },
            }),
        prisma.gig.count({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            createdAt: { gte: since },
            seller: { followers: { some: { followerId: u.id } } },
          },
        }),
      ]);

      if (unread === 0 && followedNewGigs === 0) continue; // nothing of value — stay silent

      const locale = (["uz", "ru", "en"].includes(u.locale) ? u.locale : "uz") as "uz" | "ru" | "en";
      const c = COPY[locale];
      const lines = [
        ...(unread > 0 ? [c.unread(unread)] : []),
        ...(followedNewGigs > 0 ? [c.newGigs(followedNewGigs)] : []),
      ];
      const link = `${origin}/${locale}/dashboard`;

      // Cap BEFORE send: a lost write must under-send (safe), never re-send.
      await prisma.activityEvent.create({
        data: { userId: u.id, type: "digest_sent", meta: { unread, followedNewGigs } },
      });

      // Telegram first; on failure (bot blocked → 403) fall back to email.
      let delivered = false;
      if (u.notifyTelegram && u.telegramId) {
        delivered = await tgSendMessage(u.telegramId, `${c.title}\n\n${lines.join("\n")}\n\n${link}`);
      }
      if (!delivered && u.notifyEmail && u.email) {
        const { text, html } = renderBrandedEmail({
          title: c.title,
          lines,
          button: { label: c.cta, url: link },
        });
        delivered = await sendEmail(u.email, c.title, text, html);
      }
      if (delivered) sent += 1;
    } catch (err) {
      console.error("digest failed for user", u.id, err);
    }
  }
  return { considered: users.length, sent };
}
