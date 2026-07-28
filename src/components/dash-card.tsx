import { getTranslations } from "next-intl/server";

/** Simple dashboard section card. Renders children, or a "coming soon" placeholder. */
export async function DashCard({
  title,
  children,
  span,
}: {
  title: string;
  children?: React.ReactNode;
  span?: boolean;
}) {
  const t = await getTranslations("Common");
  return (
    <div
      className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 ${
        span ? "sm:col-span-2" : ""
      }`}
    >
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="text-sm text-[hsl(var(--muted-foreground))]">
        {children ?? (
          <span className="inline-block rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs">
            {t("comingSoon")}
          </span>
        )}
      </div>
    </div>
  );
}
