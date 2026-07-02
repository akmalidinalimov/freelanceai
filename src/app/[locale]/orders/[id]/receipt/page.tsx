import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { getOrderForUser } from "@/server/services/order";
import { formatUzs } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const name = (u: { firstName: string | null; name: string | null; username: string | null }) =>
  u.firstName ?? u.name ?? u.username ?? "";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Receipt");
  const to = await getTranslations("Order");

  const order = await getOrderForUser(id, user).catch(() => null);
  if (!order) notFound();

  const base = order.amountUzs - order.extrasUzs;
  const paid = order.amountUzs - order.discountUzs;
  const extras = Array.isArray(order.extrasSnapshot)
    ? (order.extrasSnapshot as { title: string; priceUzs: number }[])
    : [];
  const row = "flex justify-between py-1";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] p-6 text-sm">
        <div className="mb-4 flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
          <span className="text-lg font-bold text-[hsl(var(--primary))]">FreelanceAI</span>
          <span className="text-[hsl(var(--muted-foreground))]">
            #{order.id.slice(-8)} · {new Date(order.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{to("buyer")}</p>
            <p className="font-medium">{name(order.buyer)}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{to("seller")}</p>
            <p className="font-medium">{name(order.seller)}</p>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] pt-3">
          <div className={row}>
            <span>
              {order.gig.title} — {order.packageTitle}
            </span>
            <span className="tabular-nums">{formatUzs(base)} so&apos;m</span>
          </div>
          {extras.map((e, i) => (
            <div key={i} className={`${row} text-[hsl(var(--muted-foreground))]`}>
              <span>+ {e.title}</span>
              <span className="tabular-nums">{formatUzs(e.priceUzs)} so&apos;m</span>
            </div>
          ))}
          {order.discountUzs > 0 && (
            <div className={`${row} text-[hsl(var(--primary))]`}>
              <span>
                {t("discount")} {order.couponCode ? `(${order.couponCode})` : ""}
              </span>
              <span className="tabular-nums">−{formatUzs(order.discountUzs)} so&apos;m</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[hsl(var(--border))] pt-2 text-base font-bold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatUzs(paid)} so&apos;m</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
          {t("status")}: {to(`status.${order.status}`)}
        </p>
      </div>

      <div className="mt-4 print:hidden">
        <Link href={`/orders/${order.id}`} className="text-sm text-[hsl(var(--primary))] hover:underline">
          ← {t("backToOrder")}
        </Link>
      </div>
    </div>
  );
}
