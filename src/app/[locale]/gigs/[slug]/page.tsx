import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getGigBySlug } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";

const TIER_ORDER = { BASIC: 0, STANDARD: 1, PREMIUM: 2 } as const;

export default async function GigDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Gig");

  const gig = await getGigBySlug(slug);
  if (!gig) notFound();

  const seller = gig.seller.firstName ?? gig.seller.name ?? gig.seller.username ?? "";
  const packages = [...gig.packages].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  const tierLabel: Record<string, string> = {
    BASIC: t("basic"),
    STANDARD: t("standard"),
    PREMIUM: t("premium"),
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-5 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-5xl font-bold text-[hsl(var(--primary))]">
          {gig.title.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="text-3xl font-bold">{gig.title}</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t("byCreator")} {seller}
          {gig.category ? ` · ${gig.category.nameUz}` : ""}
        </p>
        <p className="mt-6 whitespace-pre-wrap leading-relaxed">{gig.description}</p>
        {gig.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {gig.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Packages */}
      <aside className="space-y-4">
        {packages.map((p) => (
          <div key={p.id} className="rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{tierLabel[p.tier] ?? p.title}</span>
              <span className="text-xl font-bold tabular-nums">
                {formatUzs(p.priceUzs)} so&apos;m
              </span>
            </div>
            {p.description && (
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{p.description}</p>
            )}
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              {p.deliveryDays} {t("daysDelivery")} · {p.revisions} {t("revisionsLabel")}
            </p>
          </div>
        ))}
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">{t("orderingSoon")}</p>
      </aside>
    </div>
  );
}
