import { getTranslations } from "next-intl/server";

export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("Common");
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-6xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="rounded-full bg-[hsl(var(--muted))] px-4 py-1 text-sm text-[hsl(var(--muted-foreground))]">
        {t("comingSoon")}
      </p>
    </div>
  );
}
