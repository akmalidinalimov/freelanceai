import type { LedgerAccount } from "@prisma/client";

/**
 * Pure money math + double-entry postings (no db/server-only → unit-testable).
 * All amounts are integer UZS. Every transaction's postings MUST sum to 0.
 *
 * Sign convention: assets are positive (debits); liabilities and revenue are
 * negative (credits). The ledger records what each party is owed regardless of
 * whether the platform holds funds (escrow) or only facilitates — that operational
 * choice affects cash movement and payouts, not this accounting record.
 */
export interface Split {
  amountUzs: number;
  commissionUzs: number;
  sellerNetUzs: number;
}

export function computeSplit(amountUzs: number, commissionPct: number): Split {
  const commissionUzs = Math.round((amountUzs * commissionPct) / 100);
  return { amountUzs, commissionUzs, sellerNetUzs: amountUzs - commissionUzs };
}

export interface ExtraLine {
  priceUzs: number;
  deliveryDays?: number;
}

/**
 * Order totals = base package price + selected add-ons, with the commission split
 * computed on the combined total. Returns the split plus the extras subtotal and the
 * extra delivery days. Pure → unit-tested.
 */
export function orderTotals(basePriceUzs: number, extras: ExtraLine[], commissionPct: number) {
  const extrasUzs = extras.reduce((a, e) => a + Math.max(0, Math.round(e.priceUzs)), 0);
  const extraDays = extras.reduce((a, e) => a + Math.max(0, e.deliveryDays ?? 0), 0);
  const split = computeSplit(basePriceUzs + extrasUzs, commissionPct);
  return { ...split, extrasUzs, extraDays };
}

export interface Posting {
  account: LedgerAccount;
  amountUzs: number;
}

/** Balanced postings for a client payment on an order. */
export function paymentPostings(amountUzs: number, commissionUzs: number): Posting[] {
  const sellerNetUzs = amountUzs - commissionUzs;
  return [
    { account: "CLIENT_FUNDS", amountUzs }, // +A received from client
    { account: "PLATFORM_REVENUE", amountUzs: -commissionUzs }, // commission earned (credit)
    { account: "SELLER_PAYABLE", amountUzs: -sellerNetUzs }, // owed to seller (credit)
  ];
}

/**
 * Compute a platform-funded discount from a coupon, capped so the platform never pays
 * out of pocket beyond its own commission (discount ≤ commission) and never below 0.
 */
export function couponDiscount(
  coupon: { percentOff?: number | null; amountOffUzs?: number | null },
  subtotalUzs: number,
  commissionUzs: number
): number {
  const raw = coupon.percentOff
    ? Math.round((subtotalUzs * coupon.percentOff) / 100)
    : Math.max(0, coupon.amountOffUzs ?? 0);
  return Math.max(0, Math.min(raw, commissionUzs, subtotalUzs));
}

/**
 * Balanced postings for a payment with a platform-funded discount: the buyer pays
 * (amount − discount), the seller is still owed their full net, and the platform's
 * revenue is reduced by the discount. Still sums to zero.
 */
export function discountedPaymentPostings(
  amountUzs: number,
  commissionUzs: number,
  discountUzs: number
): Posting[] {
  const sellerNetUzs = amountUzs - commissionUzs;
  return [
    { account: "CLIENT_FUNDS", amountUzs: amountUzs - discountUzs },
    { account: "PLATFORM_REVENUE", amountUzs: -(commissionUzs - discountUzs) },
    { account: "SELLER_PAYABLE", amountUzs: -sellerNetUzs },
  ];
}

/** Balanced postings that reverse a payment (refund on dispute). */
export function refundPostings(amountUzs: number, commissionUzs: number): Posting[] {
  return paymentPostings(amountUzs, commissionUzs).map((p) => ({
    account: p.account,
    amountUzs: -p.amountUzs,
  }));
}

/** Balanced postings for a buyer tip (no commission — the seller keeps it all). */
export function tipPostings(amountUzs: number): Posting[] {
  return [
    { account: "CLIENT_FUNDS", amountUzs }, // +A received from client
    { account: "SELLER_PAYABLE", amountUzs: -amountUzs }, // fully owed to the seller
  ];
}

/**
 * Balanced postings that reverse a confirmed payment, accounting for any platform-funded
 * discount (so CLIENT_FUNDS is credited back exactly what the buyer paid). Use for refunds
 * on dispute/cancellation. With discount=0 this equals refundPostings.
 */
export function reversalPostings(amountUzs: number, commissionUzs: number, discountUzs = 0): Posting[] {
  const base =
    discountUzs > 0
      ? discountedPaymentPostings(amountUzs, commissionUzs, discountUzs)
      : paymentPostings(amountUzs, commissionUzs);
  return base.map((p) => ({ account: p.account, amountUzs: -p.amountUzs }));
}

/** Balanced postings for paying a seller out. */
export function payoutPostings(amountUzs: number): Posting[] {
  return [
    { account: "SELLER_PAYABLE", amountUzs }, // reduce what we owe the seller
    { account: "PAYOUT_CLEARING", amountUzs: -amountUzs }, // funds leaving
  ];
}

export function postingsBalance(postings: Posting[]): number {
  return postings.reduce((sum, p) => sum + p.amountUzs, 0);
}
