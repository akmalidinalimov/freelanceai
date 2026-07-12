import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SKILLS, NICHES, specLabel, specSlug } from "@/lib/specializations";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Browse" });
  return { title: t("indexTitle") };
}

export default async function BrowseIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Browse");

  const group = (title: string, specs: typeof SKILLS) => (
    <section className="mb-8">
      <h2 className="font-display mb-4 text-xl font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {specs.map((s) => (
          <Link
            key={s.key}
            href={`/browse/${specSlug(s.key)}`}
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary-ink))]"
          >
            {specLabel(s.key, locale)}
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">{t("indexTitle")}</h1>
      <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t("indexSub")}</p>
      <div className="mt-8">
        {group(t("skillsGroup"), SKILLS)}
        {group(t("nichesGroup"), NICHES)}
      </div>
    </div>
  );
}
