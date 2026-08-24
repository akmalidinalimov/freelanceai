import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { MobileMenu } from "@/components/mobile-menu";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const t = await getTranslations();
  const user = await getCurrentUser();

  // Links for the mobile hamburger menu (locale-agnostic hrefs; the i18n Link adds the locale).
  const navItems: { href: string; label: string }[] = [
    { href: "/gigs", label: t("Nav.explore") },
    { href: "/creators", label: t("Nav.creators") },
  ];
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
        <Link
          href="/"
          data-miniapp-hide
          className="font-display flex items-center gap-1.5 text-lg font-extrabold tracking-tight"
        >
          <span className="text-[hsl(var(--primary-ink))]">●</span>
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
          <Link
            href="/creators"
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {t("Nav.creators")}
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
                <Link href="/admin" className="text-sm font-medium text-[hsl(var(--primary-ink))]">
                  {t("Dash.admin")}
                </Link>
              )}
              {/* Identity is a LINK, never a submit. This used to be the logout form's button
                  with the user's own name as its label, so tapping your name signed you out. */}
              <Link href="/dashboard/settings" className="inline-flex items-center gap-2">
                <Avatar src={user.photoUrl} name={user.firstName ?? user.username ?? "?"} size="sm" />
                <span className="inline-block max-w-[6rem] truncate align-bottom text-sm font-medium">
                  {user.firstName ?? user.username ?? t("Nav.account")}
                </span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button size="sm" variant="ghost" type="submit">
                  {t("Nav.logout")}
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">{t("Nav.login")}</Button>
            </Link>
          )}
        </nav>

        {/* Mobile cluster. ml-auto, not justify-between: inside the Mini App the brand is hidden,
            which left this as the row's only child and packed it to the LEFT — dragging the
            hamburger to the screen edge and pushing its panel off-screen. */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {user && (
            <Link href="/dashboard/settings" aria-label={t("Nav.account")} className="mr-1">
              <Avatar src={user.photoUrl} name={user.firstName ?? user.username ?? "?"} size="sm" />
            </Link>
          )}
          {user && <NotificationBell />}
          <LocaleSwitcher />
          <MobileMenu items={navItems} logoutLabel={user ? t("Nav.logout") : null} />
        </div>
      </div>
    </header>
  );
}
