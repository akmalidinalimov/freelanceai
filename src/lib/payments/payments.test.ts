import { describe, it, expect, beforeEach } from "vitest";
import { activeProvider, paymentsEnabled } from "./index";
import { paymeProvider, verifyPaymeAuth } from "./payme";
import { clickProvider, clickSignString, verifyClickSign, type ClickParams } from "./click";

const ORDER = { id: "order_123", amountUzs: 50000 };

function clearEnv() {
  for (const k of [
    "PAYMENT_PROVIDER",
    "PAYME_MERCHANT_ID",
    "PAYME_KEY",
    "CLICK_SERVICE_ID",
    "CLICK_MERCHANT_ID",
    "CLICK_SECRET_KEY",
  ]) {
    delete process.env[k];
  }
}

beforeEach(clearEnv);

describe("provider factory", () => {
  it("is inert (manual) when nothing is configured", () => {
    expect(activeProvider()).toBeNull();
    expect(paymentsEnabled()).toBe(false);
  });

  it("selects Payme when configured", () => {
    process.env.PAYMENT_PROVIDER = "payme";
    process.env.PAYME_MERCHANT_ID = "m1";
    process.env.PAYME_KEY = "secret";
    expect(activeProvider()?.id).toBe("payme");
  });

  it("does not activate a provider whose creds are missing", () => {
    process.env.PAYMENT_PROVIDER = "click"; // no CLICK_* set
    expect(activeProvider()).toBeNull();
  });
});

describe("Payme adapter", () => {
  it("builds a base64 checkout URL with merchant, order, and tiyin amount", () => {
    process.env.PAYME_MERCHANT_ID = "merch1";
    const url = paymeProvider.checkoutUrl(ORDER);
    const encoded = url.split("/").pop()!;
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    expect(decoded).toContain("m=merch1");
    expect(decoded).toContain("ac.order_id=order_123");
    expect(decoded).toContain("a=5000000"); // 50000 UZS * 100 = tiyin
  });

  it("verifies the Basic auth key and rejects wrong/missing keys", () => {
    process.env.PAYME_KEY = "topsecret";
    const good = "Basic " + Buffer.from("Paycom:topsecret").toString("base64");
    const bad = "Basic " + Buffer.from("Paycom:wrong").toString("base64");
    expect(verifyPaymeAuth(good)).toBe(true);
    expect(verifyPaymeAuth(bad)).toBe(false);
    expect(verifyPaymeAuth(null)).toBe(false);
    expect(verifyPaymeAuth("Bearer x")).toBe(false);
  });
});

describe("Click adapter", () => {
  it("builds a checkout URL carrying the order id + amount", () => {
    process.env.CLICK_SERVICE_ID = "svc";
    process.env.CLICK_MERCHANT_ID = "mid";
    const url = clickProvider.checkoutUrl(ORDER);
    expect(url).toContain("transaction_param=order_123");
    expect(url).toContain("amount=50000");
    expect(url).toContain("service_id=svc");
  });

  it("verifies the MD5 sign_string and rejects tampering", () => {
    process.env.CLICK_SECRET_KEY = "sk_test";
    const base: ClickParams = {
      click_trans_id: "999",
      service_id: "svc",
      merchant_trans_id: "order_123",
      amount: "50000",
      action: "0",
      sign_time: "2026-06-30 12:00:00",
      sign_string: "",
    };
    base.sign_string = clickSignString(base, "sk_test");
    expect(verifyClickSign(base)).toBe(true);

    // Tampering with the amount invalidates the signature.
    expect(verifyClickSign({ ...base, amount: "1" })).toBe(false);
  });

  it("includes merchant_prepare_id in the Complete signature only", () => {
    const p: ClickParams = {
      click_trans_id: "1",
      service_id: "s",
      merchant_trans_id: "o",
      merchant_prepare_id: "42",
      amount: "10",
      action: "1",
      sign_time: "t",
      sign_string: "",
    };
    const withPrepare = clickSignString(p, "k");
    const asPrepare = clickSignString({ ...p, action: "0" }, "k");
    expect(withPrepare).not.toBe(asPrepare);
  });
});
