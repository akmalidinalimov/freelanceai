import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { MobileMenu } from "@/components/mobile-menu";
import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const t = await getTranslations();
  const user = await getCurrentUser();

  // Links for the mobile hamburger menu (locale-agnostic hrefs; the i18n Link adds the locale).
  const navItems: { href: string; label: string }[] = [{ href: "/gigs", label: t("Nav.explore") }];
  if (!user?.isSeller) navItems.push({ href: "/sell", label: t("Nav.becomeSeller") });
  if (user) {
    navItems.push({ href: "/dashboard", label: t("Nav.dashboard") });
    if (user.isSeller) navItems.push({ href: "/dashboard/seller", label: t("Dash.creatorView") });
    if (user.role === "ADMIN") navItems.push({ href: "/admin", label: t("Dash.admin") });
    navItems.push({ href: "/messages", label: t("Message.inbox") });
    navItems.push({ href: "/notifications", label: t("Notifications.title") });
  } else {
    navItems.push({ href: "/login", label: t("Nav.login") });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-[hsl(var(--primary))]">●</span>
          {t("Brand.name")}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-3 md:flex">
          <Link
            href="/gigs"
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {t("Nav.explore")}
          </Link>
          {!user?.isSeller && (
            <Link
              href="/sell"
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {t("Nav.becomeSeller")}
            </Link>
          )}
          <LocaleSwitcher />
          {user ? (
            <>
              <NotificationBell />
              <Link href="/dashboard">
                <Button size="sm" variant="outline">
                  {t("Nav.dashboard")}
                </Button>
              </Link>
              {user.isSeller && (
                <Link
                  href="/dashboard/seller"
                  className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {t("Dash.creatorView")}
                </Link>
              )}
              {user.role === "ADMIN" && (
                <Link href="/admin" className="text-sm font-medium text-[hsl(var(--primary))]">
                  {t("Dash.admin")}
                </Link>
              )}
              <form action="/api/auth/logout" method="post">
                <Button size="sm" variant="ghost" type="submit">
                  <span className="inline-block max-w-[6rem] truncate align-bottom">
                    {user.firstName ?? user.username ?? "✕"}
                  </span>
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">{t("Nav.login")}</Button>
            </Link>
          )}
        </nav>

        {/* Mobile cluster: bell + locale + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          {user && <NotificationBell />}
          <LocaleSwitcher />
          <MobileMenu items={navItems} logoutLabel={user ? (user.firstName ?? user.username ?? "✕") : null} />
        </div>
      </div>
    </header>
  );
}
