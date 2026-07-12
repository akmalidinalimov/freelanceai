import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  // not-found.tsx doesn't receive params; fall back to English if the locale context is absent.
  let t: ((k: string) => string) | null = null;
  try {
    t = await getTranslations("Errors");
  } catch {
    t = null;
  }
  const title = t ? t("notFoundTitle") : "Page not found";
  const desc = t ? t("notFoundDesc") : "The page you're looking for doesn't exist.";
  const home = t ? t("goHome") : "Go home";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-[hsl(var(--primary-ink))]">404</p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-[hsl(var(--muted-foreground))]">{desc}</p>
      <Link href="/">
        <Button>{home}</Button>
      </Link>
    </div>
  );
}
