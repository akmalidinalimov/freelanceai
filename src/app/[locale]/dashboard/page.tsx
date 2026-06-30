import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listBuyerOrders } from "@/server/services/order";
import { listSavedGigs } from "@/server/services/saved";
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
  const tg = await getTranslations("Gig");
  const orders = await listBuyerOrders(user.id);
  const saved = await listSavedGigs(user.id);

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

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{t("saved")}</h3>
          <Link href="/dashboard/saved" className="text-sm text-[hsl(var(--primary))] hover:underline">
            {t("manageSaved")}
          </Link>
        </div>
        {saved.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{tg("noSaved")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {saved.map((g) => {
              const from = g.packages[0]?.priceUzs ?? 0;
              return (
                <Link
                  key={g.id}
                  href={`/gigs/${g.slug}`}
                  className="flex flex-col rounded-xl border border-[hsl(var(--border))] p-3 transition-colors hover:border-[hsl(var(--primary))]"
                >
                  <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-lg font-bold text-[hsl(var(--primary))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      g.title.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
                  <p className="mt-auto pt-1 text-sm font-semibold tabular-nums">
                    {tg("from")} {formatUzs(from)} so&apos;m
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
