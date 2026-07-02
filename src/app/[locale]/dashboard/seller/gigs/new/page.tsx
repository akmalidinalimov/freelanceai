import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireSellerUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { GigForm } from "@/components/gig-form";
import type { Locale } from "@/i18n/routing";

export default async function NewGigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSellerUser(locale);
  const t = await getTranslations("Gig");

  const rows = await prisma.category.findMany({ orderBy: { slug: "asc" } });
  const nameKey = (
    { uz: "nameUz", ru: "nameRu", en: "nameEn" } as const
  )[locale as Locale];
  const categories = rows.map((c) => ({ id: c.id, name: c[nameKey] }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("createTitle")}</h1>
      <GigForm locale={locale} categories={categories} />
    </div>
  );
}
