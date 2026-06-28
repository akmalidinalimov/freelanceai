import { setRequestLocale, getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");
  // Phase 1 will replace this with the Telegram Login Widget.
  return <ComingSoon title={t("login")} />;
}
