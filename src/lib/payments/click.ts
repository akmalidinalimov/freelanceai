import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { settleOrderByProvider } from "@/server/services/payments";
import type { CheckoutOrder, PaymentProvider } from "./index";

/**
 * Click (Shop API) adapter. The buyer pays on my.click.uz; Click then POSTs two
 * form-encoded callbacks — Prepare (action=0) and Complete (action=1) — each signed
 * with an MD5 of the concatenated fields + the merchant secret. Amounts are in soʻm.
 *
 * Env: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY,
 * optional CLICK_CHECKOUT_URL (default https://my.click.uz/services/pay).
 *
 * NOTE: certify against Click's merchant sandbox before go-live (docs/payments.md).
 * Inert without creds.
 */
export function clickConfigured(): boolean {
  return Boolean(process.env.CLICK_SERVICE_ID && process.env.CLICK_MERCHANT_ID && process.env.CLICK_SECRET_KEY);
}

export const clickProvider: PaymentProvider = {
  id: "click",
  checkoutUrl(order: CheckoutOrder): string {
    const base = process.env.CLICK_CHECKOUT_URL ?? "https://my.click.uz/services/pay";
    const params = new URLSearchParams({
      service_id: process.env.CLICK_SERVICE_ID ?? "",
      merchant_id: process.env.CLICK_MERCHANT_ID ?? "",
      amount: String(order.amountUzs),
      transaction_param: order.id, // echoed back as merchant_trans_id
    });
    return `${base}?${params.toString()}`;
  },
};

export interface ClickParams {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string; // our order id
  merchant_prepare_id?: string; // present on Complete
  amount: string;
  action: string; // "0" prepare, "1" complete
  sign_time: string;
  sign_string: string;
  error?: string; // Click's own status on Complete (<0 = failed/cancelled)
}

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

/** Expected MD5 signature for a Click callback (Prepare omits merchant_prepare_id). */
export function clickSignString(p: ClickParams, secret: string): string {
  const prepareId = p.action === "1" ? (p.merchant_prepare_id ?? "") : "";
  const raw =
    p.click_trans_id +
    p.service_id +
    secret +
    p.merchant_trans_id +
    prepareId +
    p.amount +
    p.action +
    p.sign_time;
  return md5(raw);
}

export function verifyClickSign(p: ClickParams): boolean {
  const secret = process.env.CLICK_SECRET_KEY ?? "";
  if (!secret) return false;
  return clickSignString(p, secret) === p.sign_string;
}

// Click error codes.
const OK = 0;
const E_SIGN = -1;
const E_AMOUNT = -2;
const E_ALREADY_PAID = -4;
const E_NOT_FOUND = -5;

export interface ClickResult {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

/** Handle a Click Prepare/Complete callback. Idempotent settlement on Complete. */
export async function handleClick(p: ClickParams): Promise<ClickResult> {
  const base = { click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id };

  if (!verifyClickSign(p)) {
    return { ...base, error: E_SIGN, error_note: "SIGN CHECK FAILED" };
  }

  const order = await prisma.order.findUnique({ where: { id: p.merchant_trans_id } });
  if (!order) return { ...base, error: E_NOT_FOUND, error_note: "Order not found" };

  const expected = order.amountUzs - order.discountUzs;
  if (Math.round(Number(p.amount)) !== expected) {
    return { ...base, error: E_AMOUNT, error_note: "Incorrect amount" };
  }

  // Prepare: validate only.
  if (p.action === "0") {
    if (order.status !== "PENDING_PAYMENT") {
      return { ...base, error: E_ALREADY_PAID, error_note: "Already processed" };
    }
    // We echo click_trans_id as the prepare id; Click returns it on Complete.
    return { ...base, merchant_prepare_id: Number(p.click_trans_id), error: OK, error_note: "Success" };
  }

  // Complete: Click signals its own outcome via `error` (<0 means the user didn't pay).
  if (Number(p.error ?? 0) < 0) {
    return { ...base, error: Number(p.error), error_note: "Cancelled" };
  }
  await settleOrderByProvider(order.id, "CLICK", p.click_trans_id);
  return { ...base, merchant_confirm_id: Number(p.click_trans_id), error: OK, error_note: "Success" };
}
