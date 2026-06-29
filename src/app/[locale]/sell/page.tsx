import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { BecomeCreatorButton } from "@/components/become-creator-button";

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user?.isSeller) {
    redirect({ href: "/dashboard/seller", locale });
    return null;
  }

  const t = await getTranslations("Gig");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold">{t("becomeCreatorTitle")}</h1>
      <p className="text-[hsl(var(--muted-foreground))]">{t("becomeCreatorDesc")}</p>
      {user ? (
        <BecomeCreatorButton locale={locale} />
      ) : (
        <Link href="/login">
          <Button size="lg">{t("becomeCreator")}</Button>
        </Link>
      )}
    </div>
  );
}
