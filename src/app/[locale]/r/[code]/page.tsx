import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { referrerIdForCode } from "@/server/services/referral";
import { getCurrentUser } from "@/lib/session";
import { ReferralCookieSetter } from "@/components/referral-cookie-setter";

export const dynamic = "force-dynamic";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const referrerId = await referrerIdForCode(code).catch(() => null);
  // Invalid code, or already signed in → just go home.
  if (!referrerId) redirect({ href: "/", locale });
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect({ href: "/", locale });

  const t = await getTranslations("Referral");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <ReferralCookieSetter referrerId={referrerId!} />
      <h1 className="text-3xl font-bold">{t("invitedTitle")}</h1>
      <p className="text-[hsl(var(--muted-foreground))]">{t("invitedDesc")}</p>
      <Link href="/login">
        <Button size="lg">{t("getStarted")}</Button>
      </Link>
    </div>
  );
}
