import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[hsl(var(--border))] py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-[hsl(var(--muted-foreground))] sm:flex-row">
        <p>
          © {year} {t("Brand.name")}. {t("Footer.rights")}
        </p>
        <p>{t("Brand.tagline")}</p>
      </div>
    </footer>
  );
}
