import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listPendingGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";
import { ModerationActions } from "@/components/moderation-actions";

export const dynamic = "force-dynamic";

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");
  const gigs = await listPendingGigs();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {t("moderation")} ({gigs.length})
      </h1>
      {gigs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noPendingGigs")}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {gigs.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/gigs/${g.slug}`} className="font-medium hover:underline">
                  {g.title}
                </Link>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {g.seller.firstName ?? g.seller.name ?? g.seller.username ?? ""} ·{" "}
                  {formatUzs(g.packages[0]?.priceUzs ?? 0)} so&apos;m
                </p>
              </div>
              <ModerationActions gigId={g.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
