import "server-only";

/**
 * Payment-provider abstraction. The platform accepts payments through a licensed
 * Uzbek PSP (Payme or Click) selected by env. When no provider is configured the
 * marketplace falls back to the existing **manual** settlement flow (admin confirms
 * receipt), so production behaviour is unchanged until credentials are supplied.
 *
 * Flip-on: set PAYMENT_PROVIDER=payme|click plus that provider's credentials
 * (see docs/payments.md). Nothing here moves money on its own — the buyer pays on
 * the provider's hosted checkout and the provider calls our webhook to confirm.
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

/** The configured provider, or null when payments run in manual mode. */
export function activeProvider(): PaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER?.toLowerCase();
  if (id === "payme" && paymeConfigured()) return paymeProvider;
  if (id === "click" && clickConfigured()) return clickProvider;
  return null;
}

export function paymentsEnabled(): boolean {
  return activeProvider() !== null;
}
