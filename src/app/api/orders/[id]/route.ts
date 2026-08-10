import { z } from "zod";
import { NextResponse } from "next/server";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import {
  deliverOrder,
  acceptOrder,
  requestRevision,
  cancelOrder,
  reorderOrder,
} from "@/server/services/order";
import { confirmOrderPayment } from "@/server/services/payments";
import { openDispute } from "@/server/services/dispute";
import { isOwnUpload } from "@/lib/media";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    action: z.enum(["deliver", "accept", "revision", "cancel", "confirm_payment", "dispute", "reorder"]),
    message: z.string().max(2000).optional(),
    // Delivery files live in the private bucket → a ref, not a URL; enforce "our upload" below.
    fileUrls: z.array(z.string().min(1).max(500)).max(10).optional(),
    reason: z.string().max(1000).optional(),
  })
  .strict();

/**
 * Order lifecycle actions. Dynamic route → plain handler (defineHandler doesn't
 * pass route params). Authz + state-machine checks live in the service.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();

    // The lifecycle route had no limit at all — the one place a user can drive deliver/accept/
    // revision/dispute, plus reorder, which re-enters createOrder and so slipped past the
    // order:create bucket entirely (audit 2026-08-10, S12).
    enforceRateLimit(`order:act:${user.id}`, 30, 60_000);

    const { id } = await params;
    const body = parseInput(schema, await request.json().catch(() => ({})));
    // Reorder creates a real order, so it must also spend the order-creation budget rather than
    // being a cheaper side door into the same operation.
    if (body.action === "reorder") enforceRateLimit(`order:create:${user.id}`, 8, 60_000);
    // Attachments must be our own R2 uploads (public URL or private ref), never arbitrary URLs.
    if (body.fileUrls?.some((u) => !isOwnUpload(u))) {
      throw Errors.validation({ fileUrls: "Only uploaded files are allowed" });
    }

    switch (body.action) {
      case "deliver":
        await deliverOrder(id, user, body.message ?? "", body.fileUrls ?? []);
        break;
      case "accept":
        await acceptOrder(id, user);
        break;
      case "revision":
        await requestRevision(id, user, body.message ?? "");
        break;
      case "cancel":
        await cancelOrder(id, user);
        break;
      case "confirm_payment":
        await confirmOrderPayment(id, user);
        break;
      case "dispute":
        await openDispute(id, user, body.reason ?? "");
        break;
      case "reorder": {
        const newOrderId = await reorderOrder(id, user);
        return ok({ done: true, orderId: newOrderId });
      }
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
