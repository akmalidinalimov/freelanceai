import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getGigsByIds } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";

/** "Recently viewed" gig row, sourced from the `rv` cookie. Renders nothing when empty. */
export async function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const raw = (await cookies()).get("rv")?.value ?? "";
  const ids = (raw ? decodeURIComponent(raw).split(",") : []).filter(Boolean);
  const filtered = excludeId ? ids.filter((x) => x !== excludeId) : ids;
  if (filtered.length === 0) return null;

  const gigs = await getGigsByIds(filtered);
  if (gigs.length === 0) return null;

  const t = await getTranslations("Gig");
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{t("recentlyViewed")}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {gigs.map((g) => {
          const from = g.packages[0]?.priceUzs ?? 0;
          return (
            <Link
              key={g.id}
              href={`/gigs/${g.slug}`}
              className="flex w-44 shrink-0 flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 transition-colors hover:border-[hsl(var(--primary))]"
            >
              <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-lg font-bold text-[hsl(var(--primary-ink))]">
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  g.title.slice(0, 1).toUpperCase()
                )}
              </div>
              <p className="line-clamp-2 text-xs font-medium">{g.title}</p>
              <p className="mt-auto pt-1 text-xs font-semibold tabular-nums">
                {t("startingFrom")} {formatUzs(from)} so&apos;m
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
