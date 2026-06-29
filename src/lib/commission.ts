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
