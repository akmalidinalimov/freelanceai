import "server-only";

/**
 * Payment provider seam. v1 uses MANUAL (facilitator) settlement — the platform
 * confirms payment by hand. Payme / Click / ATMOS will implement this same
 * interface later (checkout URL + webhook confirmation) and drop in as a swap,
 * not a rewrite.
 */
export interface PaymentIntent {
  orderId: string;
  amountUzs: number;
}

export interface PaymentStart {
  reference: string;
  /** For MANUAL: instructions text. For PSPs: a checkout URL the buyer is sent to. */
  instructions?: string;
  checkoutUrl?: string;
}

export interface PaymentProvider {
  readonly id: "MANUAL" | "PAYME" | "CLICK" | "ATMOS";
  start(intent: PaymentIntent): Promise<PaymentStart>;
}

export const manualProvider: PaymentProvider = {
  id: "MANUAL",
  async start(intent) {
    return {
      reference: `manual:${intent.orderId}`,
      instructions: "Payment is arranged and confirmed manually by the platform.",
    };
  },
};

/** Resolve the active provider. Until a PSP is integrated, this is MANUAL. */
export function getPaymentProvider(): PaymentProvider {
  return manualProvider;
}
