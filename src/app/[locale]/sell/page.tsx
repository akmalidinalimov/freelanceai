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

  const benefits = [t("sellBenefit1"), t("sellBenefit2"), t("sellBenefit3")];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-3xl font-bold">{t("becomeCreatorTitle")}</h1>
      <p className="text-[hsl(var(--muted-foreground))]">{t("becomeCreatorDesc")}</p>
      <ul className="w-full space-y-3 text-left">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <span aria-hidden className="mt-0.5 text-[hsl(var(--primary))]">✓</span>
            <span className="text-sm">{b}</span>
          </li>
        ))}
      </ul>
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
