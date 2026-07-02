import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "FreelanceAI Terms of Service",
};

/**
 * DRAFT legal text pending review by local counsel (see docs/legal-notes.md).
 * English-first v1; uz/ru translations follow counsel sign-off. Kept as plain
 * server-rendered content so Meta App Review and users always have a live URL.
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="prose-sm mx-auto max-w-3xl px-4 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_p]:mt-3 [&_li]:mt-1 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Effective: 2 July 2026 (draft — under legal review) ·{" "}
        <Link href="/legal/privacy" className="text-[hsl(var(--primary))] underline">
          Privacy Policy
        </Link>
      </p>

      <h2>1. What FreelanceAI is</h2>
      <p>
        FreelanceAI (&quot;the Platform&quot;, &quot;we&quot;) is an online marketplace where clients
        (&quot;Buyers&quot;) order digital creative services — AI-generated video, images, audio, design
        and related work — from independent creators (&quot;Sellers&quot;). We provide the venue,
        tooling and payment coordination; the creative work itself is performed by Sellers, who are
        independent contractors, not our employees.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You sign in via Telegram or Google. You are responsible for activity on your account.</li>
        <li>You must be at least 18, or the age of legal capacity in your jurisdiction.</li>
        <li>
          Sellers may be asked to verify their identity and phone number (KYC) before receiving
          payouts. Providing false information is grounds for suspension.
        </li>
        <li>One person may act as both Buyer and Seller, but never on both sides of the same order.</li>
      </ul>

      <h2>3. Orders, delivery and revisions</h2>
      <ul>
        <li>
          An order is formed when a Buyer purchases a Seller&apos;s listed service (&quot;Gig&quot;)
          or accepts a custom offer. The Gig description, package tier and any extras define the scope.
        </li>
        <li>Sellers must deliver within the stated time; Buyers must provide requirements promptly.</li>
        <li>
          Delivered orders are auto-completed after a grace period if the Buyer neither accepts nor
          requests a revision. Included revisions are stated on each package.
        </li>
        <li>Cancellations and disputes are handled through the Platform&apos;s resolution process; our decision on refunds is final within the Platform.</li>
      </ul>

      <h2>4. Payments, fees and payouts</h2>
      <ul>
        <li>
          Prices are in Uzbek so&apos;m (UZS). Payments are processed by licensed payment providers
          (e.g. Payme, Click, Uzum); we never store full card numbers.
        </li>
        <li>
          Buyer payments are held against the order and released to the Seller after completion.
          The Platform charges Sellers a commission (currently 20%) on completed orders.
        </li>
        <li>
          Payouts to Sellers are made to their registered card upon request, after KYC verification.
          Sellers are responsible for their own taxes (in Uzbekistan, e.g. self-employed status).
        </li>
        <li>Ordering and paying outside the Platform to bypass fees (&quot;off-platform dealing&quot;) is prohibited and may lead to suspension.</li>
      </ul>

      <h2>5. Content and intellectual property</h2>
      <ul>
        <li>
          Upon full payment and completion, the Seller assigns the agreed rights in the delivered
          work to the Buyer, unless the Gig states otherwise.
        </li>
        <li>
          Sellers keep the right to display completed work in their Platform portfolio unless the
          Buyer purchased confidentiality.
        </li>
        <li>
          If a Seller connects an Instagram account, they grant us a non-exclusive license to
          display their own Instagram media on their Platform profile. This license ends — and the
          synced media is deleted — when they disconnect Instagram or delete their account.
        </li>
        <li>You may not upload content you have no right to use, or unlawful content.</li>
      </ul>

      <h2>6. Prohibited use</h2>
      <p>
        No illegal services or content; no deception about the use of AI where disclosure is legally
        required; no harassment, spam or attempts to breach Platform security; no exchanging contact
        details to move a transaction off-platform before an order is placed.
      </p>

      <h2>7. Liability</h2>
      <p>
        The Platform is provided &quot;as is&quot;. To the extent permitted by law, we are not liable
        for the quality of Sellers&apos; work beyond the refund mechanisms described above, nor for
        indirect or consequential losses. Nothing here excludes liability that cannot lawfully be excluded.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may delete your account at any time from Settings (active orders must finish first;
        Sellers must withdraw their balance). We may suspend accounts that violate these terms.
        Transaction records are retained as required for accounting and dispute resolution.
      </p>

      <h2>9. Changes and contact</h2>
      <p>
        We may update these terms; material changes will be announced on the Platform. Questions:{" "}
        <span className="font-medium">support@aicreator.academy</span>. Governing law: Republic of
        Uzbekistan (subject to counsel confirmation).
      </p>
    </div>
  );
}
