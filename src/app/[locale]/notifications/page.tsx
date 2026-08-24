import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listNotifications, markNotificationsRead } from "@/server/services/notification";
import { NotificationsList } from "@/components/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Notifications");
  const items = await listNotifications(user.id);
  // Viewing the page clears the unread badge.
  await markNotificationsRead(user.id);

  const initial = items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
      <NotificationsList initial={initial} />
    </div>
  );
}
