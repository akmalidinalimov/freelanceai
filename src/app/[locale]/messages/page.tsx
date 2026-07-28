import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listInbox } from "@/server/services/message";
import { InboxSidebar } from "@/components/inbox-sidebar";
import { EmptyState } from "@/components/empty-state";
import { Inbox, MessagesSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Message");
  const rows = await listInbox(user);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">{t("inbox")}</h1>
        <EmptyState icon={Inbox} title={t("inboxEmpty")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)] lg:grid-cols-[340px_1fr]">
        <InboxSidebar rows={rows} className="lg:border-r lg:border-[hsl(var(--border))]" />
        {/* Desktop: prompt to pick a conversation. Mobile shows only the list above. */}
        <div className="hidden min-h-[560px] flex-col items-center justify-center gap-3 p-8 text-center lg:flex">
          <MessagesSquare className="h-10 w-10 text-[hsl(var(--muted-foreground))]/50" aria-hidden />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("selectConversation")}</p>
        </div>
      </div>
    </div>
  );
}
