import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireSellerUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getGigForEdit } from "@/server/services/gig";
import { GigForm, type GigInitial } from "@/components/gig-form";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Tier = "BASIC" | "STANDARD" | "PREMIUM";

export default async function EditGigPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireSellerUser(locale);
  const t = await getTranslations("Gig");

  const gig = await getGigForEdit(id, user).catch(() => null);
  if (!gig) notFound();

  const rows = await prisma.category.findMany({ orderBy: { slug: "asc" } });
  const nameKey = ({ uz: "nameUz", ru: "nameRu", en: "nameEn" } as const)[locale as Locale];
  const categories = rows.map((c) => ({ id: c.id, name: c[nameKey] }));

  const faqArr = Array.isArray(gig.faq) ? (gig.faq as { q: string; a: string }[]) : [];
  const packages: Partial<Record<Tier, GigInitial["packages"][Tier]>> = {};
  for (const p of gig.packages) {
    packages[p.tier] = {
      title: p.title,
      priceUzs: String(p.priceUzs),
      deliveryDays: String(p.deliveryDays),
      revisions: String(p.revisions),
    };
  }

  const initial: GigInitial = {
    title: gig.title,
    description: gig.description,
    categoryId: gig.categoryId ?? "",
    tags: gig.tags.join(", "),
    coverUrl: gig.coverUrl ?? undefined,
    galleryUrls: gig.galleryUrls,
    faq: faqArr,
    extras: gig.extras.map((e) => ({
      title: e.title,
      priceUzs: String(e.priceUzs),
      deliveryDays: e.deliveryDays ? String(e.deliveryDays) : "",
    })),
    packages,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("editGigTitle")}</h1>
      <GigForm locale={locale} categories={categories} gigId={gig.id} initial={initial} />
    </div>
  );
}
