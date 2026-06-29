import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DashCard } from "@/components/dash-card";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listBuyerOrders } from "@/server/services/order";
import { formatUzs } from "@/lib/utils";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Dash");
  const to = await getTranslations("Order");
  const tm = await getTranslations("Message");
  const ts = await getTranslations("Settings");
  const orders = await listBuyerOrders(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("buyer")}</h1>
        <div className="flex gap-2">
          <Link href="/messages">
            <Button variant="ghost">{tm("inbox")}</Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost">{ts("title")}</Button>
          </Link>
          {!user.isSeller && (
            <Link href="/sell">
              <Button variant="outline">{t("becomeCreator")}</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="mb-3 font-semibold">{t("orders")}</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {to("noOrders")}{" "}
            <Link href="/gigs" className="text-[hsl(var(--primary))] hover:underline">
              {to("browse")}
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3">
                <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                  {o.gig.title}
                </Link>
                <span className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                    {to(`status.${o.status}`)}
                  </span>
                  <span className="tabular-nums">{formatUzs(o.amountUzs)} so&apos;m</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashCard title={t("messages")} />
        <DashCard title={t("saved")} />
      </div>
    </div>
  );
}
