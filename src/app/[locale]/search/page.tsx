import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rateLimitInfo } from "@/lib/rate-limit";
import { matchCreators, matchGigs } from "@/server/services/match";
import { SearchGigCard } from "@/components/search-gig-card";
import { VerifiedBadge } from "@/components/verified-badge";
import { Stars } from "@/components/stars";
import { EmptyState } from "@/components/empty-state";
import { SearchX, Sparkles } from "lucide-react";

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
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { locale } = await params;
  const { q, type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Search");
  const tp = await getTranslations("Profile");
  const tn = await getTranslations("Nav");

  // Gig-first is the default (Fiverr model); creators are a secondary toggle.
  const mode: "gigs" | "creators" = type === "creators" ? "creators" : "gigs";

  // Same 300-char bound as the API route's zod schema — the SSR path must not be an
  // unbounded-input bypass into pg_trgm/Claude.
  const query = (q ?? "").trim().slice(0, 300);
  // This page runs the full match pipeline (Claude parse + embedding + DB) unauthenticated.
  // Share the SAME bucket key + limit as /api/search/match so the two paths draw from ONE
  // 60/min/IP budget instead of stacking into 90 (qa-verifier finding).
  let limited = false;
  if (query) {
    const h = await headers();
    const ip =
      h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    limited = !rateLimitInfo(`search:${ip}`, 60, 60_000).ok;
  }

  const gigData =
    mode === "gigs" && query && !limited ? await matchGigs(query, { locale }) : null;
  const creatorData =
    mode === "creators" && query && !limited ? await matchCreators(query, { locale }) : null;
  const intent = gigData?.intent ?? creatorData?.intent ?? null;

  const link = (t: "gigs" | "creators") =>
    `/search?q=${encodeURIComponent(query)}${t === "creators" ? "&type=creators" : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("subtitleGigs")}</p>

        <form method="get" className="mt-5 flex gap-2">
          {mode === "creators" && <input type="hidden" name="type" value="creators" />}
          <input
            name="q"
            defaultValue={query}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="flex-1 rounded-xl border border-[hsl(var(--input-border))] bg-transparent px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
          >
            {t("button")}
          </button>
        </form>

        {/* Gigs ⇄ Creators toggle */}
        {query && (
          <div className="mt-4 inline-flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 text-sm">
            {(["gigs", "creators"] as const).map((m) => (
              <Link
                key={m}
                href={link(m)}
                aria-current={mode === m ? "page" : undefined}
                className={`rounded-lg px-4 py-1.5 font-semibold transition-colors ${
                  mode === m
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {m === "gigs" ? t("modeGigs") : t("modeCreators")}
              </Link>
            ))}
          </div>
        )}

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

        {/* AI-answer band: what the AI understood + detected specializations */}
        {intent && (intent.understood || intent.specLabels.length > 0) && (
          <div className="mt-7 rounded-2xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary-ink))]">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              {t("understood")}
            </div>
            {intent.understood && (
              <p className="mt-1.5 text-sm text-[hsl(var(--foreground))]">{intent.understood}</p>
            )}
            {intent.specLabels.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {intent.specLabels.map((l) => (
                  <span
                    key={l}
                    className="rounded-lg bg-[hsl(var(--primary))]/12 px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary-ink))]"
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gig-first results grid */}
      {gigData &&
        (gigData.results.length === 0 ? (
          <div className="mx-auto mt-7 max-w-3xl">
            <EmptyState icon={SearchX} title={t("noResultsGigs")} ctaLabel={tn("explore")} ctaHref="/gigs" />
          </div>
        ) : (
          <div className="mt-7">
            <h2 className="mb-4 font-semibold">
              {t("resultsCountGigs", { count: gigData.results.length })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gigData.results.map((m) => (
                <SearchGigCard key={m.gigId} match={m} />
              ))}
            </div>
          </div>
        ))}

      {/* Creators (secondary) */}
      {creatorData && (
        <div className="mx-auto mt-7 max-w-3xl">
          {creatorData.results.length === 0 ? (
            <EmptyState icon={SearchX} title={t("noResults")} ctaLabel={tn("explore")} ctaHref="/gigs" />
          ) : (
            <>
              <h2 className="mb-3 font-semibold">
                {t("resultsCount", { count: creatorData.results.length })}
              </h2>
              <ul className="grid gap-3">
                {creatorData.results.map((r) => {
                  const inner = (
                    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-lg font-bold text-[hsl(var(--primary-ink))]">
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
                        <span className="text-sm font-bold tabular-nums text-[hsl(var(--primary-ink))]">
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
                      {r.username ? <Link href={`/creators/${r.username}`}>{inner}</Link> : inner}
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
