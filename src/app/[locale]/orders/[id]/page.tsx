import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { getOrderForUser } from "@/server/services/order";
import { getOrderReview, getOrderBuyerReview, getBuyerRating } from "@/server/services/review";
import { getOrderConversationId, listConversationMessages } from "@/server/services/message";
import { formatUzs } from "@/lib/utils";
import { OrderActions } from "@/components/order-actions";
import { CheckoutReview } from "@/components/checkout-review";
import { prisma } from "@/lib/prisma";
import { activeProvider } from "@/lib/payments";
import { DisputeBox } from "@/components/dispute-box";
import { CancellationBox } from "@/components/cancellation-box";
import { getOrderCancellation } from "@/server/services/cancellation";
import { canTransition } from "@/lib/order-state";
import { ReviewForm } from "@/components/review-form";
import { BuyerReviewForm } from "@/components/buyer-review-form";
import { Stars } from "@/components/stars";
import { StatusChip } from "@/components/status-chip";
import { OrderTimeline } from "@/components/order-timeline";
import { MessageThread } from "@/components/message-thread";
import { TipButton } from "@/components/tip-button";
import { ShareButton } from "@/components/share-button";

/** The current viewer's headline next-step, or null when they're waiting on the other side. */
function nextActionKey(role: string, status: string): string | null {
  if (role === "buyer" && status === "PENDING_PAYMENT") return "naPay";
  if (role === "admin" && status === "PENDING_PAYMENT") return "naConfirm";
  if ((role === "seller" || role === "admin") && (status === "IN_PROGRESS" || status === "REVISION")) return "naDeliver";
  if (role === "buyer" && status === "DELIVERED") return "naReview";
  if (role === "buyer" && status === "COMPLETED") return "naDone";
  return null;
}

