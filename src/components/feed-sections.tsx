import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatUzs } from "@/lib/utils";
import type { FeedSections as Sections, FeedGig } from "@/server/services/engagement";

/** Recommendation modules (followed / for-you / trending) — dashboard surface. */
async function Rail({ title, gigs }: { title: string; gigs: FeedGig[] }) {
  const t = await getTranslations("Gig");
  if (gigs.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {gigs.map((g) => (
          <Link
            key={g.id}
            href={`/gigs/${g.slug}`}
            className="flex flex-col rounded-lg border border-[hsl(var(--border))] p-2 transition-colors hover:border-[hsl(var(--primary))]"
          >
            <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-sm font-bold text-[hsl(var(--primary-ink))]">
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                g.title.slice(0, 1).toUpperCase()
              )}
            </div>
            <p className="line-clamp-2 text-xs font-medium">{g.title}</p>
            <p className="mt-auto pt-1 text-xs text-[hsl(var(--muted-foreground))]">{g.sellerName}</p>
            <p className="text-xs font-semibold tabular-nums">
              {t("startingFrom")} {formatUzs(g.fromUzs)} so&apos;m
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function FeedSectionsView({ feed }: { feed: Sections }) {
  const t = await getTranslations("Feed");
  return (
    <>
      <Rail title={t("fromFollowed")} gigs={feed.fromFollowed} />
      <Rail title={t("forYou")} gigs={feed.forYou} />
      <Rail title={t("trending")} gigs={feed.trending} />
    </>
  );
}
