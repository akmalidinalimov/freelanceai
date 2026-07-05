import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listConversationMessages, markConversationRead, listInbox } from "@/server/services/message";
import { hasBlockedCounterpart } from "@/server/services/moderation-user";
import { listOffers } from "@/server/services/offer";
import { prisma } from "@/lib/prisma";
import { MessageThread } from "@/components/message-thread";
import { CustomOffers } from "@/components/custom-offers";
import { InboxSidebar } from "@/components/inbox-sidebar";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: convId } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Message");

  const initial = await listConversationMessages(convId, user).catch(() => null);
  if (initial === null) notFound();
  await markConversationRead(convId, user);
  const rows = await listInbox(user);

  const msgs = initial.map((m) => ({
    id: m.id,
    body: m.body,
    fileUrls: m.fileUrls,
    senderId: m.senderId,
    sender: { firstName: m.sender.firstName, name: m.sender.name, username: m.sender.username },
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt ? m.readAt.toISOString() : null,
  }));

  // Custom offers are available in direct (gig) conversations with a buyer↔seller pair.
  // Also resolve the counterpart (name + last-seen) for the thread's presence header —
  // safe to expose here because the page is authz-scoped to conversation participants.
  const P = { select: { id: true, firstName: true, name: true, username: true, lastSeenAt: true } } as const;
  const convo = await prisma.conversation.findUnique({
    where: { id: convId },
    select: {
      buyerId: true,
      sellerId: true,
      gigId: true,
      buyer: P,
      seller: P,
      order: { select: { buyerId: true, seller: P, buyer: P } },
    },
  });
  const isGigConvo = Boolean(convo?.buyerId && convo?.sellerId && convo?.gigId);
  const offerRole = convo?.sellerId === user.id ? "seller" : "buyer";

  const buyerId = convo?.order?.buyerId ?? convo?.buyerId;
  const other = user.id === buyerId ? convo?.order?.seller ?? convo?.seller : convo?.order?.buyer ?? convo?.buyer;
  const counterpart = other
    ? {
        name: other.firstName ?? other.name ?? other.username ?? "",
        lastSeenAt: other.lastSeenAt ? other.lastSeenAt.toISOString() : null,
      }
    : null;
  const blocked = counterpart ? await hasBlockedCounterpart(convId, user).catch(() => false) : false;
  const offers = isGigConvo
    ? (await listOffers(convId, user)).map((o) => ({
        id: o.id,
        title: o.title,
        priceUzs: o.priceUzs,
        deliveryDays: o.deliveryDays,
        revisions: o.revisions,
        status: o.status,
      }))
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)] lg:grid-cols-[340px_1fr]">
        <InboxSidebar
          rows={rows}
          activeId={convId}
          className="hidden lg:flex lg:border-r lg:border-[hsl(var(--border))]"
        />
        <div className="flex min-w-0 flex-col">
          <Link
            href="/messages"
            className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm text-[hsl(var(--primary-ink))] hover:underline lg:hidden"
          >
            ← {t("inbox")}
          </Link>
          <MessageThread
            conversationId={convId}
            currentUserId={user.id}
            initial={msgs}
            counterpart={counterpart}
            initiallyBlocked={blocked}
          />
          {isGigConvo && (
            <div className="border-t border-[hsl(var(--border))] p-4">
              <CustomOffers conversationId={convId} role={offerRole} initial={offers} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
