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
    <div className="relative mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-4 mx-auto h-52 max-w-sm rounded-[50%] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, hsl(var(--primary)/.16), transparent 70%), radial-gradient(40% 50% at 70% 60%, hsl(var(--accent)/.12), transparent 70%)",
        }}
      />
      <div className="relative text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>
      <div className="relative">
        <OnboardingChoice locale={locale} />
      </div>
    </div>
  );
}
