import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { settleOrderByProvider, reverseSettlementByProvider } from "@/server/services/payments";
import type { CheckoutOrder, PaymentProvider } from "./index";

/**
 * Payme (Paycom) Merchant API adapter — JSON-RPC 2.0 over a single webhook, amounts
 * in **tiyin** (1 UZS = 100 tiyin). The buyer pays on checkout.paycom.uz; Payme then
 * calls our webhook with CheckPerformTransaction → CreateTransaction → PerformTransaction.
 *
 * Env: PAYME_MERCHANT_ID, PAYME_KEY (the cashbox key used for Basic auth),
 * optional PAYME_CHECKOUT_URL (default https://checkout.paycom.uz).
 *
 * NOTE: Payme runs an official sandbox test-suite against this endpoint. Certify there
 * before go-live — see docs/payments.md. Without creds this module is inert.
 */
export function paymeConfigured(): boolean {
  return Boolean(process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY);
}

export const paymeProvider: PaymentProvider = {
  id: "payme",
  checkoutUrl(order: CheckoutOrder): string {
    const base = process.env.PAYME_CHECKOUT_URL ?? "https://checkout.paycom.uz";
    const merchant = process.env.PAYME_MERCHANT_ID ?? "";
    // amount in tiyin; account.order_id ties the payment back to our order.
    const params = `m=${merchant};ac.order_id=${order.id};a=${order.amountUzs * 100}`;
    return `${base}/${Buffer.from(params).toString("base64")}`;
  },
};

