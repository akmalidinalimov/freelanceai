import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getAdminPendingCounts } from "@/server/services/analytics";
import { AdminSidebar, type AdminNavGroup } from "@/components/admin-sidebar";
import { AdminQuickSearch } from "@/components/admin-quick-search";

/**
 * Admin shell: every /admin page gets the grouped sidebar (desktop) or chip bar
 * (mobile) with live queue badges — one navigation, everywhere, instead of the
 * old links-on-the-dashboard-only pattern.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale); // defense-in-depth; every page also guards itself

  const t = await getTranslations("Admin");
  const td = await getTranslations("Dispute");
  // Queue sizes are best-effort — the shell must render even if a count query hiccups.
  const [pending, sellersPending] = await Promise.all([
    getAdminPendingCounts().catch(() => ({ gigs: 0, kyc: 0, disputes: 0, payouts: 0 })),
    prisma.sellerProfile.count({ where: { approvalStatus: "PENDING" } }).catch(() => 0),
  ]);

  const groups: AdminNavGroup[] = [
    {
      heading: t("navMain"),
      items: [
        { href: "/admin", label: t("dashboard") },
        { href: "/admin/stats", label: t("navStats") },
      ],
    },
    {
      heading: t("navQueues"),
      items: [
        { href: "/admin/moderation", label: t("moderation"), badge: pending.gigs },
        { href: "/admin/sellers", label: t("sellersTitle"), badge: sellersPending },
        { href: "/admin/kyc", label: "KYC", badge: pending.kyc },
        { href: "/admin/disputes", label: td("adminTitle"), badge: pending.disputes },
      ],
    },
    {
      heading: t("navPeople"),
      items: [
        { href: "/admin/users", label: t("users") },
        { href: "/admin/conversations", label: t("navConversations") },
        { href: "/admin/flags", label: t("navFlags") },
      ],
    },
    {
      heading: t("navMoney"),
      items: [
        { href: "/admin/settlements", label: t("title"), badge: pending.payouts },
        { href: "/admin/coupons", label: t("coupons") },
      ],
    },
    {
      heading: t("navSystem"),
      items: [
        { href: "/admin/broadcast", label: t("navBroadcast") },
        { href: "/admin/categories", label: t("navCategories") },
        { href: "/admin/audit", label: t("audit") },
        { href: "/admin/search-debug", label: t("navSearchDebug") },
      ],
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 pt-4 lg:flex-row lg:gap-2 lg:px-6">
      <AdminSidebar groups={groups} />
      <div className="min-w-0 flex-1">
        <div className="pt-2 lg:px-4">
          <AdminQuickSearch />
        </div>
        {children}
      </div>
    </div>
  );
}
