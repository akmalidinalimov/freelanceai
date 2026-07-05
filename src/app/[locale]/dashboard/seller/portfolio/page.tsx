import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSellerUser } from "@/lib/auth-guards";
import { getOwnProfile } from "@/server/services/profile";
import { InstagramConnect } from "@/components/instagram-connect";
import { TelegramPortfolioForm } from "@/components/telegram-portfolio-form";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { Instagram, Send, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortfolioHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ig?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ig } = await searchParams;
  const user = await requireSellerUser(locale);
  const t = await getTranslations("Profile");
  const tt = await getTranslations("Telegram");
  const profile = await getOwnProfile(user.id);

  // Direct uploads only in the upload card; Instagram-synced items are managed by the IG card.
  const uploads = (profile?.portfolio ?? [])
    .filter((p) => p.source !== "instagram")
    .map((p) => ({ id: p.id, mediaUrl: p.mediaUrl, caption: p.caption }));

  const Card = ({
    icon,
    title,
    hint,
    children,
  }: {
    icon: React.ReactNode;
    title: string;
    hint: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-ink))]">
          {icon}
        </span>
        <div>
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2">
        <Link
          href="/dashboard/seller/profile"
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          ← {t("portfolioBack")}
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("portfolioHubTitle")}</h1>
        {user.username && (
          <Link href={`/creators/${user.username}`} className="text-sm text-[hsl(var(--primary-ink))] hover:underline">
            {t("viewPublic")}
          </Link>
        )}
      </div>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">{t("portfolioHubIntro")}</p>

      <div className="flex flex-col gap-4">
        <Card icon={<Upload className="h-5 w-5" aria-hidden />} title={t("portfolioUploadTitle")} hint={t("portfolioHint")}>
          <PortfolioEditor items={uploads} />
        </Card>

        <Card icon={<Instagram className="h-5 w-5" aria-hidden />} title="Instagram" hint={t("instagramHint")}>
          <InstagramConnect
            connected={Boolean(profile?.instagramUserId)}
            handle={profile?.instagramUsername ?? null}
            syncedAt={profile?.instagramSyncedAt?.toISOString() ?? null}
            marker={ig}
          />
        </Card>

        <Card icon={<Send className="h-5 w-5" aria-hidden />} title={tt("channel")} hint={tt("channelHint")}>
          <TelegramPortfolioForm
            initial={{
              channel: profile?.telegramChannel ?? "",
              posts: profile?.telegramPosts ?? [],
            }}
          />
        </Card>
      </div>
    </div>
  );
}
