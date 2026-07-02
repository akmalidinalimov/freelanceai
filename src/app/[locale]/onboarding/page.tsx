import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { OnboardingChoice } from "@/components/onboarding-choice";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }
  // Already onboarded (or admin) → into the app.
  if (user.onboardingCompleted || user.role === "ADMIN") {
    redirect({ href: "/", locale });
    return null;
  }

  const t = await getTranslations("Onboarding");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>
      <OnboardingChoice locale={locale} />
    </div>
  );
}
