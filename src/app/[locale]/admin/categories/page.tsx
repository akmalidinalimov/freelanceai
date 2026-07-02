import { setRequestLocale } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { listCategoriesWithCounts } from "@/server/services/category";
import { CategoryManager } from "@/components/category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const categories = await listCategoriesWithCounts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Categories</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Catalog categories. A category with gigs cannot be deleted — reassign its gigs first.
      </p>
      <CategoryManager categories={categories} />
    </div>
  );
}
