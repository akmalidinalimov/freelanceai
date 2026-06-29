import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublicGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";

export default async function GigsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tn = await getTranslations("Nav");
  const tg = await getTranslations("Gig");
  const gigs = await listPublicGigs({ take: 24 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{tn("explore")}</h1>

      {gigs.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">{tg("noneYet")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => {
            const from = g.packages[0]?.priceUzs ?? 0;
            const seller = g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "";
            return (
              <Link
                key={g.id}
                href={`/gigs/${g.slug}`}
                className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors hover:border-[hsl(var(--primary))]"
              >
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-2xl font-bold text-[hsl(var(--primary))]">
                  {g.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    g.title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <p className="line-clamp-2 font-medium">{g.title}</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{seller}</p>
                <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
                  {tg("from")} {formatUzs(from)} so&apos;m
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
