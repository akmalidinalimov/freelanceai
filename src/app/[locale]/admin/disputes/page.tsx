import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listOpenDisputes } from "@/server/services/dispute";
import { formatUzs } from "@/lib/utils";
import { DisputeActions } from "@/components/dispute-actions";

export const dynamic = "force-dynamic";

function nm(u: { firstName: string | null; name: string | null; username: string | null }) {
  return u.firstName ?? u.name ?? u.username ?? "";
}

export default async function DisputesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Dispute");
  const disputes = await listOpenDisputes();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {t("adminTitle")} ({disputes.length})
      </h1>
      {disputes.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noDisputes")}</p>
      ) : (
        <ul className="space-y-4">
          {disputes.map((d) => (
            <li key={d.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/orders/${d.orderId}`} className="font-medium hover:underline">
                    {d.order.gig.title}
                  </Link>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {nm(d.order.buyer)} ↔ {nm(d.order.seller)} · {formatUzs(d.order.amountUzs)} so&apos;m
                  </p>
                </div>
                <DisputeActions disputeId={d.id} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{d.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
