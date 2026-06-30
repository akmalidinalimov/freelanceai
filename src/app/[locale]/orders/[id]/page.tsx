import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { getOrderForUser } from "@/server/services/order";
import { getOrderReview, getOrderBuyerReview, getBuyerRating } from "@/server/services/review";
import { getOrderConversationId, listConversationMessages } from "@/server/services/message";
import { formatUzs } from "@/lib/utils";
import { OrderActions } from "@/components/order-actions";
import { DisputeBox } from "@/components/dispute-box";
import { CancellationBox } from "@/components/cancellation-box";
import { getOrderCancellation } from "@/server/services/cancellation";
import { canTransition } from "@/lib/order-state";
import { ReviewForm } from "@/components/review-form";
import { BuyerReviewForm } from "@/components/buyer-review-form";
import { Stars } from "@/components/stars";
import { MessageThread } from "@/components/message-thread";
import { TipButton } from "@/components/tip-button";

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
  const buyerReview = await getOrderBuyerReview(order.id);
  const buyerRating = await getBuyerRating(order.buyerId);
  const cancellation = await getOrderCancellation(order.id);
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
        <div className="flex items-center gap-3">
          <Link
            href={`/orders/${order.id}/receipt`}
            className="text-sm text-[hsl(var(--primary))] hover:underline"
          >
            {t("receipt")}
          </Link>
          <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm font-medium">
            {t(`status.${order.status}`)}
          </span>
        </div>
      </div>

      {!["CANCELLED", "DISPUTED"].includes(order.status) && (
        <div className="mb-6 flex items-center gap-1">
          {(["PENDING_PAYMENT", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const).map((s, i) => {
            const idx =
              ({ PENDING_PAYMENT: 0, PAID: 1, IN_PROGRESS: 1, REVISION: 1, DELIVERED: 2, COMPLETED: 3 } as Record<string, number>)[
                order.status
              ] ?? 0;
            const done = i <= idx;
            return (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    done
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`hidden text-xs sm:inline ${done ? "font-medium" : "text-[hsl(var(--muted-foreground))]"}`}
                >
                  {t(`status.${s}`)}
                </span>
                {i < 3 && <div className="h-px flex-1 bg-[hsl(var(--border))]" />}
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--border))] p-5">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{order.packageTitle}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatUzs(order.amountUzs)} <span className="text-base font-normal">so&apos;m</span>
          </p>
          {order.extrasUzs > 0 && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t("extras")}: +{formatUzs(order.extrasUzs)} so&apos;m
            </p>
          )}
          {order.discountUzs > 0 && (
            <p className="mt-1 text-xs font-medium text-[hsl(var(--primary))]">
              {t("discount")} {order.couponCode ? `(${order.couponCode})` : ""}: −{formatUzs(order.discountUzs)} so&apos;m
            </p>
          )}
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {role === "buyer" ? t("seller") : t("buyer")}: {cpName}
          </p>
          {role === "seller" && buyerRating.count > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Stars value={buyerRating.avg} />
              <span className="tabular-nums">
                {buyerRating.avg.toFixed(1)} ({buyerRating.count})
              </span>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] p-5">
          <p className="mb-1 text-sm font-medium">{t("requirements")}</p>
          {Array.isArray(order.requirementAnswers) && order.requirementAnswers.length > 0 && (
            <div className="mb-2 space-y-2">
              {(order.requirementAnswers as { q: string; a: string }[]).map((qa, i) => (
                <div key={i}>
                  <p className="text-xs font-medium">{qa.q}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{qa.a}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {order.requirements || t("noRequirements")}
          </p>
          {order.requirementFileUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {order.requirementFileUrls.map((url, i) => (
                <a
                  key={url}
                  href={`/api/orders/${order.id}/file?u=${encodeURIComponent(url)}`}
                  className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--primary))] hover:underline"
                >
                  {t("file")} {i + 1}
                </a>
              ))}
            </div>
          )}
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
                        href={`/api/orders/${order.id}/file?u=${encodeURIComponent(url)}`}
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

      <div className="mt-4">
        <DisputeBox orderId={order.id} status={order.status} />
      </div>

      {(role === "buyer" || role === "seller") && (
        <div className="mt-4">
          <CancellationBox
            orderId={order.id}
            currentUserId={user.id}
            pending={
              cancellation?.status === "PENDING"
                ? { requestedById: cancellation.requestedById, reason: cancellation.reason }
                : null
            }
            canRequest={canTransition(order.status, "CANCELLED") && cancellation?.status !== "PENDING"}
          />
        </div>
      )}

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
          {role === "buyer" && (
            <div className="mt-4">
              <TipButton orderId={order.id} />
            </div>
          )}
          {role === "seller" && (
            <div className="mt-4">
              {buyerReview ? (
                <div className="rounded-xl border border-[hsl(var(--border))] p-5">
                  <p className="mb-1 text-sm font-medium">{tr("yourBuyerReview")}</p>
                  <Stars value={buyerReview.rating} className="text-lg" />
                  {buyerReview.comment && <p className="mt-2 text-sm">{buyerReview.comment}</p>}
                </div>
              ) : (
                <BuyerReviewForm orderId={order.id} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
