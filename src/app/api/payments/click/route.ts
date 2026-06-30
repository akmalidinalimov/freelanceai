import { NextResponse } from "next/server";
import { handleClick, type ClickParams } from "@/lib/payments/click";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Click Shop API webhook (Prepare + Complete). Public endpoint — authenticated by the
 * MD5 sign_string, not a session. Click POSTs application/x-www-form-urlencoded.
 * Inert until CLICK_SECRET_KEY is configured (sign check fails → -1).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const get = (k: string) => String(form.get(k) ?? "");
    const params: ClickParams = {
      click_trans_id: get("click_trans_id"),
      service_id: get("service_id"),
      merchant_trans_id: get("merchant_trans_id"),
      merchant_prepare_id: get("merchant_prepare_id") || undefined,
      amount: get("amount"),
      action: get("action"),
      sign_time: get("sign_time"),
      sign_string: get("sign_string"),
      error: get("error") || undefined,
    };
    const result = await handleClick(params);
    return NextResponse.json(result);
  } catch (err) {
    logger.error("click_webhook_error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: -8, error_note: "Internal error" });
  }
}
