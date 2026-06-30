import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { listPublicGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const NAME_KEY = { uz: "nameUz", ru: "nameRu", en: "nameEn" } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const cat = await prisma.category.findUnique({ where: { slug } }).catch(() => null);
  if (!cat) return {};
  const name = cat[NAME_KEY[locale as Locale]];
  return { title: name, description: `${name} — FreelanceAI` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) notFound();
  const name = cat[NAME_KEY[locale as Locale]];
  const tg = await getTranslations("Gig");
  const gigs = await listPublicGigs({ categorySlug: slug, take: 48 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">{name}</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        {gigs.length} {tg("results")}
      </p>
      {gigs.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">{tg("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => {
            const from = g.packages[0]?.priceUzs ?? 0;
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
