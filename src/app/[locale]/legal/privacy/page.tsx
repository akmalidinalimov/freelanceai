import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FreelanceAI Privacy Policy",
};

/**
 * DRAFT legal text pending review by local counsel (see docs/legal-notes.md).
 * Written to reflect what the system ACTUALLY does today — every claim below
 * corresponds to implemented behavior.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="prose-sm mx-auto max-w-3xl px-4 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_p]:mt-3 [&_li]:mt-1 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Effective: 2 July 2026 (draft — under legal review) ·{" "}
        <Link href="/legal/terms" className="text-[hsl(var(--primary))] underline">
          Terms of Service
        </Link>
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <b>Account data:</b> your Telegram ID, name and username (from Telegram Login) or your
          Google name and email; your language preference.
        </li>
        <li>
          <b>KYC data (Sellers):</b> phone number — stored <b>encrypted at rest</b> — and, for
          payouts, a masked card number (last 4 digits only; we never store full card numbers).
        </li>
        <li>
          <b>Marketplace activity:</b> gigs, orders, messages, reviews, payout requests, and an
          audit trail of money-related actions.
        </li>
        <li>
          <b>Instagram (optional, Sellers):</b> if you connect Instagram, we store your Instagram
          user ID and an encrypted access token, and copies of the media you already published,
          to show them as your portfolio.
        </li>
        <li>
          <b>Technical data:</b> logs necessary for security and abuse prevention (e.g. rate limiting).
          We do not run third-party advertising trackers.
        </li>
      </ul>

      <h2>2. Why we use it</h2>
      <p>
        To operate the marketplace (matching, orders, messaging, payments and payouts), verify
        Sellers, prevent fraud and abuse, meet accounting obligations, and send service
        notifications via Telegram, email and in-app (you control notification preferences in Settings).
      </p>

      <h2>3. Who we share it with</h2>
      <ul>
        <li><b>Payment providers</b> (e.g. Payme, Click, Uzum) — to process payments and payouts.</li>
        <li><b>Telegram</b> — to authenticate you and deliver notifications you enabled.</li>
        <li><b>Meta / Instagram</b> — only if you connect Instagram, to read your own media with your consent.</li>
        <li><b>Resend</b> — to deliver transactional email.</li>
        <li><b>Infrastructure:</b> our servers (currently hosted with Hostinger in the EU) and Cloudflare (traffic, media storage). We never sell personal data.</li>
      </ul>

      <h2>4. Security</h2>
      <p>
        Sensitive fields (phone numbers, Instagram tokens) are encrypted at rest; full card numbers
        are never stored; the database is not exposed to the internet; access to admin functions is
        allow-listed; money actions are audit-logged; encrypted nightly backups are kept with a
        7-day rotation.
      </p>

      <h2>5. Your rights and controls</h2>
      <ul>
        <li>
          <b>Export:</b> download everything we hold about you as JSON from Settings (or{" "}
          <span className="font-mono text-xs">GET /api/me/export</span>).
        </li>
        <li>
          <b>Deletion:</b> delete your account from Settings. Personal identifiers are removed;
          anonymized transaction records are retained as required for accounting and the other
          party&apos;s records.
        </li>
        <li><b>Instagram:</b> disconnecting deletes the token and all synced media immediately.</li>
        <li><b>Corrections:</b> profile data is editable in your dashboard at any time.</li>
      </ul>

      <h2>6. Retention</h2>
      <p>
        Account data is kept while your account is active. After deletion, anonymized order and
        ledger records are retained for the period required by accounting law; backups age out
        within 7 days.
      </p>

      <h2>7. Contact</h2>
      <p>
        Privacy requests: <span className="font-medium">support@aicreator.academy</span>. We will
        update this policy as the service evolves (e.g. when card payments go live); material
        changes will be announced on the Platform.
      </p>
    </div>
  );
}
