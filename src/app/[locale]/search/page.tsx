import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rateLimitInfo } from "@/lib/rate-limit";
import { matchCreators } from "@/server/services/match";
import { VerifiedBadge } from "@/components/verified-badge";
import { Stars } from "@/components/stars";
import { EmptyState } from "@/components/empty-state";
import { SearchX } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  return { title: t("title") };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Search");
  const tp = await getTranslations("Profile");
  const tn = await getTranslations("Nav");

  // Same 300-char bound as the API route's zod schema — the SSR path must not be an
  // unbounded-input bypass into pg_trgm/Claude.
  const query = (q ?? "").trim().slice(0, 300);
  // This page runs the full match pipeline unauthenticated, so throttle by IP here too —
  // otherwise it's an un-rate-limited bypass of the /api/search/match limit.
  let limited = false;
  if (query) {
    const h = await headers();
    const ip =
      h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    limited = !rateLimitInfo(`search-ssr:${ip}`, 30, 60_000).ok;
  }
  const data = query && !limited ? await matchCreators(query, { locale }) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>

      <form method="get" className="mt-5 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-transparent px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
        >
          {t("button")}
        </button>
      </form>

      {!query && (
        <div className="mt-6 flex flex-wrap gap-2">
          {[t("ex1"), t("ex2"), t("ex3")].map((ex) => (
            <Link
              key={ex}
              href={`/search?q=${encodeURIComponent(ex)}`}
              className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
            >
              {ex}
            </Link>
          ))}
        </div>
      )}

      {limited && (
        <p className="mt-7 text-sm text-[hsl(var(--muted-foreground))]">{t("rateLimited")}</p>
      )}

      {data && (
        <div className="mt-7">
          {data.intent.understood && (
            <p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">
              {data.intent.understood}
            </p>
          )}
          {data.intent.specLabels.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                {t("understood")}:
              </span>
              {data.intent.specLabels.map((l) => (
                <span
                  key={l}
                  className="rounded-lg bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary))]"
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          {data.results.length === 0 ? (
            <EmptyState icon={SearchX} title={t("noResults")} ctaLabel={tn("explore")} ctaHref="/gigs" />
          ) : (
            <>
              <h2 className="mb-3 font-semibold">
                {t("resultsCount", { count: data.results.length })}
              </h2>
              <ul className="grid gap-3">
                {data.results.map((r) => {
                  const inner = (
                    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-lg font-bold text-[hsl(var(--primary))]">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          r.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.name}</span>
                          {r.verified && <VerifiedBadge label={tp("verified")} />}
                          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium">
                            {tp(`level.${r.level}`)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                          {r.matchedSpecs.length > 0
                            ? t("reasonSpecs", { specs: r.matchedSpecs.slice(0, 2).join(" + ") })
                            : t("reasonGeneric")}
                          {r.completedOrders > 0 && ` · ${t("orders", { count: r.completedOrders })}`}
                        </p>
                        {r.ratingCount > 0 && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs">
                            <Stars value={r.ratingAvg} />
                            <span className="font-medium tabular-nums">{r.ratingAvg.toFixed(1)}</span>
                            <span className="text-[hsl(var(--muted-foreground))]">({r.ratingCount})</span>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-center">
                        <span className="text-sm font-bold tabular-nums text-[hsl(var(--primary))]">
                          {r.score}%
                        </span>
                        <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                          {t("match")}
                        </span>
                      </div>
                    </div>
                  );
                  return (
                    <li key={r.sellerId}>
                      {r.username ? (
                        <Link href={`/creators/${r.username}`}>{inner}</Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