// Payme JSON-RPC error codes (subset we use).
export const PaymeErr = {
  INVALID_AMOUNT: { code: -31001, message: { en: "Invalid amount", ru: "Неверная сумма", uz: "Notoʻgʻri summa" } },
  ORDER_NOT_FOUND: { code: -31050, message: { en: "Order not found", ru: "Заказ не найден", uz: "Buyurtma topilmadi" } },
  CANT_PERFORM: { code: -31008, message: { en: "Can't perform", ru: "Невозможно выполнить", uz: "Bajarib boʻlmaydi" } },
  TXN_NOT_FOUND: { code: -31003, message: { en: "Transaction not found", ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi" } },
  UNAUTHORIZED: { code: -32504, message: { en: "Unauthorized", ru: "Нет доступа", uz: "Ruxsat yoʻq" } },
  METHOD_NOT_FOUND: { code: -32601, message: { en: "Method not found", ru: "Метод не найден", uz: "Metod topilmadi" } },
} as const;

/** Verify the Payme `Authorization: Basic base64("Paycom:<KEY>")` header. */
export function verifyPaymeAuth(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const key = decoded.split(":")[1] ?? "";
  return key.length > 0 && key === process.env.PAYME_KEY;
}

type Rpc = { id: number | string | null; method: string; params: Record<string, unknown> };
type RpcResult = { result: unknown } | { error: { code: number; message: unknown } };

const err = (e: { code: number; message: unknown }): RpcResult => ({ error: { code: e.code, message: e.message } });

/** Handle one Payme JSON-RPC call. Idempotent; safe to retry. */
export async function handlePaymeRpc(rpc: Rpc): Promise<RpcResult> {
  const p = rpc.params ?? {};
  switch (rpc.method) {
    case "CheckPerformTransaction": {
      const orderId = String((p.account as Record<string, unknown>)?.order_id ?? "");
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "PENDING_PAYMENT") return err(PaymeErr.ORDER_NOT_FOUND);
      if (Number(p.amount) !== (order.amountUzs - order.discountUzs) * 100) return err(PaymeErr.INVALID_AMOUNT);
      return { result: { allow: true } };
    }
    case "CreateTransaction": {
      const paymeId = String(p.id);
      const orderId = String((p.account as Record<string, unknown>)?.order_id ?? "");
      const existing = await prisma.transaction.findFirst({ where: { provider: "PAYME", providerTxnId: paymeId } });
      if (existing) {
        const raw = (existing.rawPayload as Record<string, unknown>) ?? {};
        return { result: { create_time: raw.create_time ?? existing.createdAt.getTime(), transaction: existing.id, state: 1 } };
      }
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "PENDING_PAYMENT") return err(PaymeErr.ORDER_NOT_FOUND);
      if (Number(p.amount) !== (order.amountUzs - order.discountUzs) * 100) return err(PaymeErr.INVALID_AMOUNT);
      // Reject a SECOND Payme transaction for an order that already has an active (pending or
      // paid) one under a different id — otherwise the buyer could be charged twice. Payme
      // treats CANT_PERFORM here as "order already in process". The findFirst handles the
      // common (serial) case; the partial unique index `payme_active_txn_per_order` is the
      // ATOMIC backstop for a true race (two CreateTransaction with different ids at once) —
      // one insert wins, the other trips the constraint (P2002) and we map it to CANT_PERFORM.
      const otherActive = await prisma.transaction.findFirst({
        where: {
          orderId,
          provider: "PAYME",
          providerTxnId: { not: paymeId },
          status: { in: ["PENDING", "SUCCEEDED"] },
        },
      });
      if (otherActive) return err(PaymeErr.CANT_PERFORM);
      const createTime = Number(p.time) || undefined;
      let txn;
      try {
        txn = await prisma.transaction.create({
          data: {
            orderId,
            provider: "PAYME",
            type: "PAYMENT_IN",
            status: "PENDING",
            amountUzs: order.amountUzs - order.discountUzs,
            providerTxnId: paymeId,
            rawPayload: { create_time: createTime ?? null, order_id: orderId },
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          // A concurrent insert won. If it was the SAME payme id (idempotent retry that raced
          // past the `existing` pre-check), return that now-committed row — Payme expects
          // idempotent success. If it was a DIFFERENT id, the order's one active-txn slot is
          // taken → "order in process".
          const raced = await prisma.transaction.findFirst({ where: { provider: "PAYME", providerTxnId: paymeId } });
          if (raced) {
            const rraw = (raced.rawPayload as Record<string, unknown>) ?? {};
            return { result: { create_time: rraw.create_time ?? raced.createdAt.getTime(), transaction: raced.id, state: 1 } };
          }
          return err(PaymeErr.CANT_PERFORM);
        }
        throw e;
      }
      return { result: { create_time: createTime ?? txn.createdAt.getTime(), transaction: txn.id, state: 1 } };
    }
    case "PerformTransaction": {
      const paymeId = String(p.id);
      const txn = await prisma.transaction.findFirst({ where: { provider: "PAYME", providerTxnId: paymeId } });
      if (!txn || !txn.orderId) return err(PaymeErr.TXN_NOT_FOUND);
      const raw = (txn.rawPayload as Record<string, unknown>) ?? {};
      if (txn.status === "SUCCEEDED") {
        return { result: { perform_time: raw.perform_time ?? 0, transaction: txn.id, state: 2 } };
      }
      const performTime = Date.now();
      await settleOrderByProvider(txn.orderId, "PAYME", paymeId);
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { status: "SUCCEEDED", rawPayload: { ...raw, perform_time: performTime } },
      });
      return { result: { perform_time: performTime, transaction: txn.id, state: 2 } };
    }
    case "CancelTransaction": {
      const paymeId = String(p.id);
      const txn = await prisma.transaction.findFirst({ where: { provider: "PAYME", providerTxnId: paymeId } });
      if (!txn) return err(PaymeErr.TXN_NOT_FOUND);
      const raw = (txn.rawPayload as Record<string, unknown>) ?? {};
      const cancelTime = (raw.cancel_time as number) ?? Date.now();
      // state -2 = a PERFORMED payment being reversed; -1 = a not-yet-performed one cancelled.
      const wasPerformed = txn.status === "SUCCEEDED" || Boolean(raw.perform_time);
      const state = wasPerformed ? -2 : -1;
      // Reverse the settlement BEFORE flipping the txn to CANCELLED, and only for a performed
      // payment — this claws back the seller credit + refunds the buyer ledger (or flags admins
      // if the order already advanced). Idempotent, so a Payme retry is safe.
      if (wasPerformed && txn.orderId) {
        await reverseSettlementByProvider(txn.orderId, "PAYME", paymeId);
      }
      if (txn.status !== "CANCELLED") {
        await prisma.transaction.update({
          where: { id: txn.id },
          data: { status: "CANCELLED", rawPayload: { ...raw, cancel_time: cancelTime, reason: p.reason ?? null } },
        });
      }
      return { result: { cancel_time: cancelTime, transaction: txn.id, state } };
    }
    case "CheckTransaction": {
      const paymeId = String(p.id);
      const txn = await prisma.transaction.findFirst({ where: { provider: "PAYME", providerTxnId: paymeId } });
      if (!txn) return err(PaymeErr.TXN_NOT_FOUND);
      const raw = (txn.rawPayload as Record<string, unknown>) ?? {};
      const state = txn.status === "SUCCEEDED" ? 2 : txn.status === "CANCELLED" ? (raw.perform_time ? -2 : -1) : 1;
      return {
        result: {
          create_time: raw.create_time ?? txn.createdAt.getTime(),
          perform_time: raw.perform_time ?? 0,
          cancel_time: raw.cancel_time ?? 0,
          transaction: txn.id,
          state,
          reason: raw.reason ?? null,
        },
      };
    }
    default:
      return err(PaymeErr.METHOD_NOT_FOUND);
  }
}
