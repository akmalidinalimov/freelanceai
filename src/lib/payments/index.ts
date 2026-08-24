import "server-only";

/**
 * Payment-provider abstraction. The platform accepts payments through licensed
 * Uzbek PSPs (Payme and/or Click) selected by env. When no provider is configured
 * the marketplace falls back to the existing **manual** settlement flow (admin
 * confirms receipt), so production behaviour is unchanged until credentials exist.
 *
 * Flip-on: set PAYMENT_PROVIDER=payme|click — or a comma list ("payme,click") to
 * offer BOTH at checkout (buyers are wallet-app loyal; each pays with the app they
 * have) — plus each provider's credentials (see docs/payments.md). Nothing here
 * moves money on its own — the buyer pays on the provider's hosted checkout and
 * the provider calls our webhook to confirm; both webhooks are always mounted.
 */
export type ProviderId = "payme" | "click";

export interface CheckoutOrder {
  id: string;
  amountUzs: number;
}

export interface PaymentProvider {
  id: ProviderId;
  /** URL to redirect the buyer to in order to pay for this order. */
  checkoutUrl(order: CheckoutOrder): string;
}

import { paymeConfigured, paymeProvider } from "./payme";
import { clickConfigured, clickProvider } from "./click";

/** Every configured provider, in PAYMENT_PROVIDER order. Empty = manual mode. */
export function activeProviders(): PaymentProvider[] {
  const ids = (process.env.PAYMENT_PROVIDER ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: PaymentProvider[] = [];
  for (const id of ids) {
    if (id === "payme" && paymeConfigured() && !out.some((p) => p.id === "payme")) out.push(paymeProvider);
    if (id === "click" && clickConfigured() && !out.some((p) => p.id === "click")) out.push(clickProvider);
  }
  return out;
}

/** The primary (first configured) provider, or null when payments run in manual mode. */
export function activeProvider(): PaymentProvider | null {
  return activeProviders()[0] ?? null;
}

export function paymentsEnabled(): boolean {
  return activeProvider() !== null;
}
