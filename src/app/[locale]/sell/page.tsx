import { setRequestLocale, getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");
  return <ComingSoon title={t("becomeSeller")} />;
}
