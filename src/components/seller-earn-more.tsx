import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface GigLite {
  id: string;
  status: string;
  title: string;
  _count: { extras: number; packages: number };
}

/**
 * "Earn more" nudge — the single highest-leverage, still-open income action for this seller,
 * derived from their real gigs. Add-ons are the biggest average-order-value lever, so a live
 * gig with no extras is the top nudge; then a gig with fewer than 3 tiers. Renders nothing when
 * there's nothing actionable, so it never nags a fully-optimized seller.
 */
export async function SellerEarnMore({ gigs }: { gigs: GigLite[] }) {
  const t = await getTranslations("Dash");
  const active = gigs.filter((g) => g.status === "ACTIVE");
  if (active.length === 0) return null;

  const noExtras = active.filter((g) => g._count.extras === 0);
  const fewTiers = active.filter((g) => g._count.packages < 3);

  let body: string | null = null;
  let href = "/dashboard/seller/gigs";
  if (noExtras.length > 0) {
    body = t("earnAddExtras", { count: noExtras.length });
    href = `/dashboard/seller/gigs/${noExtras[0].id}/edit`;
  } else if (fewTiers.length > 0) {
    body = t("earnAddTiers", { count: fewTiers.length });
    href = `/dashboard/seller/gigs/${fewTiers[0].id}/edit`;
  }
  if (!body) return null;

  return (
    <Link
      href={href}
      className="mb-5 flex items-center gap-3 rounded-2xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/[0.06] p-4 transition-colors hover:bg-[hsl(var(--primary))]/[0.1]"
    >
      <span aria-hidden className="text-xl">📈</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{t("earnMoreTitle")}</span>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{body}</span>
      </span>
      <span className="ml-auto text-[hsl(var(--muted-foreground))]" aria-hidden>→</span>
    </Link>
  );
}
