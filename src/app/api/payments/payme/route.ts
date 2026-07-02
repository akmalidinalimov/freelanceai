import { NextResponse } from "next/server";
import { verifyPaymeAuth, handlePaymeRpc, PaymeErr } from "@/lib/payments/payme";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Payme Merchant API webhook (JSON-RPC 2.0). Public endpoint — authenticated by the
 * Payme Basic-auth key, not a session. Inert until PAYME_KEY is configured.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: number | string | null;
    method?: string;
    params?: Record<string, unknown>;
  };
  const id = body.id ?? null;

  if (!verifyPaymeAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ jsonrpc: "2.0", id, error: PaymeErr.UNAUTHORIZED });
  }

  try {
    const res = await handlePaymeRpc({ id, method: body.method ?? "", params: body.params ?? {} });
    return NextResponse.json({ jsonrpc: "2.0", id, ...res });
  } catch (err) {
    logger.error("payme_webhook_error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ jsonrpc: "2.0", id, error: PaymeErr.CANT_PERFORM });
  }
}
