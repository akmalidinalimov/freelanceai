import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { BecomeCreatorButton } from "@/components/become-creator-button";
import { Wallet, ShieldCheck, Globe, Sparkles, ArrowRight, Send, BadgeCheck } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sell" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user?.isSeller) {
    redirect({ href: "/dashboard/seller", locale });
    return null;
  }

  const t = await getTranslations("Sell");
  const tg = await getTranslations("Gig");

  const benefits = [
    { icon: Wallet, text: tg("sellBenefit1") },
    { icon: ShieldCheck, text: tg("sellBenefit2") },
    { icon: Globe, text: tg("sellBenefit3") },
  ];
  const steps = [
    { title: t("step1Title"), desc: t("step1Desc") },
    { title: t("step2Title"), desc: t("step2Desc") },
    { title: t("step3Title"), desc: t("step3Desc") },
    { title: t("step4Title"), desc: t("step4Desc") },
  ];
  const trust = [
    { icon: ShieldCheck, text: t("trust1") },
    { icon: Send, text: t("trust2") },
    { icon: BadgeCheck, text: t("trust3") },
  ];

  const Cta = () =>
    user ? (
      <BecomeCreatorButton locale={locale} />
    ) : (
      <Link href="/login">
        <Button size="lg">{tg("becomeCreator")}</Button>
      </Link>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 text-center sm:py-20">
        {/* soft brand glow, purely decorative */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-72 max-w-2xl rounded-[50%] opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 40%, hsl(var(--primary)/.18), transparent 70%), radial-gradient(40% 50% at 70% 60%, hsl(var(--accent)/.16), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/8 px-3 py-1 text-xs font-bold text-[hsl(var(--primary-ink))]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            {t("eyebrow")}
          </span>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Cta />
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-ink))]"
            >
              {t("ctaSecondary")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-6">
        <h2 className="font-display mb-5 text-center text-2xl font-bold">{t("benefitsTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {benefits.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]"
            >
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary-ink))]">
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — a genuine 4-step sequence, so the numbers carry meaning */}
      <section id="how" className="scroll-mt-20 py-12">
        <h2 className="font-display mb-6 text-center text-2xl font-bold">{t("howTitle")}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
            >
              <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-extrabold text-[hsl(var(--primary-foreground))]">
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="py-6">
        <h2 className="font-display mb-5 text-center text-2xl font-bold">{t("trustTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {trust.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 rounded-xl bg-[hsl(var(--surface-2))] p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" strokeWidth={1.9} />
              <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-10 rounded-3xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--primary))]/8 to-[hsl(var(--accent))]/8 px-6 py-12 text-center">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t("finalTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-[hsl(var(--muted-foreground))]">{t("finalDesc")}</p>
        <div className="mt-6 flex justify-center">
          <Cta />
        </div>
      </section>
    </div>
  );
}
