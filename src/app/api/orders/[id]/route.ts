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
} from "@/server/services/order";
import { confirmOrderPayment } from "@/server/services/payments";

const schema = z
  .object({
    action: z.enum(["deliver", "accept", "revision", "cancel", "confirm_payment"]),
    message: z.string().max(2000).optional(),
    fileUrls: z.array(z.string().url()).max(10).optional(),
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

    const { id } = await params;
    const body = parseInput(schema, await request.json().catch(() => ({})));

    switch (body.action) {
      case "deliver":
        await deliverOrder(id, user, body.message ?? "", body.fileUrls ?? []);
        break;
      case "accept":
        await acceptOrder(id, user);
        break;
      case "revision":
        await requestRevision(id, user);
        break;
      case "cancel":
        await cancelOrder(id, user);
        break;
      case "confirm_payment":
        await confirmOrderPayment(id, user);
        break;
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
