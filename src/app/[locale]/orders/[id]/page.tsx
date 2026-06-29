import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { getOrderForUser } from "@/server/services/order";
import { getOrderReview } from "@/server/services/review";
import { getOrderConversationId, listConversationMessages } from "@/server/services/message";
import { formatUzs } from "@/lib/utils";
import { OrderActions } from "@/components/order-actions";
import { ReviewForm } from "@/components/review-form";
import { Stars } from "@/components/stars";
import { MessageThread } from "@/components/message-thread";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Order");
  const tr = await getTranslations("Review");

  const order = await getOrderForUser(id, user).catch(() => null);
  if (!order) notFound();

  const review = await getOrderReview(order.id);
  const conversationId = await getOrderConversationId(order.id);
  const initialMessages = (await listConversationMessages(conversationId, user)).map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    sender: { firstName: m.sender.firstName, name: m.sender.name, username: m.sender.username },
    createdAt: m.createdAt.toISOString(),
  }));
  const role =
    user.id === order.buyerId ? "buyer" : user.id === order.sellerId ? "seller" : "admin";
  const counterpart = role === "buyer" ? order.seller : order.buyer;
  const cpName = counterpart.firstName ?? counterpart.name ?? counterpart.username ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/gigs/${order.gig.slug}`} className="text-sm text-[hsl(var(--primary))] hover:underline">
            {order.gig.title}
          </Link>
          <h1 className="text-2xl font-bold">{t("order")} #{order.id.slice(-6)}</h1>
        </div>
        <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm font-medium">
          {t(`status.${order.status}`)}
        </span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--border))] p-5">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{order.packageTitle}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatUzs(order.amountUzs)} <span className="text-base font-normal">so&apos;m</span>
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {role === "buyer" ? t("seller") : t("buyer")}: {cpName}
          </p>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] p-5">
          <p className="mb-1 text-sm font-medium">{t("requirements")}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {order.requirements || t("noRequirements")}
          </p>
        </div>
      </div>

      {order.deliveries.length > 0 && (
        <div className="mb-6 rounded-xl border border-[hsl(var(--border))] p-5">
          <p className="mb-2 text-sm font-medium">{t("deliveries")}</p>
          <ul className="space-y-3">
            {order.deliveries.map((d) => (
              <li key={d.id} className="rounded-lg bg-[hsl(var(--muted))]/40 p-3 text-sm">
                {d.message}
                {d.fileUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.fileUrls.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--primary))] hover:underline"
                      >
                        {t("file")} {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <MessageThread conversationId={conversationId} currentUserId={user.id} initial={initialMessages} />
      </div>

      <OrderActions orderId={order.id} status={order.status} role={role} />

      {order.status === "COMPLETED" && (
        <div className="mt-6">
          {review ? (
            <div className="rounded-xl border border-[hsl(var(--border))] p-5">
              <p className="mb-1 text-sm font-medium">{tr("yourReview")}</p>
              <Stars value={review.rating} className="text-lg" />
              {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
            </div>
          ) : role === "buyer" ? (
            <ReviewForm orderId={order.id} />
          ) : null}
        </div>
      )}
    </div>
  );
}
