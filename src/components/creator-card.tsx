import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { specLabel } from "@/lib/specializations";
import { VerifiedBadge } from "@/components/verified-badge";
import { Stars } from "@/components/stars";
import type { BrowseCreator } from "@/server/services/browse";

export async function CreatorCard({ creator }: { creator: BrowseCreator }) {
  const t = await getTranslations("Profile");
  const locale = await getLocale();

  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-[0_18px_40px_-24px_rgba(11,18,32,0.35)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-lg font-bold text-[hsl(var(--primary))]">
          {creator.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            creator.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold">{creator.name}</span>
            {creator.verified && <VerifiedBadge label={t("verified")} />}
          </div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(`level.${creator.level}`)}</span>
        </div>
      </div>

      {creator.headline && (
        <p className="mt-3 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{creator.headline}</p>
      )}

      {creator.specializations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {creator.specializations.slice(0, 3).map((k) => (
            <span
              key={k}
              className="rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]"
            >
              {specLabel(k, locale)}
            </span>
          ))}
        </div>
      )}

      {creator.ratingCount > 0 && (
        <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs">
          <Stars value={creator.ratingAvg} />
          <span className="font-medium tabular-nums">{creator.ratingAvg.toFixed(1)}</span>
          <span className="text-[hsl(var(--muted-foreground))]">({creator.ratingCount})</span>
        </div>
      )}
    </div>
  );

  return creator.username ? <Link href={`/creators/${creator.username}`}>{inner}</Link> : inner;
}
