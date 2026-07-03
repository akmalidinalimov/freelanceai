import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { ApiError } from "@/lib/api";
import { getConversationForAdmin } from "@/server/services/admin-conversations";
import { formatUzs } from "@/lib/utils";

export const dynamic = "force-dynamic";

const dt = (d: Date) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const who = (u: { username: string | null; firstName: string | null; email: string | null } | null) =>
  u?.username ? `@${u.username}` : (u?.firstName ?? u?.email ?? "—");

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireAdminUser(locale);
  const c = await getConversationForAdmin(admin, id).catch((e) => {
    if (e instanceof ApiError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!c) notFound();

  // Orphaned order-scoped conversations (order deleted → all participant refs null)
  // fall back to first-sender-left so the two sides still read as a dialogue.
  const buyerId = c.buyer?.id ?? c.messages[0]?.senderId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin/conversations" className="text-[hsl(var(--primary))] hover:underline">
          ← All conversations
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">
        {who(c.buyer)} ↔ {who(c.seller)}
      </h1>
      <p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">
        {c.gigTitle ?? "Direct conversation"}
        {c.order && (
          <>
            {" "}· Order <span className="font-mono">{c.order.id.slice(0, 8)}</span> ({c.order.status},{" "}
            {formatUzs(c.order.amountUzs)} so&apos;m)
          </>
        )}
        {" "}· {c.totalMessages} messages
        {c.totalMessages > c.messages.length && ` (showing last ${c.messages.length})`}
      </p>
      <p className="mb-6 rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] px-3 py-2 text-xs text-[hsl(var(--warning))]">
        Read-only moderation view. This access has been recorded in the audit log under your admin
        account.
      </p>

      <div className="space-y-3">
        {c.messages.map((m) => {
          const isBuyer = m.senderId === buyerId;
          return (
            <div key={m.id} className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-xl border px-3 py-2 text-sm ${
                  isBuyer
                    ? "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40"
                    : "border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5"
                }`}
              >
                <p className="mb-0.5 text-xs font-semibold">
                  {m.sender.username ? `@${m.sender.username}` : (m.sender.firstName ?? "—")}
                  <span className="ml-2 font-normal text-[hsl(var(--muted-foreground))]">
                    {dt(m.createdAt)}
                  </span>
                </p>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.fileUrls.length > 0 && (
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {m.fileUrls.length} attachment{m.fileUrls.length > 1 ? "s" : ""} (not previewed
                    here)
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {c.messages.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No messages yet.</p>
        )}
      </div>
    </div>
  );
}
