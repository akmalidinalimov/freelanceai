import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StatusChip } from "@/components/status-chip";
import { initialOf } from "@/lib/order-due";
import type { InboxRow } from "@/server/services/message";

const GRAD = [
  "linear-gradient(135deg, hsl(173 70% 40%), hsl(196 75% 45%))",
  "linear-gradient(135deg, hsl(11 80% 60%), hsl(340 75% 58%))",
  "linear-gradient(135deg, hsl(262 60% 58%), hsl(218 75% 55%))",
];

/** Hash a string to a stable 0..2 gradient index (deterministic avatar colour). */
function gradFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return GRAD[Math.abs(h) % GRAD.length];
}

/**
 * The messages inbox list, rendered as a sidebar on desktop (two-pane) and the
 * full list on mobile. Each row: avatar, counterpart, order-status chip, last-message
 * preview, relative time, and an unread badge. The active conversation is highlighted.
 */
export async function InboxSidebar({
  rows,
  activeId,
  className = "",
}: {
  rows: InboxRow[];
  activeId?: string;
  className?: string;
}) {
  const t = await getTranslations("Message");
  const tc = await getTranslations("Common");
  const to = await getTranslations("Order");
  const format = await getFormatter();

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
        <h2 className="text-base font-bold">{t("inbox")}</h2>
      </div>
      <ul className="overflow-y-auto">
        {rows.map((c) => {
          const name = c.counterpart || tc("deletedUser");
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex gap-3 border-b border-[hsl(var(--border))] px-3 py-3 transition-colors ${
                  active ? "bg-[hsl(var(--primary))]/[0.07]" : "hover:bg-[hsl(var(--surface-2))]"
                }`}
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 flex-none place-items-center rounded-[11px] text-sm font-bold text-white"
                  style={{ backgroundImage: gradFor(name) }}
                >
                  {initialOf(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread > 0 ? "font-extrabold" : "font-semibold"}`}>
                      {name}
                    </span>
                    {c.lastAt && (
                      <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {format.relativeTime(new Date(c.lastAt))}
                      </span>
                    )}
                  </span>
                  {c.orderStatus ? (
                    <span className="mt-1 flex">
                      <StatusChip
                        status={c.orderStatus}
                        label={to(`status.${c.orderStatus}`)}
                        className="text-[10px]"
                      />
                    </span>
                  ) : c.context ? (
                    <span className="mt-0.5 block truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                      {c.context}
                    </span>
                  ) : null}
                  {c.lastBody && (
                    <span
                      className={`mt-1 block truncate text-[12.5px] ${
                        c.unread > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      {c.lastBody}
                    </span>
                  )}
                </span>
                {c.unread > 0 && (
                  <span className="grid h-[19px] min-w-[19px] shrink-0 place-items-center self-center rounded-full bg-[hsl(var(--accent))] px-1.5 text-[11px] font-extrabold text-white">
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
