import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listInbox } from "@/server/services/message";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t("inbox")}</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("inboxEmpty")}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-[hsl(var(--muted))]/40">
                <div className="min-w-0">
                  <p className={c.unread > 0 ? "font-semibold" : "font-medium"}>{c.counterpart || "—"}</p>
                  {c.context && <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{c.context}</p>}
                  {c.lastBody && (
                    <p className={`truncate text-sm ${c.unread > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {c.lastBody}
                    </p>
                  )}
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary-foreground))]">
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
