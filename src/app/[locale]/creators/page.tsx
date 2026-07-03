import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAllCreators } from "@/server/services/browse";
import { CreatorCard } from "@/components/creator-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Creators" });
  return { title: t("title") };
}

export default async function CreatorsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Creators");
  const creators = await listAllCreators(60).catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        {creators.length > 0 && (
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{creators.length}</span>
        )}
      </div>
      <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t("sub")}</p>

      {creators.length === 0 ? (
        <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c, i) => (
            <CreatorCard key={c.username ?? i} creator={c} />
          ))}
        </div>
      )}
    </div>
  );
}
