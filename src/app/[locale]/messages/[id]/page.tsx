import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listConversationMessages, markConversationRead } from "@/server/services/message";
import { MessageThread } from "@/components/message-thread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: convId } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Message");

  const initial = await listConversationMessages(convId, user).catch(() => null);
  if (initial === null) notFound();
  await markConversationRead(convId, user);

  const msgs = initial.map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    sender: { firstName: m.sender.firstName, name: m.sender.name, username: m.sender.username },
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/messages" className="text-sm text-[hsl(var(--primary))] hover:underline">
        ← {t("inbox")}
      </Link>
      <div className="mt-3">
        <MessageThread conversationId={convId} currentUserId={user.id} initial={msgs} />
      </div>
    </div>
  );
}