const sectionCard = "rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5";
const sectionH = "mb-3 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]";

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
  const tc = await getTranslations("Common");
  const tsh = await getTranslations("Share");

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
    fileUrls: m.fileUrls,
    senderId: m.senderId,
    sender: { firstName: m.sender.firstName, name: m.sender.name, username: m.sender.username },
    createdAt: m.createdAt.toISOString(),
  }));
  const role = user.id === order.buyerId ? "buyer" : user.id === order.sellerId ? "seller" : "admin";
  const counterpart = role === "buyer" ? order.seller : order.buyer;
  const cpName = counterpart.firstName ?? counterpart.name ?? counterpart.username ?? tc("deletedUser");

  const naKey = nextActionKey(role, order.status);
  const checkoutUrl =
    role === "buyer" && order.status === "PENDING_PAYMENT"
      ? (activeProvider()?.checkoutUrl({ id: order.id, amountUzs: order.amountUzs - order.discountUzs }) ?? null)
      : null;
  const completed = order.status === "COMPLETED";

  // Review-first checkout: the buyer's PENDING_PAYMENT view IS the receipt + pay hand-off.
  if (role === "buyer" && order.status === "PENDING_PAYMENT") {
    const sp = await prisma.sellerProfile
      .findUnique({ where: { userId: order.sellerId }, select: { ratingAvg: true, ratingCount: true } })
      .catch(() => null);
    const extras = Array.isArray(order.extrasSnapshot)
      ? (order.extrasSnapshot as { title: string; priceUzs: number }[])
      : [];
    return (
      <CheckoutReview
        gigTitle={order.gig.title}
        orderId={order.id}
        conversationId={conversationId}
        packageTitle={order.packageTitle}
        baseUzs={order.amountUzs - order.extrasUzs}
        extras={extras}
        couponCode={order.couponCode}
        discountUzs={order.discountUzs}
        creditUsedUzs={order.creditUsedUzs}
        totalUzs={order.amountUzs - order.discountUzs}
        dueAt={order.dueAt ? order.dueAt.toISOString() : null}
        sellerName={cpName}
        ratingAvg={sp?.ratingAvg ?? 0}
        ratingCount={sp?.ratingCount ?? 0}
        checkoutUrl={checkoutUrl}
        providerId={activeProvider()?.id ?? null}
        currentUserId={user.id}
        cancellationPending={
          cancellation?.status === "PENDING"
            ? { requestedById: cancellation.requestedById, reason: cancellation.reason }
            : null
        }
        canCancel={canTransition(order.status, "CANCELLED") && cancellation?.status !== "PENDING"}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/gigs/${order.gig.slug}`} className="text-sm text-[hsl(var(--primary-ink))] hover:underline">
            {order.gig.title}
          </Link>
          <h1 className="text-2xl font-bold">
            {t("order")} #{order.id.slice(-6)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/orders/${order.id}/receipt`} className="text-sm text-[hsl(var(--primary-ink))] hover:underline">
            {t("receipt")}
          </Link>
          <StatusChip status={order.status} label={t(`status.${order.status}`)} />
        </div>
      </div>

      <div className="mb-6">
        <OrderTimeline status={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Main column — the work */}
        <div className="space-y-6">
          {order.deliveries.length > 0 && (
            <div className={sectionCard}>
              <h2 className={sectionH}>{t("deliveries")}</h2>
              <ul className="space-y-3">
                {order.deliveries.map((d) => (
                  <li key={d.id} className="rounded-lg bg-[hsl(var(--surface-2))] p-3 text-sm">
                    {d.message}
                    {d.fileUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.fileUrls.map((url, i) => (
                          <a
                            key={url}
                            href={`/api/orders/${order.id}/file?u=${encodeURIComponent(url)}`}
                            className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--primary-ink))] hover:underline"
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

          <div className={sectionCard}>
            <h2 className={sectionH}>{t("requirements")}</h2>
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
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{order.requirements || t("noRequirements")}</p>
            {order.requirementFileUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {order.requirementFileUrls.map((url, i) => (
                  <a
                    key={url}
                    href={`/api/orders/${order.id}/file?u=${encodeURIComponent(url)}`}
                    className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--primary-ink))] hover:underline"
                  >
                    {t("file")} {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className={sectionCard}>
            <h2 className={sectionH}>{t("conversation")}</h2>
            <MessageThread conversationId={conversationId} currentUserId={user.id} initial={initialMessages} />
          </div>

          {/* Completed: review / tip / share (buyer) or review-your-buyer (seller) */}
          {completed && (
            <div className="space-y-4">
              {review ? (
                <div className={sectionCard}>
                  <p className="mb-1 text-sm font-medium">{tr("yourReview")}</p>
                  <Stars value={review.rating} className="text-lg" />
                  {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
                </div>
              ) : role === "buyer" ? (
                <ReviewForm orderId={order.id} />
              ) : null}
              {role === "buyer" && <TipButton orderId={order.id} />}
              {role === "buyer" && (
                <div className={sectionCard}>
                  <p className="mb-2 text-sm font-medium">{tsh("orderPrompt")}</p>
                  <ShareButton path={`/${locale}/gigs/${order.gig.slug}`} title={order.gig.title} />
                </div>
              )}
              {role === "seller" &&
                (buyerReview ? (
                  <div className={sectionCard}>
                    <p className="mb-1 text-sm font-medium">{tr("yourBuyerReview")}</p>
                    <Stars value={buyerReview.rating} className="text-lg" />
                    {buyerReview.comment && <p className="mt-2 text-sm">{buyerReview.comment}</p>}
                  </div>
                ) : (
                  <BuyerReviewForm orderId={order.id} />
                ))}
            </div>
          )}
        </div>

        {/* Sticky rail — next action + summary */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {naKey && (
            <div className="rounded-2xl border border-[hsl(var(--violet))]/35 bg-[hsl(var(--violet-soft))]/50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--violet))]">{t("naTag")}</p>
              <p className="mb-3 mt-1 text-base font-bold">{t(naKey)}</p>
              {/* Disclose the silent 3-day auto-accept — otherwise the buyer's protection window
                  closes with zero warning, undermining the whole escrow promise. */}
              {role === "buyer" && order.status === "DELIVERED" && order.deliveredAt && (
                <p className="mb-3 -mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("autoAcceptOn", {
                    date: new Date(new Date(order.deliveredAt).getTime() + 3 * 86_400_000).toLocaleDateString(locale),
                  })}
                </p>
              )}
              <OrderActions orderId={order.id} status={order.status} role={role} checkoutUrl={checkoutUrl} />
            </div>
          )}

          {/* Buyer protection — the money is HELD until acceptance. Keep it visible for the whole
              anxious wait (IN_PROGRESS/DELIVERED/REVISION/PAID), not only at checkout. */}
          {role === "buyer" && ["PAID", "IN_PROGRESS", "DELIVERED", "REVISION"].includes(order.status) && (
            <div className="rounded-2xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success-soft))]/50 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-[hsl(var(--success))]">
                <span aria-hidden>🛡</span> {t("protectHeld")}
              </p>
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t("protectHeldBody")}</p>
            </div>
          )}

          <div className={sectionCard}>
            <h2 className={sectionH}>{t("summary")}</h2>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{order.packageTitle}</span>
              <span className="text-lg font-bold tabular-nums">{formatUzs(order.amountUzs)}</span>
            </div>
            {order.extrasUzs > 0 && (
              <p className="mt-1 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                <span>{t("extras")}</span>
                <span className="tabular-nums">+{formatUzs(order.extrasUzs)}</span>
              </p>
            )}
            {order.discountUzs > 0 && (
              <p className="mt-1 flex justify-between text-xs font-medium text-[hsl(var(--primary-ink))]">
                <span>
                  {t("discount")} {order.couponCode ? `(${order.couponCode})` : ""}
                </span>
                <span className="tabular-nums">−{formatUzs(order.discountUzs)}</span>
              </p>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">{role === "buyer" ? t("seller") : t("buyer")}</span>
              <span className="font-semibold">{cpName}</span>
            </div>
            {role === "seller" && buyerRating.count > 0 && (
              <div className="mt-1 flex items-center justify-end gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                <Stars value={buyerRating.avg} />
                <span className="tabular-nums">
                  {buyerRating.avg.toFixed(1)} ({buyerRating.count})
                </span>
              </div>
            )}
            {order.dueAt && !["COMPLETED", "CANCELLED"].includes(order.status) && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">{t("deadline")}</span>
                <span className="font-semibold tabular-nums">
                  {new Date(order.dueAt).toLocaleDateString(locale)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Escalation paths — kept out of the main flow */}
      <div className="mt-6 space-y-4">
        <DisputeBox orderId={order.id} status={order.status} />
        {(role === "buyer" || role === "seller") && (
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
        )}
      </div>
    </div>
  );
}
