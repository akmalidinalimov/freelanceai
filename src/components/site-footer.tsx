import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[hsl(var(--border))] py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-[hsl(var(--muted-foreground))] sm:flex-row">
        <p>
          © {year} {t("Brand.name")}. {t("Footer.rights")}
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/legal/terms" className="hover:text-[hsl(var(--foreground))] hover:underline">
            {t("Footer.terms")}
          </Link>
          <Link href="/legal/privacy" className="hover:text-[hsl(var(--foreground))] hover:underline">
            {t("Footer.privacy")}
          </Link>
        </nav>
        <p>{t("Brand.tagline")}</p>
      </div>
    </footer>
  );
}
