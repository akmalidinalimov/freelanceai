import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyAndPush } from "@/server/services/notification";

/**
 * Order deadline reminders + post-delivery review nudges (nightly/hourly cron).
 * Idempotent: each (order, threshold) fires at most once, tracked via an
 * ActivityEvent row so a re-run never double-notifies.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Loc = "uz" | "ru" | "en";
const asLoc = (l?: string | null): Loc => (l === "ru" || l === "en" ? l : "uz");

// Deadline copy per threshold, per locale (seller-facing). {t} = gig title.
const DEADLINE = {
  "2d": {
    uz: (t: string) => `⏳ "${t}" — yetkazishga 2 kun qoldi.`,
    ru: (t: string) => `⏳ "${t}" — 2 дня до срока сдачи.`,
    en: (t: string) => `⏳ "${t}" — 2 days left to deliver.`,
  },
  "1d": {
    uz: (t: string) => `⏳ "${t}" — yetkazishga 1 kun qoldi.`,
    ru: (t: string) => `⏳ "${t}" — 1 день до срока сдачи.`,
    en: (t: string) => `⏳ "${t}" — 1 day left to deliver.`,
  },
  overdue: {
    uz: (t: string) => `⚠️ "${t}" — muddat oʻtdi. Iltimos, tezroq yetkazing.`,
    ru: (t: string) => `⚠️ "${t}" — срок истёк. Пожалуйста, сдайте скорее.`,
    en: (t: string) => `⚠️ "${t}" — the deadline has passed. Please deliver soon.`,
  },
} as const;

const REVIEW_NUDGE = {
  uz: (t: string) => `⭐ "${t}" yakunlandi. Sharh qoldiring — bu ijodkorlarga yordam beradi.`,
  ru: (t: string) => `⭐ "${t}" завершён. Оставьте отзыв — это помогает авторам.`,
  en: (t: string) => `⭐ "${t}" is done. Leave a review — it helps creators.`,
};

async function alreadySent(type: string, orderId: string, threshold?: string): Promise<boolean> {
  const rows = await prisma.activityEvent.findFirst({
    where: {
      type,
      entityId: orderId,
      ...(threshold ? { meta: { path: ["threshold"], equals: threshold } } : {}),
    },
    select: { id: true },
  });
  return Boolean(rows);
}

export async function sendOrderReminders(): Promise<{ deadlines: number; reviewNudges: number }> {
  const now = Date.now();
  let deadlines = 0;
  let reviewNudges = 0;

  // 1) Deadline reminders — active, in-progress orders with a due date.
  const active = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "IN_PROGRESS", "REVISION"] },
      dueAt: { not: null },
    },
    select: {
      id: true,
      sellerId: true,
      dueAt: true,
      seller: { select: { locale: true } },
      gig: { select: { title: true } },
    },
    take: 500,
  });

  for (const o of active) {
    if (!o.dueAt) continue;
    const hoursLeft = (o.dueAt.getTime() - now) / HOUR;
    let threshold: "2d" | "1d" | "overdue" | null = null;
    if (hoursLeft <= 0) threshold = "overdue";
    else if (hoursLeft <= 24) threshold = "1d";
    else if (hoursLeft <= 48) threshold = "2d";
    if (!threshold) continue;

    if (await alreadySent("order_reminder", o.id, threshold)) continue;
    const loc = asLoc(o.seller.locale);
    await notifyAndPush(o.sellerId, "order.reminder", DEADLINE[threshold][loc](o.gig.title), {
      link: `/orders/${o.id}`,
    });
    await prisma.activityEvent
      .create({ data: { userId: o.sellerId, type: "order_reminder", entityId: o.id, meta: { threshold } } })
      .catch(() => {});
    deadlines += 1;
  }

  // 2) Review nudge — delivered >24h ago, not yet reviewed, not yet nudged.
  const delivered = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lt: new Date(now - DAY), not: null },
      review: null,
    },
    select: {
      id: true,
      buyerId: true,
      buyer: { select: { locale: true } },
      gig: { select: { title: true } },
    },
    take: 500,
  });

  for (const o of delivered) {
    if (await alreadySent("review_nudge", o.id)) continue;
    const loc = asLoc(o.buyer.locale);
    await notifyAndPush(o.buyerId, "order.review_nudge", REVIEW_NUDGE[loc](o.gig.title), {
      link: `/orders/${o.id}`,
    });
    await prisma.activityEvent
      .create({ data: { userId: o.buyerId, type: "review_nudge", entityId: o.id } })
      .catch(() => {});
    reviewNudges += 1;
  }

  // 3) Housekeeping: prune bot-native quick-reply mappings older than 30 days.
  // A notification that old is no longer a live reply target; this bounds table growth.
  await prisma.telegramReplyTarget
    .deleteMany({ where: { createdAt: { lt: new Date(now - 30 * DAY) } } })
    .catch(() => {});
  // Expired single-use login nonces (10-min TTL) — bound the replay-guard table.
  await prisma.telegramAuthNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  return { deadlines, reviewNudges };
}
