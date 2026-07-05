import { getTranslations } from "next-intl/server";
import { Star, Clock, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { coverVariant } from "@/lib/cover-variant";
import { VerifiedBadge } from "@/components/verified-badge";
import type { GigMatch } from "@/server/services/match";

const BAND_STYLE: Record<GigMatch["band"], string> = {
  strong: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  good: "bg-[hsl(var(--info))]/90 text-white",
  broad: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

/** Budget level indicator — three segments, filled to `tier`. Deliberately shows NO exact
 * price (the buyer discovers pricing inside the gig); it only signals relative budget. */
function BudgetMeter({ tier, label, hint }: { tier: 1 | 2 | 3; label: string; hint: string }) {
  return (
    <span
      title={hint}
      aria-label={`${label}: ${tier}/3`}
      className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--background))]/85 px-2 py-1 text-[10px] font-semibold text-[hsl(var(--foreground))] shadow-sm backdrop-blur-sm"
    >
      <span className="uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-sm ${i <= tier ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"}`}
            style={{ height: `${4 + i * 3}px` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Gig-first search result: a gig cover + why-matched + embedded seller trust + niche
 * proof + budget tier. No exact price. Links straight into the gig detail page. */
export async function SearchGigCard({ match: m }: { match: GigMatch }) {
  const t = await getTranslations("Search");
  const tp = await getTranslations("Profile");
  const v = coverVariant(m.gigId);

  const proofText = m.proof
    ? m.proof.tier === "proven"
      ? t("proofProven", { label: m.proof.label, count: m.proof.orders })
      : m.proof.tier === "supported"
        ? t("proofSupported", { label: m.proof.label })
        : t("proofDeclared", { label: m.proof.label })
    : null;

  return (
    <Link
      href={`/gigs/${m.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--primary))]/30 hover:shadow-[var(--shadow-hover)]"
    >
      {/* Cover with match band + budget meter */}
      <div className="relative aspect-video overflow-hidden">
        {m.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ objectPosition: v.pos, transform: v.flip ? "scaleX(-1)" : undefined }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/prism/pattern-sweep-v2.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{
              objectPosition: v.pos,
              transform: v.flip ? "scaleX(-1)" : undefined,
              filter: `brightness(1.02) contrast(1.06) saturate(1.06)${v.hue ? ` hue-rotate(${v.hue}deg)` : ""}`,
            }}
          />
        )}
        <span
          className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${BAND_STYLE[m.band]}`}
        >
          <Sparkles className="h-3 w-3" strokeWidth={2.25} />
          {t(m.band === "strong" ? "bandStrong" : m.band === "good" ? "bandGood" : "bandBroad")}
        </span>
        <span className="absolute right-2 top-2">
          <BudgetMeter tier={m.budgetTier} label={t("budget")} hint={t("budgetHint")} />
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-[hsl(var(--foreground))]/75 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm">
          {m.score}% {t("match")}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="line-clamp-2 min-h-[2.6em] font-semibold leading-snug">{m.title}</p>

        {/* Why matched (AI reason) */}
        {m.whyMatched.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--primary-ink))]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="font-medium">{m.whyMatched.slice(0, 2).join(" · ")}</span>
          </p>
        )}

        {/* Seller trust row */}
        <div className="mt-1 flex items-center gap-2">
          {m.seller.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.seller.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-[10px] font-bold text-[hsl(var(--primary-ink))]">
              {m.seller.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm text-[hsl(var(--muted-foreground))]">{m.seller.name}</span>
          {m.seller.verified && <VerifiedBadge label={tp("verified")} />}
          {m.seller.ratingCount > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="font-semibold tabular-nums">{m.seller.ratingAvg.toFixed(1)}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">({m.seller.ratingCount})</span>
            </span>
          )}
        </div>

        {/* Niche proof badge */}
        {proofText && (
          <p
            className={`flex items-center gap-1.5 text-[11px] font-medium ${
              m.proof!.tier === "proven"
                ? "text-[hsl(var(--success))]"
                : "text-[hsl(var(--muted-foreground))]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {proofText}
          </p>
        )}

        {/* Footer: delivery + CTA */}
        <div className="mt-auto flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
          <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t("inDays", { days: m.fromDeliveryDays })}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary-ink))] transition-transform group-hover:translate-x-0.5">
            {t("viewGig")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </Link>
  );
}
