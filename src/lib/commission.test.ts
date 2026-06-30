import { describe, it, expect } from "vitest";
import {
  computeSplit,
  orderTotals,
  paymentPostings,
  payoutPostings,
  refundPostings,
  tipPostings,
  postingsBalance,
} from "./commission";

describe("tip postings", () => {
  it("credit the seller in full with no commission, balanced to zero", () => {
    const p = tipPostings(25_000);
    expect(postingsBalance(p)).toBe(0);
    expect(p.find((x) => x.account === "SELLER_PAYABLE")?.amountUzs).toBe(-25_000);
    expect(p.find((x) => x.account === "PLATFORM_REVENUE")).toBeUndefined();
  });
});

describe("order totals with extras", () => {
  it("adds extras to the base and splits on the combined total", () => {
    const r = orderTotals(100_000, [{ priceUzs: 20_000, deliveryDays: 1 }, { priceUzs: 30_000 }], 20);
    expect(r.extrasUzs).toBe(50_000);
    expect(r.extraDays).toBe(1);
    expect(r.amountUzs).toBe(150_000);
    expect(r.commissionUzs).toBe(30_000);
    expect(r.sellerNetUzs).toBe(120_000);
  });

  it("with no extras equals a plain split", () => {
    expect(orderTotals(80_000, [], 20)).toMatchObject({ amountUzs: 80_000, extrasUzs: 0, extraDays: 0 });
  });

  it("the resulting payment postings still balance to zero", () => {
    const r = orderTotals(100_000, [{ priceUzs: 50_000 }], 15);
    expect(postingsBalance(paymentPostings(r.amountUzs, r.commissionUzs))).toBe(0);
  });
});

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

  it("refund reverses a payment exactly (payment + refund nets to zero)", () => {
    const { commissionUzs } = computeSplit(100_000, 20);
    const pay = paymentPostings(100_000, commissionUzs);
    const refund = refundPostings(100_000, commissionUzs);
    expect(postingsBalance(refund)).toBe(0);
    expect(postingsBalance([...pay, ...refund])).toBe(0);
    // every account returns to net zero
    const byAccount: Record<string, number> = {};
    for (const p of [...pay, ...refund]) byAccount[p.account] = (byAccount[p.account] ?? 0) + p.amountUzs;
    for (const v of Object.values(byAccount)) expect(v).toBe(0);
  });

  it("a full payment + payout cycle nets to zero across the ledger", () => {
    const { commissionUzs, sellerNetUzs } = computeSplit(100_000, 20);
    const all = [...paymentPostings(100_000, commissionUzs), ...payoutPostings(sellerNetUzs)];
    expect(postingsBalance(all)).toBe(0);
  });
});
