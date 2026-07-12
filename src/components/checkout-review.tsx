import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatUzs } from "@/lib/utils";
import { Stars } from "@/components/stars";
import { CancellationBox } from "@/components/cancellation-box";

/**
 * "Review-first" checkout: the PENDING_PAYMENT buyer view of an order. Opens as a
 * finished, itemized receipt (package + extras + any coupon discount → bold total),
 * with the protection promise, the seller trust chip, and the payment hand-off. The
 * total shown is exactly what the PSP will charge (amount − platform-funded discount);
 * referral credit is applied later at settlement and is intentionally NOT shown as a
 * deduction here so the receipt never disagrees with the amount charged.
 */
export async function CheckoutReview({
  gigTitle,
  orderId,
  conversationId,
  packageTitle,
  baseUzs,
  extras,
  couponCode,
  discountUzs,
  creditUsedUzs,
  totalUzs,
  dueAt,
  sellerName,
  ratingAvg,
  ratingCount,
  checkoutUrl,
  providerId,
  currentUserId,
  cancellationPending,
  canCancel,
}: {
  gigTitle: string;
  orderId: string;
  conversationId: string;
  packageTitle: string;
  baseUzs: number;
  extras: { title: string; priceUzs: number }[];
  couponCode: string | null;
  discountUzs: number;
  creditUsedUzs: number;
  totalUzs: number;
  dueAt: string | null;
  sellerName: string;
  ratingAvg: number;
  ratingCount: number;
  checkoutUrl: string | null;
  providerId: string | null;
  currentUserId: string;
  cancellationPending: { requestedById: string; reason: string } | null;
  canCancel: boolean;
}) {
  const t = await getTranslations("Order");
  const tm = await getTranslations("Message");
  const format = await getFormatter();
  const providerName = providerId === "payme" ? "Payme" : providerId === "click" ? "Click" : null;

  const li = "flex items-baseline justify-between gap-3 py-1.5 text-sm";
  const initial = (sellerName.replace(/^@/, "").charAt(0) || "•").toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-8 lg:pb-8">
      <div className="mb-6">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{gigTitle}</p>
        <h1 className="text-2xl font-bold">{t("reviewPay")}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Receipt + trust */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("yourOrder")}
            </h2>
            <div className={li}>
              <span>{packageTitle}</span>
              <span className="tabular-nums">{formatUzs(baseUzs)}</span>
            </div>
            {extras.map((e, i) => (
              <div key={i} className={li}>
                <span className="text-[hsl(var(--muted-foreground))]">{e.title}</span>
                <span className="tabular-nums">+{formatUzs(e.priceUzs)}</span>
              </div>
            ))}
            {dueAt && (
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                {t("deliveryBy", { date: format.dateTime(new Date(dueAt), { day: "numeric", month: "long" }) })}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success-soft))]/60 p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-[hsl(var(--success))]">
              <span aria-hidden>🛡</span>
              <span>
                <span className="font-bold">{t("protectTitle")}</span> {t("protectBody")}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <span
              aria-hidden
              className="grid h-10 w-10 flex-none place-items-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(173 70% 40%), hsl(196 75% 45%))" }}
            >
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{sellerName}</p>
              {ratingCount > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <Stars value={ratingAvg} />
                  <span className="tabular-nums">
                    {ratingAvg.toFixed(1)} ({ratingCount})
                  </span>
                </p>
              )}
            </div>
            <Link
              href={`/messages/${conversationId}`}
              className="ml-auto shrink-0 text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline"
            >
              {tm("messageSeller")}
            </Link>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 lg:sticky lg:top-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {t("payment")}
          </h2>
          {discountUzs > 0 && (
            <>
              <div className={li}>
                <span className="text-[hsl(var(--muted-foreground))]">{t("subtotal")}</span>
                <span className="tabular-nums">{formatUzs(totalUzs + discountUzs)}</span>
              </div>
              {discountUzs - creditUsedUzs > 0 && (
                <div className={`${li} font-medium text-[hsl(var(--primary-ink))]`}>
                  <span>
                    {t("discount")} {couponCode ? `(${couponCode})` : ""}
                  </span>
                  <span className="tabular-nums">−{formatUzs(discountUzs - creditUsedUzs)}</span>
                </div>
              )}
              {creditUsedUzs > 0 && (
                <div className={`${li} font-medium text-[hsl(var(--primary-ink))]`}>
                  <span>{t("creditApplied")}</span>
                  <span className="tabular-nums">−{formatUzs(creditUsedUzs)}</span>
                </div>
              )}
            </>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-[hsl(var(--border))] pt-3">
            <span className="text-base font-bold">{t("total")}</span>
            <span className="text-xl font-extrabold tabular-nums">
              {formatUzs(totalUzs)} <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">so&apos;m</span>
            </span>
          </div>

          {checkoutUrl && providerName ? (
            <>
              <a
                href={checkoutUrl}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-base font-extrabold text-[hsl(var(--primary-foreground))]"
              >
                {t("payAmount", { amount: formatUzs(totalUzs) })}
              </a>
              <p className="mt-2 text-center text-[11.5px] text-[hsl(var(--muted-foreground))]">
                {t("redirectNote", { provider: providerName })}
              </p>
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
              {t("awaitingPayment")}
            </p>
          )}
          <Link
            href={`/orders/${orderId}/receipt`}
            className="mt-3 block text-center text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {t("receipt")}
          </Link>
        </div>
      </div>

      {/* Cancellation — keep the buyer able to answer a seller's request (or abandon
          the unpaid order) without leaving this page. */}
      {(canCancel || cancellationPending) && (
        <div className="mt-5">
          <CancellationBox
            orderId={orderId}
            currentUserId={currentUserId}
            pending={cancellationPending}
            canRequest={canCancel}
          />
        </div>
      )}

      {/* Mobile: sticky pay bar so the CTA is always reachable without scrolling. */}
      {checkoutUrl && providerName && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 shadow-[0_-4px_14px_-6px_hsl(30_30%_28%/0.12)] lg:hidden">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("total")}</p>
            <p className="text-lg font-extrabold tabular-nums leading-none">{formatUzs(totalUzs)}</p>
          </div>
          <a
            href={checkoutUrl}
            className="ml-auto flex items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-extrabold text-[hsl(var(--primary-foreground))]"
          >
            {t("payAmount", { amount: formatUzs(totalUzs) })}
          </a>
        </div>
      )}
    </div>
  );
}
