import { setRequestLocale } from "next-intl/server";
import { EmailCallback } from "@/components/email-callback";
import { safeInternalPath } from "@/lib/utils";

export default async function EmailAuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token, next } = await searchParams;
  return <EmailCallback token={token ?? ""} locale={locale} next={safeInternalPath(next ?? null) ?? undefined} />;
}
