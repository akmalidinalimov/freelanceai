import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listPendingSellers } from "@/server/services/admin-sellers";
import { specLabel } from "@/lib/specializations";
import { AdminSellerActions } from "@/components/admin-seller-actions";

export const dynamic = "force-dynamic";

export default async function AdminSellersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");
  const sellers = await listPendingSellers();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {t("sellersTitle")} ({sellers.length})
      </h1>
      {sellers.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noPendingSellers")}</p>
      ) : (
        <ul className="space-y-4">
          {sellers.map((s) => (
            <li
              key={s.profileId}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.username ? (
                      <Link href={`/creators/${s.username}`} className="hover:underline">
                        {s.name}
                      </Link>
                    ) : (
                      s.name
                    )}
                    {s.username && (
                      <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">@{s.username}</span>
                    )}
                  </p>
                  {s.email && <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.email}</p>}
                </div>
                <AdminSellerActions profileId={s.profileId} />
              </div>

              {s.headline && <p className="mt-3 text-sm font-medium">{s.headline}</p>}
              {s.bio && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">{s.bio}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {s.specializations.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))]"
                  >
                    {specLabel(k, locale)}
                  </span>
                ))}
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("sellerGigCount", { n: s.gigCount })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
