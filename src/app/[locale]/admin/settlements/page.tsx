import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import {
  listPendingPayments,
  listSellerBalances,
  listRecentPayouts,
} from "@/server/services/payments";
import { formatUzs } from "@/lib/utils";
import { ConfirmPaymentButton, PayoutForm } from "@/components/admin-settlement-actions";

export default async function SettlementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");

  const [pending, balances, payouts] = await Promise.all([
    listPendingPayments(),
    listSellerBalances(),
    listRecentPayouts(),
  ]);

  const card = "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      {/* Payments to confirm */}
      <section className={`mb-5 ${card}`}>
        <h2 className="mb-3 font-semibold">
          {t("pendingPayments")} ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noPending")}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="text-sm">
                  <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                    {o.gigTitle}
                  </Link>
                  <span className="text-[hsl(var(--muted-foreground))]">
                    {" "}
                    · {o.buyer} → {o.seller}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatUzs(o.amountUzs)} so&apos;m
                  </span>
                  <ConfirmPaymentButton orderId={o.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Seller balances → record payout */}
      <section className={`mb-5 ${card}`}>
        <h2 className="mb-3 font-semibold">{t("sellerBalances")}</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noBalances")}</p>
        ) : (
          <ul className="space-y-4">
            {balances.map((b) => (
              <li key={b.sellerId} className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                    {t("available")}: {formatUzs(b.availableUzs)} so&apos;m
                  </span>
                </div>
                <PayoutForm sellerId={b.sellerId} availableUzs={b.availableUzs} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent payouts */}
      <section className={card}>
        <h2 className="mb-3 font-semibold">{t("recentPayouts")}</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noPayouts")}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {p.seller} · <span className="text-[hsl(var(--muted-foreground))]">{p.cardMasked}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatUzs(p.amountUzs)} so&apos;m</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
