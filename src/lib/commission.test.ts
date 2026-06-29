import { describe, it, expect } from "vitest";
import {
  computeSplit,
  paymentPostings,
  payoutPostings,
  postingsBalance,
} from "./commission";

describe("commission split", () => {
  it("splits amount into commission + seller net", () => {
    expect(computeSplit(100_000, 20)).toEqual({
      amountUzs: 100_000,
      commissionUzs: 20_000,
      sellerNetUzs: 80_000,
    });
  });

  it("rounds commission to an integer and net always closes the gap", () => {
    const s = computeSplit(33_333, 20); // 6666.6 -> 6667
    expect(s.commissionUzs).toBe(6_667);
    expect(s.sellerNetUzs).toBe(26_666);
    expect(s.commissionUzs + s.sellerNetUzs).toBe(33_333); // no lost tiyin
  });

  it("handles 0% and 100%", () => {
    expect(computeSplit(50_000, 0)).toMatchObject({ commissionUzs: 0, sellerNetUzs: 50_000 });
    expect(computeSplit(50_000, 100)).toMatchObject({ commissionUzs: 50_000, sellerNetUzs: 0 });
  });
});

describe("double-entry postings always balance", () => {
  it("payment postings sum to zero", () => {
    const { commissionUzs } = computeSplit(100_000, 20);
    expect(postingsBalance(paymentPostings(100_000, commissionUzs))).toBe(0);
  });

  it("payment postings balance for awkward amounts", () => {
    for (const amount of [1_000, 33_333, 999_999, 12_345_678]) {
      const { commissionUzs } = computeSplit(amount, 20);
      expect(postingsBalance(paymentPostings(amount, commissionUzs))).toBe(0);
    }
  });

  it("payout postings sum to zero", () => {
    expect(postingsBalance(payoutPostings(80_000))).toBe(0);
  });

  it("a full payment + payout cycle nets to zero across the ledger", () => {
    const { commissionUzs, sellerNetUzs } = computeSplit(100_000, 20);
    const all = [...paymentPostings(100_000, commissionUzs), ...payoutPostings(sellerNetUzs)];
    expect(postingsBalance(all)).toBe(0);
  });
});
