import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const t = await getTranslations();
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-[hsl(var(--primary))]">●</span>
          {t("Brand.name")}
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/gigs"
            className="hidden text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] sm:inline"
          >
            {t("Nav.explore")}
          </Link>
          <Link
            href="/sell"
            className="hidden text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] sm:inline"
          >
            {t("Nav.becomeSeller")}
          </Link>
          <LocaleSwitcher />

          {user ? (
            <>
              <Link href="/dashboard">
                <Button size="sm" variant="outline">
                  {t("Nav.dashboard")}
                </Button>
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button size="sm" variant="ghost" type="submit">
                  {user.firstName ?? user.username ?? "✕"}
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">{t("Nav.login")}</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
