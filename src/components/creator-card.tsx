import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { specLabel } from "@/lib/specializations";
import { VerifiedBadge } from "@/components/verified-badge";
import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/stars";
import { cardClass } from "@/components/ui/card";
import type { BrowseCreator } from "@/server/services/browse";

export async function CreatorCard({ creator }: { creator: BrowseCreator }) {
  const t = await getTranslations("Profile");
  const locale = await getLocale();

  const inner = (
    <div className={cardClass(true, "flex h-full flex-col p-4")}>
      <div className="flex items-center gap-3">
        <Avatar src={creator.avatar} name={creator.name} className="h-12 w-12 rounded-xl text-lg" />
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
              className="rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-0.5 text-[11px] font-medium text-[hsl(var(--primary-ink))]"
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
