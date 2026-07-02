import { setRequestLocale } from "next-intl/server";
import { EmailCallback } from "@/components/email-callback";

export default async function EmailAuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  return <EmailCallback token={token ?? ""} locale={locale} />;
}
