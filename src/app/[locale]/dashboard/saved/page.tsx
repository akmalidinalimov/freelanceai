import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listCollections, listSavedWithCollection } from "@/server/services/collection";
import { formatUzs } from "@/lib/utils";
import { CreateCollection, DeleteCollection, CollectionSelect } from "@/components/collection-controls";
import { EmptyState } from "@/components/empty-state";
import { Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SavedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ collection?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const { collection } = await searchParams;
  const t = await getTranslations("Collections");
  const tg = await getTranslations("Gig");
  const tn = await getTranslations("Nav");

  const collections = await listCollections(user.id);
  const saved = await listSavedWithCollection(user.id, collection);
  const tabBase = "rounded-full px-3 py-1 text-sm";
  const active = (id?: string) =>
    (collection ?? "") === (id ?? "")
      ? `${tabBase} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`
      : `${tabBase} bg-[hsl(var(--muted))]`;
  const collOptions = collections.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/dashboard/saved" className={active()}>
          {t("all")}
        </Link>
        {collections.map((c) => (
          <Link key={c.id} href={`/dashboard/saved?collection=${c.id}`} className={active(c.id)}>
            {c.name} ({c._count.savedGigs})
          </Link>
        ))}
        {collection && <DeleteCollection id={collection} />}
      </div>

      <div className="mb-6">
        <CreateCollection />
      </div>

      {saved.length === 0 ? (
        <EmptyState icon={Heart} title={tg("noSaved")} ctaLabel={tn("explore")} ctaHref="/gigs" />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {saved.map(({ gig: g, collectionId }) => {
            const from = g.packages[0]?.priceUzs ?? 0;
            return (
              <li key={g.id} className="flex flex-col rounded-xl border border-[hsl(var(--border))] p-3">
                <Link href={`/gigs/${g.slug}`} className="flex flex-col hover:opacity-90">
                  <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-lg font-bold text-[hsl(var(--primary-ink))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      g.title.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
                  <p className="pt-1 text-sm font-semibold tabular-nums">
                    {tg("startingFrom")} {formatUzs(from)} so&apos;m
                  </p>
                </Link>
                {collOptions.length > 0 && (
                  <CollectionSelect gigId={g.id} collections={collOptions} current={collectionId} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
