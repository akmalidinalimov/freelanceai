/**
 * A titled white card that groups related form fields. Gigora's page ground is
 * Sandstone, so fields placed directly on it (with transparent fills) visually blend
 * into the background — measured on a real iPhone Mini App screenshot. Content sits on
 * white ("content on milk, colour at the edges"), and each card makes one step of the
 * form obvious at a glance.
 */
export function FormSection({
  title,
  desc,
  badge,
  children,
}: {
  title: string;
  desc?: string;
  /** e.g. "Ixtiyoriy" — marks a section the seller can skip. */
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display font-bold">{title}</h2>
          {badge && (
            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              {badge}
            </span>
          )}
        </div>
        {desc && <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

/** Shared input styling: a WHITE fill, so a field never dissolves into the page. */
export const fieldClass =
  "w-full rounded-md border border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-3 py-2 text-sm";
