import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listNotifications, markNotificationsRead } from "@/server/services/notification";

export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "hozir";
  if (s < 3600) return `${Math.floor(s / 60)} daq`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat`;
  return `${Math.floor(s / 86400)} kun`;
}

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Notifications");
  const items = await listNotifications(user.id);
  // Viewing the page clears the unread badge.
  await markNotificationsRead(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className={n.readAt ? "font-medium" : "font-semibold"}>{n.title}</p>
                  {n.body && (
                    <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{n.body}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{ago(n.createdAt)}</span>
              </div>
            );
            return (
              <li key={n.id} className={n.readAt ? "" : "bg-[hsl(var(--muted))]/30"}>
                {n.link ? (
                  <Link href={n.link} className="block hover:bg-[hsl(var(--muted))]/40">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
