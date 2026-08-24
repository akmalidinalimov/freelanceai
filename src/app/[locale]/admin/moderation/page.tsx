import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listPendingGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";
import { ModerationActions } from "@/components/moderation-actions";

export const dynamic = "force-dynamic";

/**
 * Gig moderation queue. Public gig pages 404 while PENDING_REVIEW, so this queue
 * shows EVERYTHING the admin needs to judge in place: cover, full description,
 * every package, tags — and the seller's track record one click away.
 */
export default async function ModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");
  const gigs = await listPendingGigs();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {t("moderation")} ({gigs.length})
      </h1>
      {gigs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noPendingGigs")}</p>
      ) : (
        <ul className="space-y-4">
          {gigs.map((g) => {
            const sellerName = g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "—";
            return (
              <li key={g.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="flex flex-wrap items-start gap-4">
                  {/* Cover (or the no-cover placeholder state, which is itself a signal) */}
                  <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--muted))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-[hsl(var(--muted-foreground))]">
                        {t("noCover")}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{g.title}</p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      <Link href={`/admin/users/${g.seller.id}`} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
                        {sellerName}
                      </Link>
                      {" · "}
                      {g.seller._count.gigs} {t("modGigs")} · {t("modJoined")}{" "}
                      {new Date(g.seller.createdAt).toISOString().slice(0, 10)}
                      {g.seller._count.flags > 0 && (
                        <span className="ml-1 font-bold text-[hsl(var(--danger))]">🚩 {g.seller._count.flags}</span>
                      )}
                    </p>
                    {g.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {g.tags.slice(0, 6).map((tag) => (
                          <span key={tag} className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  <ModerationActions gigId={g.id} />
                </div>

                {/* Full description + package ladder — expanded by default: judging IS the job. */}
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {t("modDetails")}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[hsl(var(--foreground))]">{g.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.packages.map((p) => (
                      <span
                        key={p.id}
                        className="rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs"
                      >
                        <b>{p.tier}</b> · {formatUzs(p.priceUzs)} so&apos;m · {p.deliveryDays}k · {p.revisions}✎
                      </span>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
